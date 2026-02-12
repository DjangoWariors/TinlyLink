"""
Views for QR codes app.
"""

import io

from django.http import HttpResponse, HttpResponseRedirect, HttpResponseNotFound, HttpResponseForbidden
from django.shortcuts import render
from django.utils import timezone
from django.views import View

from apps.rules.engine import RuleEngine, get_rules_for_qr_code
from rest_framework import status, generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.users.permissions import CanCreateQRCodes, IsOwner
from .models import QRCode
from .serializers import QRCodeSerializer, CreateQRCodeSerializer, UpdateQRCodeSerializer


class DynamicQRRedirectView(View):
    """
    Handle dynamic QR code redirections.
    Uses unified analytics tracking via track_qr_scan task.
    """

    def get(self, request, short_code):
        try:
            qr = QRCode.objects.select_related("link", "campaign").get(
                short_code=short_code, is_dynamic=True
            )
        except QRCode.DoesNotExist:
            return HttpResponseNotFound("QR code not found")

        redirect_url = qr.get_redirect_url()
        if not redirect_url:
            return HttpResponseNotFound("No destination configured for this QR code")

        # Evaluate conditional rules
        rule_result = self._evaluate_rules(request, qr, redirect_url)
        if rule_result:
            # Track scan before returning rule result
            self._track_scan(request, qr)
            return rule_result

        # Track scan asynchronously using unified tracking
        self._track_scan(request, qr)

        return HttpResponseRedirect(redirect_url)

    def _track_scan(self, request, qr):
        """Queue scan tracking to Celery using unified ClickEvent model."""
        from .tasks import track_qr_scan

        scan_data = {
            "qr_id": str(qr.id),
            "scanned_at": timezone.now().isoformat(),
            "ip": self._get_client_ip(request),
            "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            "referer": request.META.get("HTTP_REFERER", ""),
        }

        try:
            track_qr_scan.delay(scan_data)
        except Exception:
            pass  # Don't fail the redirect if tracking fails

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")

    def _evaluate_rules(self, request, qr, original_url):
        """
        Evaluate conditional rules for the QR code.
        Returns a response if a rule matches, None otherwise.
        """
        # Get active rules for this QR code
        rules = get_rules_for_qr_code(qr, active_only=True)
        if not rules.exists():
            return None

        # Build context from request
        context = RuleEngine.build_context(request, qr_code=qr)

        # Evaluate rules
        result = RuleEngine.evaluate(rules, context)
        if not result:
            return None

        # Apply the matching action
        action_result = RuleEngine.apply_action(
            result["action"],
            result["value"],
            original_url
        )

        # Handle different action types
        if action_result["type"] == "redirect":
            return HttpResponseRedirect(action_result["url"])

        elif action_result["type"] == "block":
            return HttpResponseForbidden(action_result.get("message", "Access denied"))

        elif action_result["type"] == "content":
            template = action_result.get("template", "qrcodes/custom_content.html")
            return render(request, template, action_result.get("data", {}))

        return None


class QRCodeListCreateView(generics.ListCreateAPIView):
    """
    List user's QR codes or create a new one.
    """
    permission_classes = [IsAuthenticated, CanCreateQRCodes]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['style']
    search_fields = ['link__short_code', 'link__original_url', 'link__title']
    ordering_fields = ['created_at', 'total_scans']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateQRCodeSerializer
        return QRCodeSerializer
    
    def get_queryset(self):
        # Team-scoped queryset
        if self.request.team:
            return QRCode.objects.filter(team=self.request.team).select_related("link", "user")
        return QRCode.objects.filter(user=self.request.user, team__isnull=True).select_related("link")

    @extend_schema(tags=["QR Codes"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=CreateQRCodeSerializer,
        responses={201: QRCodeSerializer},
        tags=["QR Codes"]
    )
    def post(self, request, *args, **kwargs):
        serializer = CreateQRCodeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        qr = serializer.save()
        return Response(QRCodeSerializer(qr).data, status=status.HTTP_201_CREATED)


class QRCodeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Get, update, or delete a QR code.
    """
    permission_classes = [IsAuthenticated, IsOwner]
    
    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return UpdateQRCodeSerializer
        return QRCodeSerializer
    
    def get_queryset(self):
        # Team-scoped queryset
        if self.request.team:
            return QRCode.objects.filter(team=self.request.team).select_related("link", "user")
        return QRCode.objects.filter(user=self.request.user, team__isnull=True).select_related("link")

    @extend_schema(tags=["QR Codes"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=UpdateQRCodeSerializer,
        responses={200: QRCodeSerializer},
        tags=["QR Codes"]
    )
    def patch(self, request, *args, **kwargs):
        qr = self.get_object()
        serializer = UpdateQRCodeSerializer(data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        qr = serializer.update(qr, serializer.validated_data)
        return Response(QRCodeSerializer(qr).data)
    
    @extend_schema(tags=["QR Codes"])
    def delete(self, request, *args, **kwargs):
        # Industry standard: QR codes/month counts creations, not decremented on delete
        return super().delete(request, *args, **kwargs)


class QRCodeDownloadView(APIView):
    """
    Download QR code in specified format.
    Returns actual file blob for direct download.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("format", str, description="File format: png, svg, pdf"),
        ],
        tags=["QR Codes"]
    )
    def get(self, request, pk):
        team = getattr(request, "team", None)
        qr_filter = {"pk": pk}
        if team:
            qr_filter["team"] = team
        else:
            qr_filter["user"] = request.user
            qr_filter["team__isnull"] = True
        try:
            qr = QRCode.objects.select_related("link").get(**qr_filter)
        except QRCode.DoesNotExist:
            return Response({"error": "QR code not found"}, status=status.HTTP_404_NOT_FOUND)

        format = request.query_params.get("format", "png").lower()

        if format not in ("png", "svg", "pdf"):
            return Response({"error": "Invalid format"}, status=status.HTTP_400_BAD_REQUEST)

        # Generate filename based on link or short_code
        if qr.link:
            filename = f"qr-{qr.link.short_code}.{format}"
        elif qr.short_code:
            filename = f"qr-{qr.short_code}.{format}"
        else:
            filename = f"qr-{str(qr.id)[:8]}.{format}"

        # Generate file content
        if format == "png":
            content = qr.generate_png(size=1024)
            content_type = "image/png"
        elif format == "svg":
            content = qr.generate_svg().encode('utf-8')
            content_type = "image/svg+xml"
        else:  # pdf
            content = qr.generate_pdf()
            content_type = "application/pdf"

        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = len(content)
        return response


class QRCodePreviewView(APIView):
    """
    Get a preview of a QR code without creating it.
    Useful for design preview with full styling options.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["QR Codes"])
    def post(self, request):
        import base64
        from apps.links.models import Link
        from .rendering import render_png

        # Get parameters
        link_id = request.data.get("link_id")
        qr_type = request.data.get("qr_type", "link")
        content_data = request.data.get("content_data", {})

        # Determine content string for preview
        content = "https://example.com"
        if qr_type == "link" and link_id:
            team = getattr(request, "team", None)
            link_filter = {"id": link_id}
            if team:
                link_filter["team"] = team
            else:
                link_filter["user"] = request.user
                link_filter["team__isnull"] = True
            try:
                link = Link.objects.get(**link_filter)
                content = link.short_url
            except Link.DoesNotExist:
                return Response({"error": "Link not found"}, status=status.HTTP_404_NOT_FOUND)
        elif qr_type == "text":
            content = content_data.get("text", "Preview")
        elif qr_type == "phone":
            content = f"tel:{content_data.get('phone', '+1234567890')}"
        else:
            # For types with schemas, try to encode
            try:
                from .content import encode_content
                encoded = encode_content(qr_type, content_data)
                if encoded:
                    content = encoded
            except Exception:
                pass  # fall back to default

        # Generate preview PNG directly from renderer (no temp model needed)
        png_bytes = render_png(
            content=content,
            size=300,
            style=request.data.get("style", "square"),
            frame=request.data.get("frame", "none"),
            frame_text=request.data.get("frame_text", ""),
            fg_color=request.data.get("foreground_color", "#000000"),
            bg_color=request.data.get("background_color", "#FFFFFF"),
            eye_style=request.data.get("eye_style", "square"),
            eye_color=request.data.get("eye_color", ""),
            logo_url="",  # skip logo for preview speed
            gradient_enabled=request.data.get("gradient_enabled", False),
            gradient_start=request.data.get("gradient_start", ""),
            gradient_end=request.data.get("gradient_end", ""),
            gradient_direction=request.data.get("gradient_direction", "vertical"),
        )
        base64_image = base64.b64encode(png_bytes).decode()

        return Response({
            "preview": f"data:image/png;base64,{base64_image}",
        })


# =============================================================================
# FRAMED QR CODE GENERATION
# =============================================================================

class QRCodeFramedDownloadView(APIView):
    """
    Download QR code with server-side generated frame.
    Uses the image_generator module for advanced frame styles.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("frame", str, description="Frame style: simple, scan_me, badge, ticket, tag, certificate, card"),
            OpenApiParameter("text", str, description="Custom text for the frame"),
            OpenApiParameter("size", int, description="Output size in pixels (default: 512)"),
        ],
        tags=["QR Codes"]
    )
    def get(self, request, pk):
        from .image_generator import QRImageGenerator

        team = getattr(request, "team", None)
        qr_filter = {"pk": pk}
        if team:
            qr_filter["team"] = team
        else:
            qr_filter["user"] = request.user
            qr_filter["team__isnull"] = True
        try:
            qr = QRCode.objects.select_related("link").get(**qr_filter)
        except QRCode.DoesNotExist:
            return Response({"error": "QR code not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get frame parameters
        frame_style = request.query_params.get("frame", qr.frame or "simple")
        frame_text = request.query_params.get("text", qr.frame_text or "SCAN ME")
        try:
            size = int(request.query_params.get("size", 512))
            size = max(256, min(2048, size))  # Clamp to valid range
        except ValueError:
            size = 512

        # Generate filename
        if qr.link:
            filename = f"qr-{qr.link.short_code}-framed.png"
        elif qr.short_code:
            filename = f"qr-{qr.short_code}-framed.png"
        else:
            filename = f"qr-{str(qr.id)[:8]}-framed.png"

        # Generate framed image using the image generator
        generator = QRImageGenerator()
        img = generator.generate(
            content=qr.short_url,
            size=size,
            style=qr.style,
            frame=frame_style,
            frame_text=frame_text,
            fg_color=qr.foreground_color,
            bg_color=qr.background_color,
            eye_style=qr.eye_style,
            eye_color=qr.eye_color or "",
            logo_url=qr.logo_url,
            gradient_enabled=qr.gradient_enabled,
            gradient_start=qr.gradient_start,
            gradient_end=qr.gradient_end,
            gradient_direction=qr.gradient_direction,
        )

        buffer = io.BytesIO()
        img.save(buffer, format="PNG", quality=95)
        content = buffer.getvalue()

        response = HttpResponse(content, content_type="image/png")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = len(content)
        return response


# =============================================================================
# BATCH DOWNLOAD
# =============================================================================

class QRCodeBatchDownloadView(APIView):
    """Download multiple QR codes as a ZIP file."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["QR Codes"])
    def post(self, request):
        import zipfile
        from io import BytesIO
        from django.http import HttpResponse
        from datetime import datetime
        
        qr_ids = request.data.get("qr_ids", [])
        format = request.data.get("format", "png").lower()
        
        if not qr_ids:
            return Response({"error": "No QR codes specified"}, status=status.HTTP_400_BAD_REQUEST)
        
        if len(qr_ids) > 50:
            return Response({"error": "Maximum 50 QR codes at once"}, status=status.HTTP_400_BAD_REQUEST)
        
        if format not in ("png", "svg"):
            return Response({"error": "Invalid format. Use png or svg"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get user's/team's QR codes
        team = getattr(request, "team", None)
        qr_qs = QRCode.objects.filter(id__in=qr_ids)
        if team:
            qr_qs = qr_qs.filter(team=team)
        else:
            qr_qs = qr_qs.filter(user=request.user, team__isnull=True)
        qr_codes = qr_qs.select_related("link")
        
        if not qr_codes:
            return Response({"error": "No QR codes found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Create ZIP file
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for qr in qr_codes:
                # Generate filename based on link or short_code
                if qr.link:
                    filename = f"qr-{qr.link.short_code}.{format}"
                elif qr.short_code:
                    filename = f"qr-{qr.short_code}.{format}"
                else:
                    filename = f"qr-{str(qr.id)[:8]}.{format}"

                if format == "png":
                    content = qr.generate_png()
                else:
                    content = qr.generate_svg().encode()

                zf.writestr(filename, content)

        zip_buffer.seek(0)
        
        response = HttpResponse(zip_buffer.read(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="qr-codes-{datetime.now().strftime("%Y%m%d")}.zip"'

        return response


# =============================================================================
# SERIAL BATCH VIEWS
# =============================================================================

from .models import SerialBatch, SerialCode
from .serializers import (
    SerialBatchSerializer, CreateSerialBatchSerializer, SerialBatchProgressSerializer,
    SerialCodeSerializer, SerialCodeDetailSerializer, UpdateSerialCodeStatusSerializer
)


class SerialBatchListCreateView(generics.ListCreateAPIView):
    """
    List user's serial batches or create a new one.
    Business plan required.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status"]
    search_fields = ["name", "product_name", "product_sku"]
    ordering_fields = ["created_at", "quantity", "generated_count"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateSerialBatchSerializer
        return SerialBatchSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return SerialBatch.objects.filter(team=team)
        return SerialBatch.objects.filter(user=self.request.user, team__isnull=True)

    @extend_schema(tags=["Serial Batches"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=CreateSerialBatchSerializer,
        responses={201: SerialBatchSerializer},
        tags=["Serial Batches"]
    )
    def post(self, request, *args, **kwargs):
        serializer = CreateSerialBatchSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        batch = serializer.save()
        return Response(SerialBatchSerializer(batch).data, status=status.HTTP_201_CREATED)


class SerialBatchDetailView(generics.RetrieveDestroyAPIView):
    """
    Get or delete a serial batch.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SerialBatchSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return SerialBatch.objects.filter(team=team)
        return SerialBatch.objects.filter(user=self.request.user, team__isnull=True)

    @extend_schema(tags=["Serial Batches"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(tags=["Serial Batches"])
    def delete(self, request, *args, **kwargs):
        batch = self.get_object()
        # Cancel if still processing
        if batch.status == "processing":
            from .tasks import cancel_serial_batch
            cancel_serial_batch.delay(str(batch.id))
        return super().delete(request, *args, **kwargs)


class SerialBatchProgressView(APIView):
    """
    Get progress of serial batch generation.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: SerialBatchProgressSerializer},
        tags=["Serial Batches"]
    )
    def get(self, request, pk):
        team = getattr(request, "team", None)
        batch_filter = {"pk": pk}
        if team:
            batch_filter["team"] = team
        else:
            batch_filter["user"] = request.user
            batch_filter["team__isnull"] = True

        try:
            batch = SerialBatch.objects.get(**batch_filter)
        except SerialBatch.DoesNotExist:
            return Response({"error": "Batch not found"}, status=status.HTTP_404_NOT_FOUND)

        data = {
            "batch_id": batch.id,
            "status": batch.status,
            "quantity": batch.quantity,
            "generated_count": batch.generated_count,
            "progress_percent": batch.progress_percent,
            "error_message": batch.error_message,
            "export_file_url": batch.export_file_url if batch.can_download else "",
            "started_at": batch.started_at,
            "completed_at": batch.completed_at,
        }

        return Response(data)


class SerialBatchStartView(APIView):
    """
    Start generation of a pending serial batch.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Serial Batches"])
    def post(self, request, pk):
        from .tasks import generate_serial_batch

        team = getattr(request, "team", None)
        batch_filter = {"pk": pk}
        if team:
            batch_filter["team"] = team
        else:
            batch_filter["user"] = request.user
            batch_filter["team__isnull"] = True

        try:
            batch = SerialBatch.objects.get(**batch_filter)
        except SerialBatch.DoesNotExist:
            return Response({"error": "Batch not found"}, status=status.HTTP_404_NOT_FOUND)

        if batch.status != "pending":
            return Response(
                {"error": f"Cannot start batch with status '{batch.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Start generation
        generate_serial_batch.delay(str(batch.id))

        return Response({"status": "started", "batch_id": str(batch.id)})


class SerialBatchCancelView(APIView):
    """
    Cancel an in-progress serial batch generation.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Serial Batches"])
    def post(self, request, pk):
        from .tasks import cancel_serial_batch

        team = getattr(request, "team", None)
        batch_filter = {"pk": pk}
        if team:
            batch_filter["team"] = team
        else:
            batch_filter["user"] = request.user
            batch_filter["team__isnull"] = True

        try:
            batch = SerialBatch.objects.get(**batch_filter)
        except SerialBatch.DoesNotExist:
            return Response({"error": "Batch not found"}, status=status.HTTP_404_NOT_FOUND)

        if batch.status not in ("pending", "processing"):
            return Response(
                {"error": f"Cannot cancel batch with status '{batch.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        cancel_serial_batch.delay(str(batch.id))

        return Response({"status": "cancelling", "batch_id": str(batch.id)})


class SerialBatchDownloadView(APIView):
    """
    Download the completed batch export file.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Serial Batches"])
    def get(self, request, pk):
        team = getattr(request, "team", None)
        batch_filter = {"pk": pk}
        if team:
            batch_filter["team"] = team
        else:
            batch_filter["user"] = request.user
            batch_filter["team__isnull"] = True

        try:
            batch = SerialBatch.objects.get(**batch_filter)
        except SerialBatch.DoesNotExist:
            return Response({"error": "Batch not found"}, status=status.HTTP_404_NOT_FOUND)

        if not batch.can_download:
            return Response(
                {"error": "Batch export is not available for download"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Return JSON with download URL (ensure absolute URL for dev mode)
        download_url = batch.export_file_url
        if download_url and not download_url.startswith(('http://', 'https://')):
            download_url = request.build_absolute_uri(download_url)

        return Response({
            "download_url": download_url,
            "expires_at": None,
        })


class SerialBatchStatsView(APIView):
    """
    Get statistics for a serial batch.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Serial Batches"])
    def get(self, request, pk):
        from django.db.models import Count
        from django.db.models.functions import TruncDate
        from datetime import timedelta
        from .models import SerialBatch, SerialCode

        team = getattr(request, "team", None)
        batch_filter = {"pk": pk}
        if team:
            batch_filter["team"] = team
        else:
            batch_filter["user"] = request.user

        try:
            batch = SerialBatch.objects.get(**batch_filter)
        except SerialBatch.DoesNotExist:
            return Response({"error": "Batch not found"}, status=status.HTTP_404_NOT_FOUND)

        codes = SerialCode.objects.filter(batch=batch)

        # Status distribution
        status_distribution = dict(
            codes.values("status").annotate(count=Count("id")).values_list("status", "count")
        )

        # Daily scans (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        daily_scans = list(
            codes.filter(first_scanned_at__gte=thirty_days_ago)
            .annotate(date=TruncDate("first_scanned_at"))
            .values("date")
            .annotate(count=Count("id"))
            .order_by("date")
            .values("date", "count")
        )
        # Format dates as strings
        for scan in daily_scans:
            if scan["date"]:
                scan["date"] = scan["date"].strftime("%Y-%m-%d")

        # Top countries using DB aggregation on first_scan_country
        top_countries = list(
            codes.exclude(first_scan_country="")
            .values("first_scan_country")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
            .values("first_scan_country", "count")
        )
        top_countries = [
            {"country": row["first_scan_country"], "count": row["count"]}
            for row in top_countries
        ]

        # Suspicious scans
        suspicious_codes = codes.filter(status="suspicious")
        suspicious_scans = [
            {
                "serial": code.serial_number,
                "reason": code.status_reason or "Multiple scans from different locations",
                "timestamp": code.first_scanned_at.isoformat() if code.first_scanned_at else None,
            }
            for code in suspicious_codes[:20]
        ]

        stats = {
            "total_codes": codes.count(),
            "scanned_codes": codes.exclude(first_scanned_at=None).count(),
            "active_codes": codes.filter(status="active").count(),
            "suspicious_codes": suspicious_codes.count(),
            "blocked_codes": codes.filter(status="blocked").count(),
            "total_scans": codes.exclude(first_scanned_at=None).count(),
            "unique_scanners": codes.exclude(first_scanned_at=None).values("first_scan_ip_hash").distinct().count(),
            "scan_rate": round(
                (codes.exclude(first_scanned_at=None).count() / max(codes.count(), 1)) * 100, 1
            ),
            "status_distribution": status_distribution,
            "daily_scans": daily_scans,
            "top_countries": top_countries,
            "suspicious_scans": suspicious_scans,
        }

        return Response(stats)


class SerialCodeListView(generics.ListAPIView):
    """
    List serial codes for a batch.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SerialCodeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status"]
    search_fields = ["serial_number"]
    ordering_fields = ["created_at", "first_scanned_at", "total_scans", "suspicion_score"]
    ordering = ["-created_at"]

    def get_queryset(self):
        batch_id = self.kwargs.get("batch_id")

        # Verify batch ownership
        team = getattr(self.request, "team", None)
        batch_filter = {"id": batch_id}
        if team:
            batch_filter["team"] = team
        else:
            batch_filter["user"] = self.request.user
            batch_filter["team__isnull"] = True

        if not SerialBatch.objects.filter(**batch_filter).exists():
            return SerialCode.objects.none()

        return SerialCode.objects.filter(batch_id=batch_id).select_related("qr_code")

    @extend_schema(tags=["Serial Codes"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class SerialCodeDetailView(generics.RetrieveAPIView):
    """
    Get details of a serial code by serial number string.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SerialCodeDetailSerializer
    lookup_field = "serial_number"
    lookup_url_kwarg = "serial"

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return SerialCode.objects.filter(batch__team=team).select_related("qr_code", "batch")
        return SerialCode.objects.filter(
            batch__user=self.request.user, batch__team__isnull=True
        ).select_related("qr_code", "batch")

    @extend_schema(tags=["Serial Codes"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class SerialCodeUpdateStatusView(APIView):
    """
    Update status of a serial code (block, recall, reactivate).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=UpdateSerialCodeStatusSerializer,
        responses={200: SerialCodeDetailSerializer},
        tags=["Serial Codes"]
    )
    def patch(self, request, pk):
        team = getattr(request, "team", None)
        code_filter = {"pk": pk}
        if team:
            code_filter["batch__team"] = team
        else:
            code_filter["batch__user"] = request.user
            code_filter["batch__team__isnull"] = True

        try:
            code = SerialCode.objects.select_related("qr_code", "batch").get(**code_filter)
        except SerialCode.DoesNotExist:
            return Response({"error": "Serial code not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateSerialCodeStatusSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        code = serializer.update(code, serializer.validated_data)

        return Response(SerialCodeDetailSerializer(code).data)


class SerialCodeLookupView(APIView):
    """
    Look up a serial code by serial number.
    For internal use (not public verification).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Serial Codes"])
    def get(self, request):
        serial_number = request.query_params.get("serial")
        if not serial_number:
            return Response({"error": "Serial number required"}, status=status.HTTP_400_BAD_REQUEST)

        team = getattr(request, "team", None)
        code_filter = {"serial_number": serial_number.upper()}
        if team:
            code_filter["batch__team"] = team
        else:
            code_filter["batch__user"] = request.user
            code_filter["batch__team__isnull"] = True

        try:
            code = SerialCode.objects.select_related("qr_code", "batch").get(**code_filter)
        except SerialCode.DoesNotExist:
            return Response({"error": "Serial code not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(SerialCodeDetailSerializer(code).data)