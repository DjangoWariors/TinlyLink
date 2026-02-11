"""
Celery tasks for analytics app.
Aggregation, cleanup, exports.
"""

import csv
import json
import logging
from datetime import timedelta
from io import StringIO

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.db.models import Count, Sum, F
from django.db.models.functions import TruncDate
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(queue="analytics")
def aggregate_hourly_stats():
    """
    Aggregate click/scan stats every hour for links and QR codes.
    Runs at :05 past every hour.
    """
    from .models import ClickEvent
    from apps.links.models import Link
    from apps.qrcodes.models import QRCode

    now = timezone.now()
    hour_ago = now - timedelta(hours=1)

    # --- Aggregate by Link ---
    link_counts = (
        ClickEvent.objects
        .filter(clicked_at__gte=hour_ago, clicked_at__lt=now, link_id__isnull=False)
        .values("link_id")
        .annotate(count=Count("id"))
    )

    for item in link_counts:
        link_id = item["link_id"]
        count = item["count"]

        cache_key = f"link:{link_id}:hourly_clicks"
        try:
            cache.incr(cache_key, count)
        except ValueError:
            cache.set(cache_key, count, timeout=3600)

    # --- Aggregate by QR Code ---
    qr_counts = (
        ClickEvent.objects
        .filter(clicked_at__gte=hour_ago, clicked_at__lt=now, qr_code_id__isnull=False)
        .values("qr_code_id")
        .annotate(count=Count("id"))
    )

    for item in qr_counts:
        qr_id = item["qr_code_id"]
        count = item["count"]

        cache_key = f"qr:{qr_id}:hourly_scans"
        try:
            cache.incr(cache_key, count)
        except ValueError:
            cache.set(cache_key, count, timeout=3600)

    logger.info(f"Aggregated hourly stats for {len(link_counts)} links and {len(qr_counts)} QR codes")
    return f"Aggregated {len(link_counts)} links, {len(qr_counts)} QR codes"


@shared_task(queue="analytics")
def aggregate_daily_stats():
    """
    Generate daily statistics for links, QR codes, and campaigns.
    Runs at 00:15 UTC.
    """
    from .models import ClickEvent, DailyStats
    from apps.links.models import Link
    from apps.qrcodes.models import QRCode
    from apps.campaigns.models import Campaign

    yesterday = (timezone.now() - timedelta(days=1)).date()

    # Get all clicks from yesterday
    clicks = ClickEvent.objects.filter(clicked_at__date=yesterday)

    created_count = 0

    # --- Aggregate by Link ---
    link_stats = (
        clicks
        .filter(link_id__isnull=False)
        .values("link_id")
        .annotate(
            total=Count("id"),
            unique=Count("ip_hash", distinct=True),
            qr_scans=Count("id", filter=models.Q(is_qr_scan=True)),
            mobile=Count("id", filter=models.Q(device_type="mobile")),
            desktop=Count("id", filter=models.Q(device_type="desktop")),
            tablet=Count("id", filter=models.Q(device_type="tablet")),
        )
    )

    for stats in link_stats:
        top_country = (
            clicks
            .filter(link_id=stats["link_id"], country_code__isnull=False)
            .exclude(country_code="")
            .values("country_code")
            .annotate(count=Count("id"))
            .order_by("-count")
            .first()
        )

        DailyStats.objects.update_or_create(
            link_id=stats["link_id"],
            qr_code=None,
            campaign=None,
            date=yesterday,
            defaults={
                "total_clicks": stats["total"],
                "unique_clicks": stats["unique"],
                "qr_scans": stats["qr_scans"],
                "mobile_clicks": stats["mobile"],
                "desktop_clicks": stats["desktop"],
                "tablet_clicks": stats["tablet"],
                "top_country_code": top_country["country_code"] if top_country else "",
                "top_country_clicks": top_country["count"] if top_country else 0,
            }
        )
        created_count += 1

    # --- Aggregate by QR Code ---
    qr_stats = (
        clicks
        .filter(qr_code_id__isnull=False)
        .values("qr_code_id")
        .annotate(
            total=Count("id"),
            unique=Count("ip_hash", distinct=True),
            mobile=Count("id", filter=models.Q(device_type="mobile")),
            desktop=Count("id", filter=models.Q(device_type="desktop")),
            tablet=Count("id", filter=models.Q(device_type="tablet")),
        )
    )

    for stats in qr_stats:
        top_country = (
            clicks
            .filter(qr_code_id=stats["qr_code_id"], country_code__isnull=False)
            .exclude(country_code="")
            .values("country_code")
            .annotate(count=Count("id"))
            .order_by("-count")
            .first()
        )

        DailyStats.objects.update_or_create(
            link=None,
            qr_code_id=stats["qr_code_id"],
            campaign=None,
            date=yesterday,
            defaults={
                "total_clicks": stats["total"],
                "unique_clicks": stats["unique"],
                "qr_scans": stats["total"],  # All QR events are scans
                "mobile_clicks": stats["mobile"],
                "desktop_clicks": stats["desktop"],
                "tablet_clicks": stats["tablet"],
                "top_country_code": top_country["country_code"] if top_country else "",
                "top_country_clicks": top_country["count"] if top_country else 0,
            }
        )
        created_count += 1

    # --- Aggregate by Campaign ---
    campaign_stats = (
        clicks
        .filter(campaign_id__isnull=False)
        .values("campaign_id")
        .annotate(
            total=Count("id"),
            unique=Count("ip_hash", distinct=True),
            qr_scans=Count("id", filter=models.Q(is_qr_scan=True)),
            mobile=Count("id", filter=models.Q(device_type="mobile")),
            desktop=Count("id", filter=models.Q(device_type="desktop")),
            tablet=Count("id", filter=models.Q(device_type="tablet")),
        )
    )

    for stats in campaign_stats:
        top_country = (
            clicks
            .filter(campaign_id=stats["campaign_id"], country_code__isnull=False)
            .exclude(country_code="")
            .values("country_code")
            .annotate(count=Count("id"))
            .order_by("-count")
            .first()
        )

        DailyStats.objects.update_or_create(
            link=None,
            qr_code=None,
            campaign_id=stats["campaign_id"],
            date=yesterday,
            defaults={
                "total_clicks": stats["total"],
                "unique_clicks": stats["unique"],
                "qr_scans": stats["qr_scans"],
                "mobile_clicks": stats["mobile"],
                "desktop_clicks": stats["desktop"],
                "tablet_clicks": stats["tablet"],
                "top_country_code": top_country["country_code"] if top_country else "",
                "top_country_clicks": top_country["count"] if top_country else 0,
            }
        )
        created_count += 1

    logger.info(f"Created daily stats for {created_count} entities (links, QR codes, campaigns)")
    return f"Created {created_count} daily stats"


@shared_task(queue="analytics")
def sync_click_counters():
    """
    Sync click counters from Redis to database.
    Runs every 5 minutes.
    Syncs both total_clicks and unique_clicks.
    """
    from apps.links.models import Link

    updated_total = 0
    updated_unique = 0

    try:
        # Get Redis client - handle different cache backends
        redis_client = None
        if hasattr(cache, 'client'):
            redis_client = cache.client.get_client()
        elif hasattr(cache, '_cache'):
            # For django-redis with different config
            redis_client = cache._cache.get_client()
        
        if not redis_client:
            logger.warning("Cache backend doesn't support direct Redis access")
            return "Skipped - no Redis client"

        # Django cache adds version prefix, typically ":1:" after the key_prefix
        # Key format in Redis: {prefix}:1:link:{id}:clicks
        # We need to match all link click keys
        key_prefix = getattr(cache, 'key_prefix', '') or ''
        version = getattr(cache, 'version', 1) or 1
        
        # Build search patterns for both total and unique clicks
        if key_prefix:
            total_pattern = f"{key_prefix}:{version}:link:*:clicks"
            unique_pattern = f"{key_prefix}:{version}:link:*:unique_clicks"
            prefix_to_strip = f"{key_prefix}:{version}:"
        else:
            total_pattern = f"*:link:*:clicks"
            unique_pattern = f"*:link:*:unique_clicks"
            prefix_to_strip = ""

        # Sync total clicks
        for key in redis_client.scan_iter(match=total_pattern, count=100):
            try:
                key_str = key.decode() if isinstance(key, bytes) else key

                # Extract the actual key without prefix
                if prefix_to_strip and key_str.startswith(prefix_to_strip):
                    actual_key = key_str[len(prefix_to_strip):]
                else:
                    # Try to find 'link:' in the key and extract from there
                    link_idx = key_str.find('link:')
                    if link_idx == -1:
                        continue
                    actual_key = key_str[link_idx:]

                parts = actual_key.split(":")

                # Format is link:{id}:clicks (3 parts)
                if len(parts) == 3 and parts[0] == 'link' and parts[2] == 'clicks':
                    link_id = parts[1]

                    # Atomic get and reset
                    pipe = redis_client.pipeline()
                    pipe.get(key)
                    pipe.set(key, 0)
                    results = pipe.execute()
                    count = results[0]

                    if count:
                        val = int(count) if isinstance(count, (int, str)) else int(count.decode()) if count else 0
                        if val > 0:
                            Link.objects.filter(id=link_id).update(
                                total_clicks=F("total_clicks") + val
                            )
                            updated_total += 1
            except Exception as e:
                logger.error(f"Error processing total clicks key {key}: {e}")
                continue

        # Sync unique clicks
        for key in redis_client.scan_iter(match=unique_pattern, count=100):
            try:
                key_str = key.decode() if isinstance(key, bytes) else key

                # Extract the actual key without prefix
                if prefix_to_strip and key_str.startswith(prefix_to_strip):
                    actual_key = key_str[len(prefix_to_strip):]
                else:
                    link_idx = key_str.find('link:')
                    if link_idx == -1:
                        continue
                    actual_key = key_str[link_idx:]

                parts = actual_key.split(":")

                # Format is link:{id}:unique_clicks (3 parts)
                if len(parts) == 3 and parts[0] == 'link' and parts[2] == 'unique_clicks':
                    link_id = parts[1]

                    # Atomic get and reset
                    pipe = redis_client.pipeline()
                    pipe.get(key)
                    pipe.set(key, 0)
                    results = pipe.execute()
                    count = results[0]

                    if count:
                        val = int(count) if isinstance(count, (int, str)) else int(count.decode()) if count else 0
                        if val > 0:
                            Link.objects.filter(id=link_id).update(
                                unique_clicks=F("unique_clicks") + val
                            )
                            updated_unique += 1
            except Exception as e:
                logger.error(f"Error processing unique clicks key {key}: {e}")
                continue

    except Exception as e:
        logger.exception(f"Failed to sync click counters: {e}")

    if updated_total or updated_unique:
        logger.info(f"Synced click counters: {updated_total} total, {updated_unique} unique")

    return f"Synced {updated_total} total, {updated_unique} unique"


@shared_task(queue="analytics")
def sync_qr_scan_counters():
    """
    Sync QR scan counters from Redis to database.
    Runs every 5 minutes.
    Syncs both total_scans and unique_scans.
    """
    from apps.qrcodes.models import QRCode

    updated_total = 0
    updated_unique = 0

    try:
        # Get Redis client
        redis_client = None
        if hasattr(cache, 'client'):
            redis_client = cache.client.get_client()
        elif hasattr(cache, '_cache'):
            redis_client = cache._cache.get_client()

        if not redis_client:
            logger.warning("Cache backend doesn't support direct Redis access")
            return "Skipped - no Redis client"

        key_prefix = getattr(cache, 'key_prefix', '') or ''
        version = getattr(cache, 'version', 1) or 1

        # Build search patterns for both total and unique scans
        if key_prefix:
            total_pattern = f"{key_prefix}:{version}:qr:*:scans"
            unique_pattern = f"{key_prefix}:{version}:qr:*:unique_scans"
            prefix_to_strip = f"{key_prefix}:{version}:"
        else:
            total_pattern = f"*:qr:*:scans"
            unique_pattern = f"*:qr:*:unique_scans"
            prefix_to_strip = ""

        # Sync total scans
        for key in redis_client.scan_iter(match=total_pattern, count=100):
            try:
                key_str = key.decode() if isinstance(key, bytes) else key

                if prefix_to_strip and key_str.startswith(prefix_to_strip):
                    actual_key = key_str[len(prefix_to_strip):]
                else:
                    qr_idx = key_str.find('qr:')
                    if qr_idx == -1:
                        continue
                    actual_key = key_str[qr_idx:]

                parts = actual_key.split(":")

                # Format is qr:{id}:scans (3 parts)
                if len(parts) == 3 and parts[0] == 'qr' and parts[2] == 'scans':
                    qr_id = parts[1]

                    # Atomic get and reset
                    pipe = redis_client.pipeline()
                    pipe.get(key)
                    pipe.set(key, 0)
                    results = pipe.execute()
                    count = results[0]

                    if count:
                        val = int(count) if isinstance(count, (int, str)) else int(count.decode()) if count else 0
                        if val > 0:
                            QRCode.objects.filter(id=qr_id).update(
                                total_scans=F("total_scans") + val
                            )
                            updated_total += 1
            except Exception as e:
                logger.error(f"Error processing QR total scans key {key}: {e}")
                continue

        # Sync unique scans
        for key in redis_client.scan_iter(match=unique_pattern, count=100):
            try:
                key_str = key.decode() if isinstance(key, bytes) else key

                if prefix_to_strip and key_str.startswith(prefix_to_strip):
                    actual_key = key_str[len(prefix_to_strip):]
                else:
                    qr_idx = key_str.find('qr:')
                    if qr_idx == -1:
                        continue
                    actual_key = key_str[qr_idx:]

                parts = actual_key.split(":")

                # Format is qr:{id}:unique_scans (3 parts)
                if len(parts) == 3 and parts[0] == 'qr' and parts[2] == 'unique_scans':
                    qr_id = parts[1]

                    # Atomic get and reset
                    pipe = redis_client.pipeline()
                    pipe.get(key)
                    pipe.set(key, 0)
                    results = pipe.execute()
                    count = results[0]

                    if count:
                        val = int(count) if isinstance(count, (int, str)) else int(count.decode()) if count else 0
                        if val > 0:
                            QRCode.objects.filter(id=qr_id).update(
                                unique_scans=F("unique_scans") + val
                            )
                            updated_unique += 1
            except Exception as e:
                logger.error(f"Error processing QR unique scans key {key}: {e}")
                continue

    except Exception as e:
        logger.exception(f"Failed to sync QR scan counters: {e}")

    if updated_total or updated_unique:
        logger.info(f"Synced QR scan counters: {updated_total} total, {updated_unique} unique")

    return f"Synced {updated_total} total, {updated_unique} unique"


@shared_task(queue="bulk")
def cleanup_old_analytics():
    """
    Delete analytics data older than retention period.
    Runs daily at 2am UTC.
    """
    from .models import ClickEvent
    from apps.users.models import User, Subscription
    
    deleted_count = 0

    # Process by user to respect their plan's retention from settings
    for subscription in Subscription.objects.select_related("user"):
        plan_limits = settings.PLAN_LIMITS.get(subscription.plan, settings.PLAN_LIMITS["free"])
        plan_retention = plan_limits.get("analytics_retention_days", 30)
        cutoff = timezone.now() - timedelta(days=plan_retention)
        
        # Get user's links
        link_ids = list(subscription.user.links.values_list("id", flat=True))
        
        if link_ids:
            # Delete old clicks
            deleted, _ = ClickEvent.objects.filter(
                link_id__in=link_ids,
                clicked_at__lt=cutoff
            ).delete()
            deleted_count += deleted
    
    logger.info(f"Deleted {deleted_count} old click events")
    return f"Deleted {deleted_count} events"


@shared_task(queue="bulk")
def partition_maintenance():
    """
    Create new partitions and drop old ones.
    Runs monthly on the 1st at 4am.
    """
    from django.db import connection
    
    import re

    # This is PostgreSQL-specific
    now = timezone.now()

    # Create partition for next month
    next_month = (now.replace(day=1) + timedelta(days=32)).replace(day=1)
    month_after = (next_month + timedelta(days=32)).replace(day=1)

    partition_name = f"clicks_{next_month.strftime('%Y_%m')}"

    # Validate partition names against allowlist pattern to prevent SQL injection
    partition_pattern = re.compile(r'^clicks_\d{4}_\d{2}$')
    if not partition_pattern.match(partition_name):
        logger.error(f"Invalid partition name generated: {partition_name}")
        return "Partition maintenance aborted - invalid name"

    with connection.cursor() as cursor:
        try:
            cursor.execute(
                f"CREATE TABLE IF NOT EXISTS {partition_name} PARTITION OF clicks "
                "FOR VALUES FROM (%s) TO (%s)",
                [next_month.strftime('%Y-%m-%d'), month_after.strftime('%Y-%m-%d')]
            )
            logger.info(f"Created partition {partition_name}")
        except Exception as e:
            logger.debug(f"Partition {partition_name} might already exist: {e}")

    # Drop partitions older than 2 years (keep for compliance)
    two_years_ago = now - timedelta(days=730)
    old_partition = f"clicks_{two_years_ago.strftime('%Y_%m')}"

    if not partition_pattern.match(old_partition):
        logger.error(f"Invalid old partition name generated: {old_partition}")
        return "Partition maintenance aborted - invalid name"

    with connection.cursor() as cursor:
        try:
            cursor.execute(f"DROP TABLE IF EXISTS {old_partition}")
            logger.info(f"Dropped old partition {old_partition}")
        except Exception as e:
            logger.debug(f"Could not drop partition: {e}")

    return "Partition maintenance complete"


@shared_task(queue="bulk", time_limit=1800)
def export_analytics(user_id, period, format, link_ids=None):
    """
    Export analytics data to CSV or JSON.
    """
    from .models import ClickEvent
    from apps.links.models import Link
    from apps.users.models import User
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {"error": "User not found"}
    
    # Get period dates
    from .services import get_period_dates
    start_date, end_date = get_period_dates(period)
    
    # Get links
    if link_ids:
        links = Link.objects.filter(id__in=link_ids, user=user)
    else:
        links = Link.objects.filter(user=user)
    
    link_ids = list(links.values_list("id", flat=True))
    
    # Get clicks
    clicks = ClickEvent.objects.filter(
        link_id__in=link_ids,
        clicked_at__gte=start_date,
        clicked_at__lte=end_date,
    ).values(
        "link__short_code", "clicked_at", "country_name", "city",
        "device_type", "browser", "os", "referer"
    )
    
    if format == "csv":
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            "short_code", "clicked_at", "country", "city",
            "device", "browser", "os", "referer"
        ])
        writer.writeheader()
        
        for click in clicks.iterator():
            writer.writerow({
                "short_code": click["link__short_code"],
                "clicked_at": click["clicked_at"].isoformat(),
                "country": click["country_name"],
                "city": click["city"],
                "device": click["device_type"],
                "browser": click["browser"],
                "os": click["os"],
                "referer": click["referer"][:100] if click["referer"] else "",
            })
        
        content = output.getvalue()
        content_type = "text/csv"
        filename = f"analytics-export-{user_id}-{period}.csv"
        
    else:  # JSON
        data = []
        for click in clicks.iterator():
            data.append({
                "short_code": click["link__short_code"],
                "clicked_at": click["clicked_at"].isoformat(),
                "country": click["country_name"],
                "city": click["city"],
                "device": click["device_type"],
                "browser": click["browser"],
                "os": click["os"],
                "referer": click["referer"],
            })
        
        content = json.dumps(data, indent=2)
        content_type = "application/json"
        filename = f"analytics-export-{user_id}-{period}.json"
    
    # Upload to S3
    if not settings.DEBUG:
        import boto3
        
        s3_client = boto3.client(
            "s3",
            region_name=settings.AWS_S3_REGION_NAME,
        )
        
        path = f"exports/{user_id}/{filename}"
        s3_client.put_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=path,
            Body=content.encode(),
            ContentType=content_type,
        )
        
        # Generate signed URL
        download_url = s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
                "Key": path,
            },
            ExpiresIn=86400,  # 24 hours
        )
        
        # Send email with download link
        from apps.users.tasks import send_export_ready_email
        send_export_ready_email.delay(user_id, download_url)
        
        return {"download_url": download_url}
    
    # In debug mode, just return the content
    return {
        "format": format,
        "count": len(content),
        "preview": content[:1000],
    }

