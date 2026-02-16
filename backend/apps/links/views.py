"""
Views for links app.
CRUD operations and link management.
"""

from django.db.models import Q
from rest_framework import status, generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import AnonRateThrottle
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.users.permissions import CanCreateLinks, IsOwner
from apps.users.models import UsageTracking
from .models import Link, CustomDomain, RetargetingPixel
from .serializers import (
    LinkSerializer, CreateLinkSerializer, UpdateLinkSerializer,
    BulkCreateLinksSerializer, CustomDomainSerializer, CreateCustomDomainSerializer,
    RetargetingPixelSerializer, CreatePixelSerializer, UpdatePixelSerializer,
)


class LinkListCreateView(generics.ListCreateAPIView):
    """
    List user's links or create a new link.
    """
    permission_classes = [IsAuthenticated, CanCreateLinks]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "campaign"]
    search_fields = ["short_code", "original_url", "title"]
    ordering_fields = ["created_at", "total_clicks", "title"]
    ordering = ["-created_at"]
    
    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateLinkSerializer
        return LinkSerializer
    
    def get_queryset(self):
        # Team-scoped queryset
        if self.request.team:
            return Link.objects.filter(team=self.request.team).select_related("domain", "campaign", "user")
        return Link.objects.filter(user=self.request.user, team__isnull=True).select_related("domain", "campaign")

    @extend_schema(
        parameters=[
            OpenApiParameter("search", str, description="Search in short_code, url, title"),
            OpenApiParameter("is_active", bool, description="Filter by active status"),
            OpenApiParameter("campaign", str, description="Filter by campaign ID"),
        ],
        tags=["Links"]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
    
    @extend_schema(
        request=CreateLinkSerializer,
        responses={201: LinkSerializer},
        tags=["Links"]
    )
    def post(self, request, *args, **kwargs):
        serializer = CreateLinkSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        link = serializer.save()
        
        response_data = LinkSerializer(link).data
        
        # Create QR code if requested
        if getattr(link, "_create_qr", False):
            from apps.qrcodes.models import QRCode
            from apps.qrcodes.serializers import QRCodeSerializer
            
            qr = QRCode.objects.create(
                link=link, 
                user=request.user,
                team=request.team,  # Team context
                style=getattr(link, "_qr_style", "square"),
                frame=getattr(link, "_qr_frame", "none"),
                foreground_color=getattr(link, "_qr_foreground_color", "#000000"),
                background_color=getattr(link, "_qr_background_color", "#FFFFFF")
            )
            response_data["qr_code"] = QRCodeSerializer(qr).data
        
        return Response(response_data, status=status.HTTP_201_CREATED)


class LinkDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Get, update, or delete a link.
    """
    permission_classes = [IsAuthenticated, IsOwner]
    
    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return UpdateLinkSerializer
        return LinkSerializer
    
    def get_queryset(self):
        # Team-scoped queryset
        if self.request.team:
            return Link.objects.filter(team=self.request.team).select_related("domain", "campaign", "user")
        return Link.objects.filter(user=self.request.user, team__isnull=True).select_related("domain", "campaign")

    @extend_schema(tags=["Links"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=UpdateLinkSerializer,
        responses={200: LinkSerializer},
        tags=["Links"]
    )
    def patch(self, request, *args, **kwargs):
        link = self.get_object()
        serializer = UpdateLinkSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        link = serializer.update(link, serializer.validated_data)
        return Response(LinkSerializer(link).data)
    
    @extend_schema(tags=["Links"])
    def delete(self, request, *args, **kwargs):
        # Industry standard: links/month counts creations, not decremented on delete
        return super().delete(request, *args, **kwargs)


class LinkStatsView(APIView):
    """
    Get detailed statistics for a link.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d, all"),
        ],
        tags=["Links"]
    )
    def get(self, request, pk):
        team = getattr(request, "team", None)
        link_filter = {"pk": pk}
        if team:
            link_filter["team"] = team
        else:
            link_filter["user"] = request.user
            link_filter["team__isnull"] = True
        try:
            link = Link.objects.get(**link_filter)
        except Link.DoesNotExist:
            return Response({"error": "Link not found"}, status=status.HTTP_404_NOT_FOUND)

        period = request.query_params.get("period", "30d")

        # Get stats from analytics
        from apps.analytics.services import get_link_stats
        stats = get_link_stats(link.id, period)

        return Response(stats)


class LinkDuplicateView(APIView):
    """
    Duplicate a link.
    """
    permission_classes = [IsAuthenticated, CanCreateLinks]
    
    @extend_schema(
        responses={201: LinkSerializer},
        tags=["Links"]
    )
    def post(self, request, pk):
        team = getattr(request, "team", None)
        link_filter = {"pk": pk}
        if team:
            link_filter["team"] = team
        else:
            link_filter["user"] = request.user
            link_filter["team__isnull"] = True
        try:
            original = Link.objects.get(**link_filter)
        except Link.DoesNotExist:
            return Response({"error": "Link not found"}, status=status.HTTP_404_NOT_FOUND)

        # Create duplicate
        new_link = Link.objects.create(
            user=request.user,
            team=team,
            original_url=original.original_url,
            title=f"{original.title} (copy)" if original.title else "",
            domain=original.domain,
            campaign=original.campaign,
            utm_source=original.utm_source,
            utm_medium=original.utm_medium,
            utm_campaign=original.utm_campaign,
            utm_term=original.utm_term,
            utm_content=original.utm_content,
            expires_at=original.expires_at,
        )
        
        # Track usage
        usage = UsageTracking.get_current_period(request.user)
        usage.increment_links()
        
        return Response(LinkSerializer(new_link).data, status=status.HTTP_201_CREATED)


class BulkCreateLinksView(APIView):
    """
    Create multiple links at once.
    """
    permission_classes = [IsAuthenticated, CanCreateLinks]
    
    @extend_schema(
        request=BulkCreateLinksSerializer,
        tags=["Links"]
    )
    def post(self, request):
        serializer = BulkCreateLinksSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        urls = serializer.validated_data["urls"]
        campaign_id = serializer.validated_data.get("campaign_id")
        
        # Check limits
        user = request.user
        subscription = getattr(user, "subscription", None)
        usage = UsageTracking.get_current_period(user)
        limit = subscription.limits.get("links_per_month", 50)
        
        if limit != -1 and (usage.links_created + len(urls)) > limit:
            return Response({
                "error": f"Creating {len(urls)} links would exceed your monthly limit"
            }, status=status.HTTP_403_FORBIDDEN)
        
        created_links = []
        errors = []
        
        for url in urls:
            # Validate URL
            is_valid, error = Link.validate_url(url)
            if not is_valid:
                errors.append({"url": url, "error": error})
                continue
            
            # Create link
            try:
                link = Link.objects.create(
                    user=user,
                    team=getattr(request, "team", None),
                    original_url=url,
                    campaign_id=campaign_id,
                )
                created_links.append(link)
                usage.increment_links()
            except Exception as e:
                errors.append({"url": url, "error": str(e)})
        
        return Response({
            "links": LinkSerializer(created_links, many=True).data,
            "errors": errors,
        }, status=status.HTTP_201_CREATED)


# =============================================================================
# CUSTOM DOMAIN VIEWS
# =============================================================================

class CustomDomainListCreateView(generics.ListCreateAPIView):
    """
    List and create custom domains.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CustomDomainSerializer
    pagination_class = None
    
    def get_queryset(self):
        # Team-scoped queryset
        if self.request.team:
            return CustomDomain.objects.filter(team=self.request.team)
        return CustomDomain.objects.filter(user=self.request.user, team__isnull=True)

    @extend_schema(
        request=CreateCustomDomainSerializer,
        responses={201: CustomDomainSerializer},
        tags=["Custom Domains"]
    )
    def post(self, request, *args, **kwargs):
        # Check domain limit
        subscription = getattr(request.user, "subscription", None)
        limit = subscription.limits.get("custom_domains", 0) if subscription else 0
        current_count = self.get_queryset().count()
        
        if current_count >= limit:
            return Response({
                "error": f"You can only have {limit} custom domain(s) on your plan"
            }, status=status.HTTP_403_FORBIDDEN)
        
        serializer = CreateCustomDomainSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        domain = CustomDomain.objects.create(
            user=request.user,
            team=request.team,  # Team context
            domain=serializer.validated_data["domain"],
        )
        
        return Response(CustomDomainSerializer(domain).data, status=status.HTTP_201_CREATED)


class CustomDomainDetailView(generics.RetrieveDestroyAPIView):
    """
    Get or delete a custom domain.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CustomDomainSerializer
    
    def get_queryset(self):
        # Team-scoped queryset
        if self.request.team:
            return CustomDomain.objects.filter(team=self.request.team)
        return CustomDomain.objects.filter(user=self.request.user, team__isnull=True)

    def destroy(self, request, *args, **kwargs):
        domain = self.get_object()
        
        # Check if domain has active links
        if domain.links.filter(is_active=True).exists():
            return Response({
                "error": "Cannot delete domain with active links"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return super().destroy(request, *args, **kwargs)


class CustomDomainVerifyView(APIView):
    """
    Verify domain DNS configuration.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        responses={200: CustomDomainSerializer},
        tags=["Custom Domains"]
    )
    def post(self, request, pk):
        team = getattr(request, "team", None)
        domain_filter = {"pk": pk}
        if team:
            domain_filter["team"] = team
        else:
            domain_filter["user"] = request.user
            domain_filter["team__isnull"] = True
        try:
            domain = CustomDomain.objects.get(**domain_filter)
        except CustomDomain.DoesNotExist:
            return Response({"error": "Domain not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if domain.is_verified:
            return Response({"message": "Domain is already verified"})
        
        # Trigger verification (async in production)
        verified = domain.verify_dns()
        
        if verified:
            return Response(CustomDomainSerializer(domain).data)
        else:
            return Response({
                "error": "DNS verification failed. Please ensure the TXT record is configured correctly.",
                "dns_txt_record": domain.dns_txt_record,
            }, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# ANONYMOUS LINK CREATION
# =============================================================================

class PublicLinkCreateThrottle(AnonRateThrottle):
    """Strict rate limit for anonymous link creation: 5 per hour."""
    rate = "5/hour"


class PublicLinkCreateView(APIView):
    """
    Create a link without authentication (rate limited).
    """
    permission_classes = [AllowAny]
    throttle_classes = [PublicLinkCreateThrottle]
    
    @extend_schema(
        request=CreateLinkSerializer,
        responses={201: LinkSerializer},
        tags=["Links"]
    )
    def post(self, request):
        # Only allow basic link creation
        serializer = CreateLinkSerializer(
            data={"original_url": request.data.get("original_url")},
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        link = serializer.save()
        
        return Response(LinkSerializer(link).data, status=status.HTTP_201_CREATED)


# =============================================================================
# BULK OPERATIONS
# =============================================================================

class BulkDeleteLinksView(APIView):
    """Delete multiple links at once."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Links"])
    def post(self, request):
        link_ids = request.data.get("link_ids", [])
        
        if not link_ids:
            return Response({"error": "No links specified"}, status=status.HTTP_400_BAD_REQUEST)
        
        if len(link_ids) > 100:
            return Response({"error": "Maximum 100 links at once"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Delete only user's/team's links
        # Industry standard: links/month counts creations, not decremented on delete
        team = getattr(request, "team", None)
        link_qs = Link.objects.filter(id__in=link_ids)
        if team:
            link_qs = link_qs.filter(team=team)
        else:
            link_qs = link_qs.filter(user=request.user, team__isnull=True)
        deleted_count, _ = link_qs.delete()
        
        return Response({
            "deleted": deleted_count,
            "requested": len(link_ids)
        })


class CheckSlugAvailabilityView(APIView):
    """Check if a custom slug is available."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Links"],
        parameters=[
            OpenApiParameter(name="slug", type=str, required=True),
            OpenApiParameter(name="domain_id", type=str, required=False),
        ],
    )
    def get(self, request):
        slug = request.query_params.get("slug", "").strip()
        domain_id = request.query_params.get("domain_id")

        if not slug:
            return Response(
                {"available": False, "error": "Slug is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        domain = None
        if domain_id:
            try:
                domain = CustomDomain.objects.get(
                    id=domain_id, user=request.user, is_verified=True
                )
            except CustomDomain.DoesNotExist:
                return Response(
                    {"available": False, "error": "Invalid or unverified domain"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        is_valid, error = Link.validate_slug(slug, domain)
        return Response({"available": is_valid, "error": error})


class BulkMoveLinksView(APIView):
    """Move multiple links to a campaign."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Links"])
    def post(self, request):
        from apps.campaigns.models import Campaign
        
        link_ids = request.data.get("link_ids", [])
        campaign_id = request.data.get("campaign_id")
        
        if not link_ids:
            return Response({"error": "No links specified"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify campaign ownership (or None to remove from campaign)
        team = getattr(request, "team", None)
        if campaign_id:
            camp_filter = {"id": campaign_id}
            if team:
                camp_filter["team"] = team
            else:
                camp_filter["user"] = request.user
            if not Campaign.objects.filter(**camp_filter).exists():
                return Response({"error": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)

        # Update links
        link_qs = Link.objects.filter(id__in=link_ids)
        if team:
            link_qs = link_qs.filter(team=team)
        else:
            link_qs = link_qs.filter(user=request.user, team__isnull=True)
        updated_count = link_qs.update(campaign_id=campaign_id)
        
        return Response({
            "updated": updated_count,
            "requested": len(link_ids)
        })


class BulkExportLinksView(APIView):
    """Export selected links."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Links"])
    def post(self, request):
        import csv
        import json
        from io import StringIO
        from django.http import HttpResponse
        from datetime import datetime
        
        link_ids = request.data.get("link_ids", [])
        export_format = request.data.get("format", "csv")
        
        if not link_ids:
            return Response({"error": "No links specified"}, status=status.HTTP_400_BAD_REQUEST)
        
        team = getattr(request, "team", None)
        link_qs = Link.objects.filter(id__in=link_ids)
        if team:
            link_qs = link_qs.filter(team=team)
        else:
            link_qs = link_qs.filter(user=request.user, team__isnull=True)
        links = link_qs.select_related("domain", "campaign")
        
        if export_format == "json":
            data = []
            for link in links:
                data.append({
                    "short_code": link.short_code,
                    "short_url": link.short_url,
                    "original_url": link.original_url,
                    "title": link.title,
                    "total_clicks": link.total_clicks,
                    "campaign": link.campaign.name if link.campaign else None,
                    "created_at": link.created_at.isoformat(),
                })
            
            response = HttpResponse(json.dumps(data, indent=2), content_type="application/json")
            response["Content-Disposition"] = f'attachment; filename="links-{datetime.now().strftime("%Y%m%d")}.json"'
            return response
        
        else:  # CSV
            response = HttpResponse(content_type="text/csv")
            response["Content-Disposition"] = f'attachment; filename="links-{datetime.now().strftime("%Y%m%d")}.csv"'
            
            writer = csv.writer(response)
            writer.writerow(["Short Code", "Short URL", "Original URL", "Title", "Clicks", "Campaign", "Created"])
            
            for link in links:
                writer.writerow([
                    link.short_code,
                    link.short_url,
                    link.original_url,
                    link.title,
                    link.total_clicks,
                    link.campaign.name if link.campaign else "",
                    link.created_at.strftime("%Y-%m-%d"),
                ])

            return response


# =============================================================================
# RETARGETING PIXELS
# =============================================================================


class PixelListCreateView(generics.ListCreateAPIView):
    """List or create retargeting pixels."""
    permission_classes = [IsAuthenticated]
    serializer_class = RetargetingPixelSerializer
    pagination_class = None
    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return RetargetingPixel.objects.filter(team=team)
        return RetargetingPixel.objects.filter(user=self.request.user, team__isnull=True)

    @extend_schema(request=CreatePixelSerializer, responses={201: RetargetingPixelSerializer}, tags=["Pixels"])
    def post(self, request, *args, **kwargs):
        serializer = CreatePixelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        team = getattr(request, "team", None)
        pixel = RetargetingPixel.objects.create(
            user=request.user,
            team=team,
            **serializer.validated_data,
        )
        return Response(
            RetargetingPixelSerializer(pixel).data,
            status=status.HTTP_201_CREATED,
        )


class PixelDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a retargeting pixel."""
    permission_classes = [IsAuthenticated]
    serializer_class = RetargetingPixelSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return RetargetingPixel.objects.filter(team=team)
        return RetargetingPixel.objects.filter(user=self.request.user, team__isnull=True)

    @extend_schema(request=UpdatePixelSerializer, responses={200: RetargetingPixelSerializer}, tags=["Pixels"])
    def patch(self, request, *args, **kwargs):
        pixel = self.get_object()
        serializer = UpdatePixelSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(pixel, field, value)
        pixel.save()

        return Response(RetargetingPixelSerializer(pixel).data)
