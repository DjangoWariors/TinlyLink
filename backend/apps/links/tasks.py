"""
Celery tasks for links app.
Click tracking, cleanup, domain verification.
"""

import hashlib
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(queue="analytics")
def track_click(click_data):
    """
    Process and store click event.
    Called asynchronously after redirect.
    Supports unified analytics with campaign and variant tracking.
    """
    from apps.analytics.models import ClickEvent
    from .models import Link

    try:
        link_id = click_data.get("link_id")

        # Parse user agent
        ua_data = parse_user_agent(click_data.get("user_agent", ""))

        # Get geo data from IP
        geo_data = get_geo_from_ip(click_data.get("ip", ""))

        # Hash IP for privacy
        ip_hash = hashlib.sha256(click_data.get("ip", "").encode()).hexdigest()

        # Get optional campaign and variant IDs
        campaign_id = click_data.get("campaign_id")
        variant_id = click_data.get("variant_id")

        # Create click event with unified tracking fields
        ClickEvent.objects.create(
            link_id=link_id,
            campaign_id=campaign_id,
            variant_id=variant_id,
            clicked_at=click_data.get("clicked_at"),
            ip_hash=ip_hash,
            user_agent=click_data.get("user_agent", "")[:500],
            referer=click_data.get("referer", "")[:500],

            # Geo data
            country_code=geo_data.get("country_code") or "",
            country_name=geo_data.get("country_name") or "",
            region=geo_data.get("region") or "",
            city=geo_data.get("city") or "",
            latitude=geo_data.get("latitude"),
            longitude=geo_data.get("longitude"),
            timezone=geo_data.get("timezone") or "",

            # Device data
            device_type=ua_data.get("device_type") or "",
            browser=ua_data.get("browser") or "",
            browser_version=ua_data.get("browser_version") or "",
            os=ua_data.get("os") or "",
            os_version=ua_data.get("os_version") or "",

            # QR tracking
            is_qr_scan=click_data.get("is_qr_scan", False),
        )

        # Increment Redis counter for real-time stats
        cache_key = f"link:{link_id}:clicks"
        try:
            cache.incr(cache_key)
        except ValueError:
            cache.set(cache_key, 1, timeout=86400)

        # Track unique clicks
        unique_key = f"link:{link_id}:unique:{ip_hash[:16]}"
        if not cache.get(unique_key):
            cache.set(unique_key, 1, timeout=86400)
            unique_cache_key = f"link:{link_id}:unique_clicks"
            try:
                cache.incr(unique_cache_key)
            except ValueError:
                cache.set(unique_cache_key, 1, timeout=86400)

        logger.debug(f"Click tracked for link {link_id}")

    except Exception as e:
        logger.exception(f"Failed to track click: {e}")


def parse_user_agent(ua_string):
    """Parse user agent string to extract device info."""
    try:
        from user_agents import parse
        ua = parse(ua_string)
        
        # Determine device type
        if ua.is_mobile:
            device_type = "mobile"
        elif ua.is_tablet:
            device_type = "tablet"
        else:
            device_type = "desktop"
        
        return {
            "device_type": device_type,
            "browser": ua.browser.family[:50] if ua.browser.family else None,
            "browser_version": ua.browser.version_string[:20] if ua.browser.version_string else None,
            "os": ua.os.family[:50] if ua.os.family else None,
            "os_version": ua.os.version_string[:20] if ua.os.version_string else None,
        }
    except Exception:
        return {
            "device_type": "desktop",
            "browser": None,
            "browser_version": None,
            "os": None,
            "os_version": None,
        }


def get_geo_from_ip(ip_address):
    """Get geographic data from IP address using MaxMind."""
    if not ip_address or ip_address in ("127.0.0.1", "localhost", "::1"):
        return {
            "country_code": "XX",
            "country_name": "Unknown",
            "region": "Unknown",
            "city": "Unknown",
            "latitude": None,
            "longitude": None,
            "timezone": "UTC",
        }
    
    try:
        import geoip2.database
        
        reader = geoip2.database.Reader(f"{settings.GEOIP_PATH}/GeoLite2-City.mmdb")
        response = reader.city(ip_address)
        
        return {
            "country_code": response.country.iso_code,
            "country_name": response.country.name,
            "region": response.subdivisions.most_specific.name if response.subdivisions else None,
            "city": response.city.name,
            "latitude": float(response.location.latitude) if response.location.latitude else None,
            "longitude": float(response.location.longitude) if response.location.longitude else None,
            "timezone": response.location.time_zone,
        }
    except Exception as e:
        logger.debug(f"GeoIP lookup failed for {ip_address}: {e}")
        return {}


@shared_task(queue="default")
def cleanup_expired_links():
    """
    Mark expired links as inactive and invalidate their cache.
    Runs hourly. Processes all expired links in batches.
    """
    from .models import Link

    now = timezone.now()

    # Find and deactivate expired links
    expired = Link.objects.filter(
        expires_at__lt=now,
        is_active=True,
    )

    count = expired.update(is_active=False)

    if count > 0:
        logger.info(f"Deactivated {count} expired links")

        # Invalidate cache for all expired links in batches
        batch_size = 100
        invalidated = 0
        expired_links = Link.objects.filter(expires_at__lt=now, is_active=False)

        for link in expired_links.iterator(chunk_size=batch_size):
            link.invalidate_cache()
            invalidated += 1

        logger.info(f"Invalidated cache for {invalidated} expired links")

    return f"Deactivated {count} links"


@shared_task(queue="default")
def verify_pending_domains():
    """
    Check DNS records for pending domain verifications.
    Runs every 15 minutes.
    """
    from .models import CustomDomain
    
    pending = CustomDomain.objects.filter(is_verified=False)
    
    verified_count = 0
    for domain in pending:
        try:
            if domain.verify_dns():
                verified_count += 1
                logger.info(f"Domain {domain.domain} verified")
        except Exception as e:
            logger.debug(f"DNS verification failed for {domain.domain}: {e}")
    
    return f"Verified {verified_count} domains"


@shared_task(queue="bulk")
def bulk_create_links(user_id, urls, campaign_id=None):
    """
    Create multiple links in bulk.
    """
    from .models import Link
    from apps.users.models import User, UsageTracking
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {"error": "User not found"}
    
    created = []
    errors = []
    
    for url in urls:
        # Validate URL
        is_valid, error = Link.validate_url(url)
        if not is_valid:
            errors.append({"url": url, "error": error})
            continue
        
        try:
            link = Link.objects.create(
                user=user,
                original_url=url,
                campaign_id=campaign_id,
            )
            created.append(str(link.id))
            
            # Track usage
            usage = UsageTracking.get_current_period(user)
            usage.increment_links()
            
        except Exception as e:
            errors.append({"url": url, "error": str(e)})
    
    return {
        "created": len(created),
        "errors": errors,
    }


@shared_task(queue="bulk")
def export_links(user_id, format="csv"):
    """
    Export user's links to CSV or JSON.
    """
    import csv
    import json
    from io import StringIO
    
    from .models import Link
    from apps.users.models import User
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {"error": "User not found"}
    
    links = Link.objects.filter(user=user).values(
        "short_code", "original_url", "title", "total_clicks",
        "is_active", "created_at"
    )
    
    if format == "csv":
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            "short_code", "original_url", "title", "total_clicks", "is_active", "created_at"
        ])
        writer.writeheader()
        # Use iterator to prevent loading all objects into memory
        for link in links.iterator():
            link["created_at"] = link["created_at"].isoformat()
            writer.writerow(link)
        
        content = output.getvalue()
        
    else:  # JSON
        links_list = list(links)
        for link in links_list:
            link["created_at"] = link["created_at"].isoformat()
        content = json.dumps(links_list, indent=2)
    
    # In production, upload to S3 and return signed URL
    # For now, return the content directly
    return {
        "format": format,
        "count": len(links),
        "content": content[:10000],  # Truncate for task result
    }
