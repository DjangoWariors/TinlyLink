"""
Analytics services for computing and retrieving statistics.
Unified analytics for links, QR codes, and campaigns.
"""

from datetime import timedelta
from collections import defaultdict
from urllib.parse import urlparse

from django.db.models import Count, Sum, Q, F
from django.db.models.functions import TruncDate, TruncHour, ExtractHour
from django.utils import timezone
from django.core.cache import cache

from .models import ClickEvent, DailyStats


class AnalyticsService:
    """
    Unified analytics service for links, QR codes, and campaigns.
    Provides consistent analytics interface across all entity types.
    """

    @staticmethod
    def get_analytics(
        user,
        team=None,
        link_id=None,
        qr_id=None,
        campaign_id=None,
        period="30d",
        start_date=None,
        end_date=None,
    ):
        """
        Get comprehensive analytics for link, QR code, campaign, or user overview.

        Args:
            user: User object
            team: Team object (optional)
            link_id: UUID of specific link
            qr_id: UUID of specific QR code
            campaign_id: UUID of specific campaign
            period: Time period string (7d, 30d, 90d, 1y)
            start_date: Custom start date
            end_date: Custom end date

        Returns:
            dict with summary, by_date, by_country, by_city, by_device, etc.
        """
        # Build base queryset
        qs = ClickEvent.objects.all()

        if link_id:
            qs = qs.filter(link_id=link_id)
        elif qr_id:
            qs = qs.filter(qr_code_id=qr_id)
        elif campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        else:
            # User/team level - all links and QR codes
            if team:
                qs = qs.filter(
                    Q(link__team=team) | Q(qr_code__team=team)
                )
            else:
                qs = qs.filter(
                    Q(link__user=user, link__team__isnull=True) |
                    Q(qr_code__user=user, qr_code__team__isnull=True)
                )

        # Apply date filter
        start, end = AnalyticsService._parse_period(period, start_date, end_date)
        qs = qs.filter(clicked_at__gte=start, clicked_at__lte=end)

        return {
            "summary": AnalyticsService._get_summary(qs),
            "by_date": AnalyticsService._get_by_date(qs, start, end),
            "by_country": AnalyticsService._get_by_country(qs),
            "by_city": AnalyticsService._get_by_city(qs),
            "by_device": AnalyticsService._get_by_device(qs),
            "by_browser": AnalyticsService._get_by_browser(qs),
            "by_os": AnalyticsService._get_by_os(qs),
            "by_referrer": AnalyticsService._get_by_referrer(qs),
            "by_hour": AnalyticsService._get_by_hour(qs),
        }

    @staticmethod
    def _get_summary(qs):
        """Get summary statistics."""
        return qs.aggregate(
            total_clicks=Count("id"),
            unique_visitors=Count("ip_hash", distinct=True),
            qr_scans=Count("id", filter=Q(is_qr_scan=True)),
            link_clicks=Count("id", filter=Q(is_qr_scan=False)),
            countries=Count("country_code", distinct=True, filter=~Q(country_code="")),
            first_scans=Count("id", filter=Q(is_first_scan=True)),
        )

    @staticmethod
    def _get_by_date(qs, start, end):
        """Get clicks grouped by date."""
        return list(
            qs.annotate(date=TruncDate("clicked_at"))
            .values("date")
            .annotate(
                clicks=Count("id"),
                unique=Count("ip_hash", distinct=True),
                qr_scans=Count("id", filter=Q(is_qr_scan=True)),
                link_clicks=Count("id", filter=Q(is_qr_scan=False)),
            )
            .order_by("date")
        )

    @staticmethod
    def _get_by_country(qs, limit=10):
        """Get clicks grouped by country."""
        return list(
            qs.exclude(country_code="")
            .values("country_code", "country_name")
            .annotate(
                clicks=Count("id"),
                unique=Count("ip_hash", distinct=True),
            )
            .order_by("-clicks")[:limit]
        )

    @staticmethod
    def _get_by_city(qs, limit=10):
        """Get clicks grouped by city."""
        return list(
            qs.exclude(city="")
            .values("city", "country_name", "country_code")
            .annotate(
                clicks=Count("id"),
                unique=Count("ip_hash", distinct=True),
            )
            .order_by("-clicks")[:limit]
        )

    @staticmethod
    def _get_by_device(qs):
        """Get clicks grouped by device type."""
        results = list(
            qs.exclude(device_type="")
            .values("device_type")
            .annotate(clicks=Count("id"))
            .order_by("-clicks")
        )
        # Convert to dict format
        return {r["device_type"]: r["clicks"] for r in results}

    @staticmethod
    def _get_by_browser(qs, limit=10):
        """Get clicks grouped by browser."""
        return list(
            qs.exclude(browser="")
            .values("browser")
            .annotate(clicks=Count("id"))
            .order_by("-clicks")[:limit]
        )

    @staticmethod
    def _get_by_os(qs, limit=10):
        """Get clicks grouped by operating system."""
        return list(
            qs.exclude(os="")
            .values("os")
            .annotate(clicks=Count("id"))
            .order_by("-clicks")[:limit]
        )

    @staticmethod
    def _get_by_referrer(qs, limit=10):
        """Get clicks grouped by referrer domain."""
        # Get raw referrers and group by domain
        referrer_counts = defaultdict(int)
        referrers = qs.exclude(referer="").values_list("referer", flat=True)

        for ref in referrers.iterator():
            try:
                domain = urlparse(ref).netloc
                if domain:
                    referrer_counts[domain] += 1
            except Exception:
                continue

        # Sort and limit
        sorted_refs = sorted(referrer_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        return [{"domain": domain, "clicks": count} for domain, count in sorted_refs]

    @staticmethod
    def _get_by_hour(qs):
        """Get clicks grouped by hour of day."""
        return list(
            qs.annotate(hour=ExtractHour("clicked_at"))
            .values("hour")
            .annotate(clicks=Count("id"))
            .order_by("hour")
        )

    @staticmethod
    def _parse_period(period, start_date=None, end_date=None):
        """Parse period string to start and end dates."""
        now = timezone.now()

        if start_date and end_date:
            return start_date, end_date

        periods = {
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30),
            "90d": timedelta(days=90),
            "1y": timedelta(days=365),
            "all": timedelta(days=365 * 10),
        }

        delta = periods.get(period, timedelta(days=30))
        return now - delta, now

    @staticmethod
    def get_qr_analytics(qr_id, period="30d"):
        """
        Get analytics specific to a QR code.
        Includes verification stats for serialized QRs.
        """
        from apps.qrcodes.models import QRCode

        start, end = AnalyticsService._parse_period(period, None, None)

        qs = ClickEvent.objects.filter(
            qr_code_id=qr_id,
            clicked_at__gte=start,
            clicked_at__lte=end,
        )

        base_analytics = {
            "summary": AnalyticsService._get_summary(qs),
            "by_date": AnalyticsService._get_by_date(qs, start, end),
            "by_country": AnalyticsService._get_by_country(qs),
            "by_city": AnalyticsService._get_by_city(qs),
            "by_device": AnalyticsService._get_by_device(qs),
            "by_hour": AnalyticsService._get_by_hour(qs),
        }

        # Add verification stats if serialized QR
        try:
            qr = QRCode.objects.get(id=qr_id)
            if hasattr(qr, "serial"):
                base_analytics["verification"] = {
                    "serial_number": qr.serial.serial_number,
                    "status": qr.serial.status,
                    "first_scanned_at": qr.serial.first_scanned_at,
                    "first_scan_location": qr.serial.first_scan_location,
                    "total_scans": qr.serial.total_scans,
                }
        except QRCode.DoesNotExist:
            pass

        return base_analytics

    @staticmethod
    def get_campaign_analytics(campaign_id, period="30d"):
        """
        Get analytics for a campaign including all its links and QR codes.
        """
        start, end = AnalyticsService._parse_period(period, None, None)

        qs = ClickEvent.objects.filter(
            campaign_id=campaign_id,
            clicked_at__gte=start,
            clicked_at__lte=end,
        )

        base_analytics = {
            "summary": AnalyticsService._get_summary(qs),
            "by_date": AnalyticsService._get_by_date(qs, start, end),
            "by_country": AnalyticsService._get_by_country(qs),
            "by_device": AnalyticsService._get_by_device(qs),
        }

        # Add per-link breakdown
        link_breakdown = list(
            qs.filter(link__isnull=False)
            .values("link_id", "link__short_code", "link__title")
            .annotate(clicks=Count("id"))
            .order_by("-clicks")[:10]
        )

        # Add per-QR breakdown
        qr_breakdown = list(
            qs.filter(qr_code__isnull=False)
            .values("qr_code_id", "qr_code__title")
            .annotate(clicks=Count("id"))
            .order_by("-clicks")[:10]
        )

        # Add variant performance if A/B testing
        variant_breakdown = list(
            qs.filter(variant_id__isnull=False)
            .values("variant_id")
            .annotate(clicks=Count("id"))
            .order_by("-clicks")
        )

        base_analytics["by_link"] = link_breakdown
        base_analytics["by_qr_code"] = qr_breakdown
        base_analytics["by_variant"] = variant_breakdown

        return base_analytics


def get_period_dates(period):
    """
    Get start and end dates for a period string.
    """
    now = timezone.now()
    
    if period == "7d":
        start = now - timedelta(days=7)
    elif period == "30d":
        start = now - timedelta(days=30)
    elif period == "90d":
        start = now - timedelta(days=90)
    elif period == "all":
        start = now - timedelta(days=365 * 10)  # 10 years
    else:
        start = now - timedelta(days=30)
    
    return start, now


def get_link_stats(link_id, period="30d"):
    """
    Get comprehensive statistics for a single link.
    """
    start_date, end_date = get_period_dates(period)
    
    # Try cache first
    cache_key = f"link_stats:{link_id}:{period}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # Base queryset
    clicks = ClickEvent.objects.filter(
        link_id=link_id,
        clicked_at__gte=start_date,
        clicked_at__lte=end_date,
    )
    
    # Total and unique clicks
    total_clicks = clicks.count()
    unique_clicks = clicks.values("ip_hash").distinct().count()
    
    # Clicks by day
    clicks_by_day = list(
        clicks
        .annotate(date=TruncDate("clicked_at"))
        .values("date")
        .annotate(clicks=Count("id"), unique=Count("ip_hash", distinct=True))
        .order_by("date")
    )
    
    # Top countries
    top_countries = list(
        clicks
        .filter(country_code__isnull=False)
        .exclude(country_code="")
        .values("country_code", "country_name")
        .annotate(clicks=Count("id"))
        .order_by("-clicks")[:10]
    )
    
    # Top cities
    top_cities = list(
        clicks
        .filter(city__isnull=False)
        .exclude(city="")
        .values("city", "country_name")
        .annotate(clicks=Count("id"))
        .order_by("-clicks")[:10]
    )
    
    # Device breakdown
    device_counts = clicks.values("device_type").annotate(clicks=Count("id"))
    devices = {d["device_type"]: d["clicks"] for d in device_counts if d["device_type"]}
    
    # Browser breakdown
    browsers = list(
        clicks
        .filter(browser__isnull=False)
        .exclude(browser="")
        .values("browser")
        .annotate(clicks=Count("id"))
        .order_by("-clicks")[:10]
    )
    
    # Referrer breakdown
    referrers = list(
        clicks
        .filter(referer__isnull=False)
        .exclude(referer="")
        .annotate(
            domain=F("referer")  # In production, extract domain
        )
        .values("domain")
        .annotate(clicks=Count("id"))
        .order_by("-clicks")[:10]
    )
    
    stats = {
        "total_clicks": total_clicks,
        "unique_clicks": unique_clicks,
        "clicks_by_day": [
            {
                "date": d["date"].isoformat() if d["date"] else None,
                "clicks": d["clicks"],
                "unique": d["unique"],
            }
            for d in clicks_by_day
        ],
        "top_countries": [
            {
                "code": c["country_code"],
                "name": c["country_name"],
                "clicks": c["clicks"],
            }
            for c in top_countries
        ],
        "top_cities": [
            {
                "city": c["city"],
                "country": c["country_name"],
                "clicks": c["clicks"],
            }
            for c in top_cities
        ],
        "devices": {
            "mobile": devices.get("mobile", 0),
            "desktop": devices.get("desktop", 0),
            "tablet": devices.get("tablet", 0),
        },
        "browsers": [
            {"browser": b["browser"], "clicks": b["clicks"]}
            for b in browsers
        ],
        "referrers": [
            {"referer": r["domain"], "clicks": r["clicks"]}
            for r in referrers
        ],
    }
    
    # Cache for 15 minutes
    cache.set(cache_key, stats, timeout=900)
    
    return stats


def get_user_overview(user_id, period="30d", team_id=None):
    """
    Get overview statistics for a user's all links.
    If team_id is provided, filter by team instead of user.
    """
    from apps.links.models import Link
    
    start_date, end_date = get_period_dates(period)
    
    # Get links - team-scoped or user-scoped
    if team_id:
        link_ids = list(Link.objects.filter(team_id=team_id).values_list("id", flat=True))
    else:
        link_ids = list(Link.objects.filter(user_id=user_id, team__isnull=True).values_list("id", flat=True))
    
    if not link_ids:
        return {
            "total_clicks": 0,
            "total_links": 0,
            "total_qr_scans": 0,
            "clicks_trend": {"current": 0, "previous": 0, "change_percent": 0},
        }
    
    # Current period clicks
    current_clicks = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=start_date,
        clicked_at__lte=end_date,
    ).count()
    
    # Previous period clicks (for comparison)
    period_length = (end_date - start_date).days
    previous_start = start_date - timedelta(days=period_length)
    previous_clicks = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=previous_start,
        clicked_at__lt=start_date,
    ).count()
    
    # Calculate change
    if previous_clicks > 0:
        change_percent = ((current_clicks - previous_clicks) / previous_clicks) * 100
    else:
        change_percent = 100 if current_clicks > 0 else 0
    
    # QR scans
    qr_scans = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=start_date,
        is_qr_scan=True,
    ).count()
    
    # Unique visitors
    unique_visitors = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=start_date,
    ).values("ip_hash").distinct().count()
    
    # Countries count
    countries_count = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=start_date,
    ).values("country_code").distinct().count()
    
    return {
        "total_clicks": current_clicks,
        "total_links": len(link_ids),
        "total_qr_scans": qr_scans,
        "unique_visitors": unique_visitors,
        "countries": countries_count,
        "clicks_trend": {
            "current": current_clicks,
            "previous": previous_clicks,
            "change_percent": round(change_percent, 1),
        },
    }


def get_clicks_chart_data(user_id, period="30d", group_by="day", team_id=None):
    """
    Get clicks chart data for a user.
    If team_id is provided, filter by team instead of user.
    """
    from apps.links.models import Link
    
    start_date, end_date = get_period_dates(period)
    
    if team_id:
        link_ids = list(Link.objects.filter(team_id=team_id).values_list("id", flat=True))
    else:
        link_ids = list(Link.objects.filter(user_id=user_id, team__isnull=True).values_list("id", flat=True))
    
    clicks = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=start_date,
        clicked_at__lte=end_date,
    )
    
    if group_by == "hour":
        truncate = TruncHour("clicked_at")
    else:
        truncate = TruncDate("clicked_at")
    
    data = list(
        clicks
        .annotate(period=truncate)
        .values("period")
        .annotate(clicks=Count("id"), unique=Count("ip_hash", distinct=True))
        .order_by("period")
    )
    
    return [
        {
            "date": d["period"].isoformat() if d["period"] else None,
            "clicks": d["clicks"],
            "unique_clicks": d["unique"],
        }
        for d in data
    ]


def get_geography_stats(user_id, period="30d", link_id=None, team_id=None):
    """
    Get geographic breakdown for user's links.
    If team_id is provided, filter by team instead of user.
    """
    from apps.links.models import Link
    
    start_date, end_date = get_period_dates(period)
    
    if link_id:
        link_ids = [link_id]
    elif team_id:
        link_ids = list(Link.objects.filter(team_id=team_id).values_list("id", flat=True))
    else:
        link_ids = list(Link.objects.filter(user_id=user_id, team__isnull=True).values_list("id", flat=True))
    
    clicks = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=start_date,
        clicked_at__lte=end_date,
    )
    
    # Countries
    countries = list(
        clicks
        .filter(country_code__isnull=False)
        .exclude(country_code="")
        .values("country_code", "country_name")
        .annotate(clicks=Count("id"))
        .order_by("-clicks")[:20]
    )
    
    total = sum(c["clicks"] for c in countries)
    
    return {
        "countries": [
            {
                "code": c["country_code"],
                "name": c["country_name"],
                "clicks": c["clicks"],
                "percentage": round((c["clicks"] / total) * 100, 1) if total > 0 else 0,
            }
            for c in countries
        ],
        "total": total,
    }


def get_device_stats(user_id, period="30d", link_id=None, team_id=None):
    """
    Get device breakdown for user's links.
    If team_id is provided, filter by team instead of user.
    """
    from apps.links.models import Link
    
    start_date, end_date = get_period_dates(period)
    
    if link_id:
        link_ids = [link_id]
    elif team_id:
        link_ids = list(Link.objects.filter(team_id=team_id).values_list("id", flat=True))
    else:
        link_ids = list(Link.objects.filter(user_id=user_id, team__isnull=True).values_list("id", flat=True))
    
    clicks = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=start_date,
        clicked_at__lte=end_date,
    )
    
    # Devices
    devices = dict(
        clicks
        .values("device_type")
        .annotate(clicks=Count("id"))
        .values_list("device_type", "clicks")
    )
    
    total = sum(devices.values())
    
    # Browsers
    browsers = list(
        clicks
        .filter(browser__isnull=False)
        .exclude(browser="")
        .values("browser")
        .annotate(clicks=Count("id"))
        .order_by("-clicks")[:10]
    )
    
    # OS
    operating_systems = list(
        clicks
        .filter(os__isnull=False)
        .exclude(os="")
        .values("os")
        .annotate(clicks=Count("id"))
        .order_by("-clicks")[:10]
    )
    
    return {
        "devices": {
            "mobile": {
                "clicks": devices.get("mobile", 0),
                "percentage": round((devices.get("mobile", 0) / total) * 100, 1) if total > 0 else 0,
            },
            "desktop": {
                "clicks": devices.get("desktop", 0),
                "percentage": round((devices.get("desktop", 0) / total) * 100, 1) if total > 0 else 0,
            },
            "tablet": {
                "clicks": devices.get("tablet", 0),
                "percentage": round((devices.get("tablet", 0) / total) * 100, 1) if total > 0 else 0,
            },
        },
        "browsers": browsers,
        "operating_systems": operating_systems,
        "total": total,
    }


def get_referrer_stats(user_id, period="30d", link_id=None, team_id=None):
    """
    Get referrer breakdown for user's links.
    If team_id is provided, filter by team instead of user.
    """
    from apps.links.models import Link
    from urllib.parse import urlparse
    
    start_date, end_date = get_period_dates(period)
    
    if link_id:
        link_ids = [link_id]
    elif team_id:
        link_ids = list(Link.objects.filter(team_id=team_id).values_list("id", flat=True))
    else:
        link_ids = list(Link.objects.filter(user_id=user_id, team__isnull=True).values_list("id", flat=True))
    
    clicks = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=start_date,
        clicked_at__lte=end_date,
        referer__isnull=False,
    ).exclude(referer="")
    
    # Group by referer domain
    referrer_counts = defaultdict(int)
    
    for click in clicks.values_list("referer", flat=True).iterator():
        try:
            domain = urlparse(click).netloc
            if domain:
                referrer_counts[domain] += 1
        except Exception:
            continue
    
    # Sort by count
    sorted_referrers = sorted(referrer_counts.items(), key=lambda x: x[1], reverse=True)[:20]
    
    total = sum(count for _, count in sorted_referrers)
    
    return {
        "referrers": [
            {
                "domain": domain,
                "clicks": count,
                "percentage": round((count / total) * 100, 1) if total > 0 else 0,
            }
            for domain, count in sorted_referrers
        ],
        "direct": clicks.filter(referer="").count(),
        "total": total,
    }
