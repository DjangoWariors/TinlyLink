"""
Views for analytics app.
"""

from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .services import (
    get_user_overview, get_clicks_chart_data, get_geography_stats,
    get_device_stats, get_referrer_stats
)
from .serializers import (
    OverviewStatsSerializer, GeographyStatsSerializer,
    DeviceStatsSerializer, ReferrerStatsSerializer, ExportRequestSerializer
)


class AnalyticsOverviewView(APIView):
    """
    Get analytics overview for the user.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d"),
        ],
        responses={200: OverviewStatsSerializer},
        tags=["Analytics"]
    )
    def get(self, request):
        period = request.query_params.get("period", "30d")
        team = getattr(request, "team", None)
        team_id = str(team.id) if team else None
        stats = get_user_overview(str(request.user.id), period, team_id=team_id)
        return Response(stats)


class AnalyticsClicksView(APIView):
    """
    Get click chart data.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d"),
            OpenApiParameter("link_id", str, description="Filter by link ID"),
            OpenApiParameter("group_by", str, description="Group by: day, week, month"),
        ],
        tags=["Analytics"]
    )
    def get(self, request):
        period = request.query_params.get("period", "30d")
        link_id = request.query_params.get("link_id")
        group_by = request.query_params.get("group_by", "day")
        team = getattr(request, "team", None)
        
        # Verify link ownership if filtering
        if link_id:
            from apps.links.models import Link
            link_filter = {"id": link_id}
            if team:
                link_filter["team"] = team
            else:
                link_filter["user"] = request.user
                link_filter["team__isnull"] = True
            if not Link.objects.filter(**link_filter).exists():
                return Response(
                    {"error": "Link not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

        team_id = str(team.id) if team else None
        data = get_clicks_chart_data(str(request.user.id), period, group_by, team_id=team_id)
        return Response({"data": data})


class AnalyticsGeographyView(APIView):
    """
    Get geography breakdown.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d"),
            OpenApiParameter("link_id", str, description="Filter by link ID"),
        ],
        responses={200: GeographyStatsSerializer},
        tags=["Analytics"]
    )
    def get(self, request):
        period = request.query_params.get("period", "30d")
        link_id = request.query_params.get("link_id")
        team = getattr(request, "team", None)
        
        # Verify link ownership if filtering
        if link_id:
            from apps.links.models import Link
            link_filter = {"id": link_id}
            if team:
                link_filter["team"] = team
            else:
                link_filter["user"] = request.user
                link_filter["team__isnull"] = True
            if not Link.objects.filter(**link_filter).exists():
                return Response(
                    {"error": "Link not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

        team_id = str(team.id) if team else None
        stats = get_geography_stats(str(request.user.id), period, link_id, team_id=team_id)
        return Response(stats)


class AnalyticsDevicesView(APIView):
    """
    Get device breakdown.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d"),
            OpenApiParameter("link_id", str, description="Filter by link ID"),
        ],
        responses={200: DeviceStatsSerializer},
        tags=["Analytics"]
    )
    def get(self, request):
        period = request.query_params.get("period", "30d")
        link_id = request.query_params.get("link_id")
        team = getattr(request, "team", None)
        
        # Verify link ownership if filtering
        if link_id:
            from apps.links.models import Link
            link_filter = {"id": link_id}
            if team:
                link_filter["team"] = team
            else:
                link_filter["user"] = request.user
                link_filter["team__isnull"] = True
            if not Link.objects.filter(**link_filter).exists():
                return Response(
                    {"error": "Link not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

        team_id = str(team.id) if team else None
        stats = get_device_stats(str(request.user.id), period, link_id, team_id=team_id)
        return Response(stats)


class AnalyticsReferrersView(APIView):
    """
    Get referrer breakdown.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d"),
            OpenApiParameter("link_id", str, description="Filter by link ID"),
        ],
        responses={200: ReferrerStatsSerializer},
        tags=["Analytics"]
    )
    def get(self, request):
        period = request.query_params.get("period", "30d")
        link_id = request.query_params.get("link_id")
        team = getattr(request, "team", None)
        
        # Verify link ownership if filtering
        if link_id:
            from apps.links.models import Link
            link_filter = {"id": link_id}
            if team:
                link_filter["team"] = team
            else:
                link_filter["user"] = request.user
                link_filter["team__isnull"] = True
            if not Link.objects.filter(**link_filter).exists():
                return Response(
                    {"error": "Link not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

        team_id = str(team.id) if team else None
        stats = get_referrer_stats(str(request.user.id), period, link_id, team_id=team_id)
        return Response(stats)


class AnalyticsExportView(APIView):
    """
    Export analytics data.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("format", str, description="Export format: csv or json"),
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d"),
        ],
        tags=["Analytics"]
    )
    def get(self, request):
        """Synchronous export for small datasets."""
        export_format = request.query_params.get("format", "csv")
        period = request.query_params.get("period", "30d")
        
        # Check subscription
        subscription = getattr(request.user, "subscription", None)
        if not subscription or subscription.plan == "free":
            return Response(
                {"error": "Analytics export requires a paid plan"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from .services import get_period_dates
        from .models import ClickEvent
        from apps.links.models import Link
        import csv
        import json
        from io import StringIO
        from django.http import HttpResponse
        from datetime import datetime
        
        start_date, end_date = get_period_dates(period)
        
        # Get user's/team's links
        team = getattr(request, "team", None)
        if team:
            link_ids = list(Link.objects.filter(team=team).values_list("id", flat=True))
        else:
            link_ids = list(Link.objects.filter(user=request.user, team__isnull=True).values_list("id", flat=True))

        # Get clicks (limited to 10000 for sync export)
        clicks = ClickEvent.objects.filter(
            link_id__in=link_ids,
            clicked_at__gte=start_date,
            clicked_at__lte=end_date,
        ).select_related("link")[:10000]
        
        if export_format == "json":
            data = []
            for click in clicks:
                data.append({
                    "short_code": click.link.short_code,
                    "clicked_at": click.clicked_at.isoformat(),
                    "country": click.country_name,
                    "city": click.city,
                    "device": click.device_type,
                    "browser": click.browser,
                    "os": click.os,
                    "referer": click.referer[:100] if click.referer else "",
                })
            
            response = HttpResponse(
                json.dumps(data, indent=2),
                content_type="application/json"
            )
            response["Content-Disposition"] = f'attachment; filename="analytics-{datetime.now().strftime("%Y%m%d")}.json"'
            return response
        
        else:  # CSV
            response = HttpResponse(content_type="text/csv")
            response["Content-Disposition"] = f'attachment; filename="analytics-{datetime.now().strftime("%Y%m%d")}.csv"'
            
            writer = csv.writer(response)
            writer.writerow(["Short Code", "Clicked At", "Country", "City", "Device", "Browser", "OS", "Referer"])
            
            for click in clicks:
                writer.writerow([
                    click.link.short_code,
                    click.clicked_at.isoformat(),
                    click.country_name,
                    click.city,
                    click.device_type,
                    click.browser,
                    click.os,
                    click.referer[:100] if click.referer else "",
                ])
            
            return response
    
    @extend_schema(
        request=ExportRequestSerializer,
        tags=["Analytics"]
    )
    def post(self, request):
        """Asynchronous export for large datasets."""
        serializer = ExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check subscription
        subscription = getattr(request.user, "subscription", None)
        if not subscription or subscription.plan == "free":
            return Response(
                {"error": "Analytics export requires a paid plan"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Queue export task
        from .tasks import export_analytics
        
        task = export_analytics.delay(
            str(request.user.id),
            serializer.validated_data["period"],
            serializer.validated_data["format"],
            serializer.validated_data.get("link_ids", []),
        )
        
        return Response({
            "message": "Export started. You will receive an email with the download link.",
            "task_id": task.id,
        }, status=status.HTTP_202_ACCEPTED)


# =============================================================================
# NEW ANALYTICS VIEWS
# =============================================================================

class AnalyticsRealtimeView(APIView):
    """Get real-time analytics data."""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Analytics"])
    def get(self, request):
        from django.core.cache import cache
        from apps.links.models import Link
        from .models import ClickEvent
        from datetime import timedelta
        from django.utils import timezone  # Missing import!

        # Get user's/team's link IDs
        team = getattr(request, "team", None)
        if team:
            link_ids = list(Link.objects.filter(team=team).values_list("id", flat=True))
        else:
            link_ids = list(Link.objects.filter(user=request.user, team__isnull=True).values_list("id", flat=True))

        # Active visitors (clicks in last 5 minutes)
        five_min_ago = timezone.now() - timedelta(minutes=5)
        active_visitors = ClickEvent.objects.filter(
            link_id__in=link_ids,
            clicked_at__gte=five_min_ago
        ).values("ip_hash").distinct().count()  # Changed from visitor_id to ip_hash

        # Recent clicks (last 30 minutes)
        thirty_min_ago = timezone.now() - timedelta(minutes=30)
        recent_clicks = ClickEvent.objects.filter(
            link_id__in=link_ids,
            clicked_at__gte=thirty_min_ago
        ).select_related("link").order_by("-clicked_at")[:20]

        return Response({
            "active_visitors": active_visitors,
            "recent_clicks": [{
                "id": str(c.id),
                "link_short_code": c.link.short_code,
                "clicked_at": c.clicked_at.isoformat(),
                "country": c.country_name,
                "device": c.device_type,
            } for c in recent_clicks]
        })


class AnalyticsCompareView(APIView):
    """Compare two date periods."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("period1_start", str, description="First period start (YYYY-MM-DD)"),
            OpenApiParameter("period1_end", str, description="First period end (YYYY-MM-DD)"),
            OpenApiParameter("period2_start", str, description="Second period start (YYYY-MM-DD)"),
            OpenApiParameter("period2_end", str, description="Second period end (YYYY-MM-DD)"),
        ],
        tags=["Analytics"]
    )
    def get(self, request):
        from datetime import datetime
        from apps.links.models import Link
        from .models import ClickEvent
        from django.db.models import Count
        
        # Parse dates
        try:
            p1_start = datetime.strptime(request.query_params.get("period1_start", ""), "%Y-%m-%d").date()
            p1_end = datetime.strptime(request.query_params.get("period1_end", ""), "%Y-%m-%d").date()
            p2_start = datetime.strptime(request.query_params.get("period2_start", ""), "%Y-%m-%d").date()
            p2_end = datetime.strptime(request.query_params.get("period2_end", ""), "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return Response({"error": "Invalid date format"}, status=status.HTTP_400_BAD_REQUEST)
        
        team = getattr(request, "team", None)
        if team:
            link_ids = list(Link.objects.filter(team=team).values_list("id", flat=True))
        else:
            link_ids = list(Link.objects.filter(user=request.user, team__isnull=True).values_list("id", flat=True))

        # Period 1 stats
        p1_clicks = ClickEvent.objects.filter(
            link_id__in=link_ids,
            clicked_at__date__gte=p1_start,
            clicked_at__date__lte=p1_end
        )
        p1_total = p1_clicks.count()
        p1_unique = p1_clicks.values("ip_hash").distinct().count()
        
        # Period 2 stats
        p2_clicks = ClickEvent.objects.filter(
            link_id__in=link_ids,
            clicked_at__date__gte=p2_start,
            clicked_at__date__lte=p2_end
        )
        p2_total = p2_clicks.count()
        p2_unique = p2_clicks.values("ip_hash").distinct().count()
        
        # Calculate changes
        def calc_change(old, new):
            if old == 0:
                return 100 if new > 0 else 0
            return round((new - old) / old * 100, 1)
        
        return Response({
            "period1": {
                "start": p1_start.isoformat(),
                "end": p1_end.isoformat(),
                "total_clicks": p1_total,
                "unique_visitors": p1_unique,
            },
            "period2": {
                "start": p2_start.isoformat(),
                "end": p2_end.isoformat(),
                "total_clicks": p2_total,
                "unique_visitors": p2_unique,
            },
            "changes": {
                "total_clicks": calc_change(p1_total, p2_total),
                "unique_visitors": calc_change(p1_unique, p2_unique),
            }
        })


class AnalyticsTopLinksView(APIView):
    """Get top performing links."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d"),
            OpenApiParameter("limit", int, description="Number of links to return"),
        ],
        tags=["Analytics"]
    )
    def get(self, request):
        from apps.links.models import Link
        from .models import ClickEvent
        from .services import get_period_dates
        from django.db.models import Count

        period = request.query_params.get("period", "30d")
        limit = min(int(request.query_params.get("limit", 10)), 50)

        start_date, end_date = get_period_dates(period)

        # Get top links by clicks
        team = getattr(request, "team", None)
        if team:
            link_ids = list(Link.objects.filter(team=team).values_list("id", flat=True))
        else:
            link_ids = list(Link.objects.filter(user=request.user, team__isnull=True).values_list("id", flat=True))

        top_links = ClickEvent.objects.filter(
            link_id__in=link_ids,
            clicked_at__gte=start_date,
            clicked_at__lte=end_date
        ).values("link_id").annotate(
            clicks=Count("id"),
            unique_clicks=Count("ip_hash", distinct=True)
        ).order_by("-clicks")[:limit]

        # Get link details
        link_map = {l.id: l for l in Link.objects.filter(id__in=[t["link_id"] for t in top_links])}

        result = []
        for t in top_links:
            link = link_map.get(t["link_id"])
            if link:
                ctr = round(t["unique_clicks"] / t["clicks"] * 100, 1) if t["clicks"] > 0 else 0
                result.append({
                    "id": str(link.id),
                    "short_code": link.short_code,
                    "short_url": link.short_url,
                    "title": link.title,
                    "clicks": t["clicks"],
                    "unique_visitors": t["unique_clicks"],
                    "ctr": ctr,
                })

        return Response({"links": result})


# =============================================================================
# UNIFIED ANALYTICS API (Phase 1)
# =============================================================================

class UnifiedAnalyticsView(APIView):
    """
    Unified analytics endpoint for links, QR codes, and campaigns.
    Provides consistent analytics interface across all entity types.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 24h, 7d, 30d, 90d, 1y"),
        ],
        tags=["Analytics"],
        summary="Get unified analytics overview",
    )
    def get(self, request):
        """Get overall analytics for user/team."""
        from .services import AnalyticsService

        period = request.query_params.get("period", "30d")
        team = getattr(request, "team", None)

        data = AnalyticsService.get_analytics(
            user=request.user,
            team=team,
            period=period,
        )

        # Format dates for JSON serialization
        data["by_date"] = [
            {
                "date": d["date"].isoformat() if d["date"] else None,
                "clicks": d["clicks"],
                "unique": d["unique"],
                "qr_scans": d["qr_scans"],
                "link_clicks": d["link_clicks"],
            }
            for d in data["by_date"]
        ]

        return Response(data)


class LinkAnalyticsView(APIView):
    """Get analytics for a specific link."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 24h, 7d, 30d, 90d, 1y"),
        ],
        tags=["Analytics"],
        summary="Get link analytics",
    )
    def get(self, request, link_id):
        from apps.links.models import Link
        from .services import AnalyticsService

        # Verify ownership
        team = getattr(request, "team", None)
        link_filter = {"id": link_id}
        if team:
            link_filter["team"] = team
        else:
            link_filter["user"] = request.user
            link_filter["team__isnull"] = True

        if not Link.objects.filter(**link_filter).exists():
            return Response(
                {"error": "Link not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        period = request.query_params.get("period", "30d")

        data = AnalyticsService.get_analytics(
            user=request.user,
            link_id=link_id,
            period=period,
        )

        # Format dates
        data["by_date"] = [
            {
                "date": d["date"].isoformat() if d["date"] else None,
                "clicks": d["clicks"],
                "unique": d["unique"],
                "qr_scans": d["qr_scans"],
                "link_clicks": d["link_clicks"],
            }
            for d in data["by_date"]
        ]

        return Response(data)


class QRCodeAnalyticsView(APIView):
    """Get analytics for a specific QR code."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 24h, 7d, 30d, 90d, 1y"),
        ],
        tags=["Analytics"],
        summary="Get QR code analytics",
    )
    def get(self, request, qr_id):
        from apps.qrcodes.models import QRCode
        from .services import AnalyticsService

        # Verify ownership
        team = getattr(request, "team", None)
        qr_filter = {"id": qr_id}
        if team:
            qr_filter["team"] = team
        else:
            qr_filter["user"] = request.user
            qr_filter["team__isnull"] = True

        if not QRCode.objects.filter(**qr_filter).exists():
            return Response(
                {"error": "QR code not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        period = request.query_params.get("period", "30d")

        data = AnalyticsService.get_qr_analytics(
            qr_id=qr_id,
            period=period,
        )

        # Format dates
        data["by_date"] = [
            {
                "date": d["date"].isoformat() if d["date"] else None,
                "clicks": d["clicks"],
                "unique": d["unique"],
                "qr_scans": d.get("qr_scans", d["clicks"]),
                "link_clicks": d.get("link_clicks", 0),
            }
            for d in data["by_date"]
        ]

        return Response(data)


class CampaignAnalyticsView(APIView):
    """Get analytics for a specific campaign."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 24h, 7d, 30d, 90d, 1y"),
        ],
        tags=["Analytics"],
        summary="Get campaign analytics",
    )
    def get(self, request, campaign_id):
        from apps.campaigns.models import Campaign
        from .services import AnalyticsService

        # Verify ownership
        team = getattr(request, "team", None)
        campaign_filter = {"id": campaign_id}
        if team:
            campaign_filter["team"] = team
        else:
            campaign_filter["user"] = request.user
            campaign_filter["team__isnull"] = True

        if not Campaign.objects.filter(**campaign_filter).exists():
            return Response(
                {"error": "Campaign not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        period = request.query_params.get("period", "30d")

        data = AnalyticsService.get_campaign_analytics(
            campaign_id=campaign_id,
            period=period,
        )

        # Format dates
        data["by_date"] = [
            {
                "date": d["date"].isoformat() if d["date"] else None,
                "clicks": d["clicks"],
                "unique": d["unique"],
                "qr_scans": d.get("qr_scans", 0),
                "link_clicks": d.get("link_clicks", 0),
            }
            for d in data["by_date"]
        ]

        return Response(data)


class TopQRCodesView(APIView):
    """Get top performing QR codes."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d"),
            OpenApiParameter("limit", int, description="Number of QR codes to return"),
        ],
        tags=["Analytics"],
        summary="Get top QR codes by scans",
    )
    def get(self, request):
        from apps.qrcodes.models import QRCode
        from .models import ClickEvent
        from .services import get_period_dates
        from django.db.models import Count

        period = request.query_params.get("period", "30d")
        limit = min(int(request.query_params.get("limit", 10)), 50)

        start_date, end_date = get_period_dates(period)

        # Get user's/team's QR codes
        team = getattr(request, "team", None)
        if team:
            qr_ids = list(QRCode.objects.filter(team=team).values_list("id", flat=True))
        else:
            qr_ids = list(QRCode.objects.filter(user=request.user, team__isnull=True).values_list("id", flat=True))

        if not qr_ids:
            return Response({"qr_codes": []})

        top_qrs = ClickEvent.objects.filter(
            qr_code_id__in=qr_ids,
            clicked_at__gte=start_date,
            clicked_at__lte=end_date,
            is_qr_scan=True,
        ).values("qr_code_id").annotate(
            scans=Count("id"),
            unique_scans=Count("ip_hash", distinct=True)
        ).order_by("-scans")[:limit]

        # Get QR details
        qr_map = {q.id: q for q in QRCode.objects.filter(id__in=[t["qr_code_id"] for t in top_qrs])}

        result = []
        for t in top_qrs:
            qr = qr_map.get(t["qr_code_id"])
            if qr:
                result.append({
                    "id": str(qr.id),
                    "title": qr.title,
                    "qr_type": qr.qr_type,
                    "short_url": qr.short_url,
                    "scans": t["scans"],
                    "unique_scans": t["unique_scans"],
                })

        return Response({"qr_codes": result})
