"""
Celery tasks for QR codes app.
"""

import hashlib
import logging
import tempfile
from io import BytesIO

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)

# Chunk size for bulk_create operations
_BULK_CHUNK_SIZE = 50


@shared_task(queue="analytics")
def track_qr_scan(scan_data):
    """
    Process and store QR scan event using unified ClickEvent model.
    Called asynchronously after QR code redirect.

    Properly tracks unique_ips, unique_countries, and unique_locations for serial codes
    using Redis sets per serial code.
    """
    from apps.analytics.models import ClickEvent
    from apps.links.tasks import parse_user_agent, get_geo_from_ip
    from .models import QRCode

    try:
        qr_id = scan_data.get("qr_id")

        # Get QR code with related objects
        try:
            qr = QRCode.objects.select_related("link", "campaign").get(id=qr_id)
        except QRCode.DoesNotExist:
            logger.error(f"QR code {qr_id} not found for scan tracking")
            return

        # Parse user agent
        ua_data = parse_user_agent(scan_data.get("user_agent", ""))

        # Get geo data from IP
        geo_data = get_geo_from_ip(scan_data.get("ip", ""))

        # Hash IP for privacy
        ip_hash = hashlib.sha256(scan_data.get("ip", "").encode()).hexdigest()

        # Check if first scan (for serialized QRs)
        is_first = False
        serial_number = ""

        if hasattr(qr, "serial"):
            serial = qr.serial
            serial_number = serial.serial_number

            if not serial.first_scanned_at:
                is_first = True
                serial.first_scanned_at = timezone.now()
                serial.first_scan_ip_hash = ip_hash
                serial.first_scan_country = (geo_data.get("country_code") or "")[:2]
                serial.first_scan_city = (geo_data.get("city") or "")[:100]
                serial.first_scan_device = (ua_data.get("device_type") or "")[:100]
                location = f"{geo_data.get('city', '')}, {geo_data.get('country_name', '')}"
                serial.first_scan_location = location.strip(", ")
                serial.save(update_fields=[
                    "first_scanned_at", "first_scan_ip_hash", "first_scan_location",
                    "first_scan_country", "first_scan_city", "first_scan_device",
                ])

            # Increment serial scan count atomically
            from .models import SerialCode
            SerialCode.objects.filter(pk=serial.pk).update(
                total_scans=models.F("total_scans") + 1
            )

            # --- Track unique_ips via Redis set ---
            ip_set_key = f"serial:{serial.pk}:ips"
            is_new_ip = _sadd(ip_set_key, ip_hash[:16])
            if is_new_ip:
                SerialCode.objects.filter(pk=serial.pk).update(
                    unique_ips=models.F("unique_ips") + 1
                )

            # --- Track unique_countries via Redis set ---
            country_code = geo_data.get("country_code") or ""
            if country_code:
                country_set_key = f"serial:{serial.pk}:countries"
                is_new_country = _sadd(country_set_key, country_code)
                if is_new_country:
                    SerialCode.objects.filter(pk=serial.pk).update(
                        unique_countries=models.F("unique_countries") + 1
                    )

            # --- Track unique_locations via Redis set ---
            city = geo_data.get("city") or ""
            if city and country_code:
                loc_set_key = f"serial:{serial.pk}:locations"
                loc_value = f"{city}:{country_code}"
                is_new_loc = _sadd(loc_set_key, loc_value)
                if is_new_loc:
                    SerialCode.objects.filter(pk=serial.pk).update(
                        unique_locations=models.F("unique_locations") + 1
                    )

            # Refresh from DB for suspicion scoring (avoid stale F() values)
            serial.refresh_from_db()

            # Recalculate suspicion score
            score = serial._calculate_suspicion(ip_hash, geo_data)
            if score > 70 and serial.status == "active":
                serial.status = "suspicious"
                serial.status_reason = f"High suspicion score: {score}"
                serial.status_changed_at = timezone.now()
            serial.suspicion_score = score
            serial.save(update_fields=[
                "suspicion_score", "suspicion_reasons", "status",
                "status_reason", "status_changed_at",
            ])

        # Create unified click event
        ClickEvent.objects.create(
            link=qr.link if qr.link else None,
            qr_code=qr,
            campaign=qr.campaign if hasattr(qr, "campaign") and qr.campaign else None,
            variant_id=scan_data.get("variant_id"),
            clicked_at=scan_data.get("scanned_at") or timezone.now(),
            ip_hash=ip_hash,
            user_agent=scan_data.get("user_agent", "")[:500],
            referer=scan_data.get("referer", "")[:500],
            country_code=geo_data.get("country_code") or "",
            country_name=geo_data.get("country_name") or "",
            region=geo_data.get("region") or "",
            city=geo_data.get("city") or "",
            latitude=geo_data.get("latitude"),
            longitude=geo_data.get("longitude"),
            timezone=geo_data.get("timezone") or "",
            device_type=ua_data.get("device_type") or "",
            browser=ua_data.get("browser") or "",
            browser_version=ua_data.get("browser_version") or "",
            os=ua_data.get("os") or "",
            os_version=ua_data.get("os_version") or "",
            is_qr_scan=True,
            is_first_scan=is_first,
            serial_number=serial_number,
        )

        # Update QR code scan counter
        QRCode.objects.filter(id=qr_id).update(
            total_scans=models.F("total_scans") + 1
        )

        # Increment Redis counter for real-time stats
        cache_key = f"qr:{qr_id}:scans"
        try:
            cache.incr(cache_key)
        except ValueError:
            cache.set(cache_key, 1, timeout=86400)

        # Track unique scans
        unique_key = f"qr:{qr_id}:unique:{ip_hash[:16]}"
        if not cache.get(unique_key):
            cache.set(unique_key, 1, timeout=86400)
            unique_cache_key = f"qr:{qr_id}:unique_scans"
            try:
                cache.incr(unique_cache_key)
            except ValueError:
                cache.set(unique_cache_key, 1, timeout=86400)

        logger.debug(f"Scan tracked for QR code {qr_id}")

    except Exception as e:
        logger.exception(f"Failed to track QR scan: {e}")


def _sadd(key: str, value: str) -> bool:
    """Add value to a Redis set. Returns True if the value was new.

    Falls back to a cache-based approach if Redis SADD is not available.
    """
    try:
        redis_client = cache.client.get_client()
        return bool(redis_client.sadd(key, value))
    except (AttributeError, Exception):
        # Fallback: use cache key per member
        member_key = f"{key}:{value}"
        if cache.get(member_key):
            return False
        cache.set(member_key, 1, timeout=86400 * 30)  # 30 days
        return True


@shared_task(queue="default")
def generate_qr_images(qr_id):
    """
    Generate QR code images in all formats and upload to storage.
    """
    from .models import QRCode
    
    try:
        qr = QRCode.objects.get(id=qr_id)
    except QRCode.DoesNotExist:
        logger.error(f"QR code {qr_id} not found")
        return
    
    user_id = str(qr.user_id)
    
    try:
        # Generate PNG
        png_bytes = qr.generate_png(size=300)
        png_path = f"qr-codes/{user_id}/{qr_id}/qr.png"
        save_to_storage(png_path, png_bytes, "image/png")
        
        # Generate SVG
        svg_content = qr.generate_svg()
        svg_path = f"qr-codes/{user_id}/{qr_id}/qr.svg"
        save_to_storage(svg_path, svg_content.encode(), "image/svg+xml")
        
        # Generate PDF
        pdf_bytes = qr.generate_pdf()
        pdf_path = f"qr-codes/{user_id}/{qr_id}/qr.pdf"
        save_to_storage(pdf_path, pdf_bytes, "application/pdf")
        
        # Update paths in database
        qr.png_path = png_path
        qr.svg_path = svg_path
        qr.pdf_path = pdf_path
        qr.save(update_fields=["png_path", "svg_path", "pdf_path"])
        
        logger.info(f"Generated QR images for {qr_id}")
        
    except Exception as e:
        logger.exception(f"Failed to generate QR images for {qr_id}: {e}")


def save_to_storage(path, content, content_type):
    """
    Save content to storage (local in dev, S3 in production).
    """
    if settings.DEBUG:
        # Save locally
        from pathlib import Path
        full_path = Path(settings.MEDIA_ROOT) / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content if isinstance(content, bytes) else content.encode())
    else:
        # Save to S3
        import boto3
        
        s3_client = boto3.client(
            "s3",
            region_name=settings.AWS_S3_REGION_NAME,
        )
        
        s3_client.put_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=path,
            Body=content,
            ContentType=content_type,
        )


@shared_task(queue="bulk")
def regenerate_all_qr_codes(user_id=None):
    """
    Regenerate all QR codes (useful after design system update).
    """
    from .models import QRCode
    
    queryset = QRCode.objects.all()
    if user_id:
        queryset = queryset.filter(user_id=user_id)
    
    count = 0
    for qr in queryset.iterator():
        generate_qr_images.delay(str(qr.id))
        count += 1
    
    logger.info(f"Queued {count} QR codes for regeneration")
    return f"Queued {count} QR codes"


@shared_task(queue="bulk")
def cleanup_orphaned_qr_files():
    """
    Clean up QR code files that no longer have database records.
    """
    if settings.DEBUG:
        return "Skipped in debug mode"
    
    import boto3
    from .models import QRCode
    
    s3_client = boto3.client(
        "s3",
        region_name=settings.AWS_S3_REGION_NAME,
    )
    
    # List all QR code files
    paginator = s3_client.get_paginator("list_objects_v2")
    
    deleted_count = 0
    
    for page in paginator.paginate(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Prefix="qr-codes/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            
            # Extract QR ID from path
            parts = key.split("/")
            if len(parts) >= 3:
                qr_id = parts[2]
                
                # Check if QR exists
                if not QRCode.objects.filter(id=qr_id).exists():
                    s3_client.delete_object(
                        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                        Key=key,
                    )
                    deleted_count += 1
    
    logger.info(f"Deleted {deleted_count} orphaned QR files")
    return f"Deleted {deleted_count} files"


# =============================================================================
# SERIAL BATCH GENERATION
# =============================================================================

@shared_task(bind=True, queue="bulk")
def generate_serial_batch(self, batch_id):
    """
    Generate a batch of serialized QR codes.

    Uses bulk_create for DB inserts and a temp file for ZIP to avoid
    holding everything in memory for large batches.
    """
    import csv
    import json
    import uuid as uuid_module
    import zipfile
    from io import StringIO
    from apps.links.models import generate_short_code

    from .models import SerialBatch, SerialCode, QRCode
    from .rendering import render_png

    try:
        batch = SerialBatch.objects.get(id=batch_id)
    except SerialBatch.DoesNotExist:
        logger.error(f"Serial batch {batch_id} not found")
        return

    batch.status = "processing"
    batch.started_at = timezone.now()
    batch.celery_task_id = self.request.id
    batch.save(update_fields=["status", "started_at", "celery_task_id"])

    try:
        base_url = getattr(settings, "SITE_URL", f"https://{settings.DEFAULT_SHORT_DOMAIN}")
        csv_rows = [["serial_number", "qr_code_id", "short_code", "verify_url", "destination_url"]]

        # Use a temp file for the ZIP to avoid holding entire archive in RAM
        zip_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")

        # Pre-generate all serial numbers
        existing_serials = set(
            SerialCode.objects.values_list("serial_number", flat=True)
        )
        serials = []
        while len(serials) < batch.quantity:
            suffix = uuid_module.uuid4().hex[:12].upper()
            sn = f"{batch.prefix}{suffix}" if batch.prefix else suffix
            if sn not in existing_serials:
                existing_serials.add(sn)
                serials.append(sn)

        # Bulk-create QR code records in chunks
        qr_objs = []
        for sn in serials:
            dest_url = (
                batch.destination_url_template.replace("{serial}", sn)
                if batch.destination_url_template else ""
            )
            qr_objs.append(QRCode(
                user=batch.user,
                team=batch.team,
                qr_type="serial",
                title=f"{batch.product_name} - {sn}" if batch.product_name else sn,
                is_dynamic=True,
                short_code=generate_short_code(8),
                destination_url=dest_url,
                style=batch.style,
                frame=batch.frame,
                foreground_color=batch.foreground_color,
                background_color=batch.background_color,
                logo_url=batch.logo_url,
                eye_style=batch.eye_style,
                eye_color=batch.eye_color,
                gradient_enabled=batch.gradient_enabled,
                gradient_start=batch.gradient_start,
                gradient_end=batch.gradient_end,
                gradient_direction=batch.gradient_direction,
                content_data={
                    "serial_number": sn,
                    "product_name": batch.product_name,
                    "product_sku": batch.product_sku,
                },
            ))

        created_qrs = []
        for i in range(0, len(qr_objs), _BULK_CHUNK_SIZE):
            chunk = qr_objs[i : i + _BULK_CHUNK_SIZE]
            created_qrs.extend(QRCode.objects.bulk_create(chunk))

        # Bulk-create serial code records
        serial_objs = []
        meta_base = {
            "product_name": batch.product_name,
            "product_sku": batch.product_sku,
            "product_category": batch.product_category,
            "manufacture_date": str(batch.manufacture_date) if batch.manufacture_date else None,
            "expiry_date": str(batch.expiry_date) if batch.expiry_date else None,
            **batch.batch_metadata,
        }
        for sn, qr in zip(serials, created_qrs):
            serial_objs.append(SerialCode(
                batch=batch,
                qr_code=qr,
                serial_number=sn,
                metadata=dict(meta_base),
            ))

        for i in range(0, len(serial_objs), _BULK_CHUNK_SIZE):
            chunk = serial_objs[i : i + _BULK_CHUNK_SIZE]
            SerialCode.objects.bulk_create(chunk)

        # Generate images and write to ZIP
        render_kwargs_base = {
            "size": 1024,
            "style": batch.style,
            "frame": batch.frame,
            "frame_text": "",
            "fg_color": batch.foreground_color,
            "bg_color": batch.background_color,
            "eye_style": batch.eye_style,
            "eye_color": batch.eye_color or "",
            "logo_url": batch.logo_url,
            "gradient_enabled": batch.gradient_enabled,
            "gradient_start": batch.gradient_start,
            "gradient_end": batch.gradient_end,
            "gradient_direction": batch.gradient_direction,
        }

        with zipfile.ZipFile(zip_tmp, "w", zipfile.ZIP_DEFLATED) as zf:
            for idx, (sn, qr) in enumerate(zip(serials, created_qrs)):
                verify_url = f"{base_url}/verify/{sn}"
                dest_url = (
                    batch.destination_url_template.replace("{serial}", sn)
                    if batch.destination_url_template else ""
                )

                try:
                    png_bytes = render_png(content=verify_url, **render_kwargs_base)
                    zf.writestr(f"qr-codes/{sn}.png", png_bytes)
                except Exception as img_err:
                    logger.warning(f"Failed to generate image for {sn}: {img_err}")

                csv_rows.append([sn, str(qr.id), qr.short_code or "", verify_url, dest_url])

                # Update progress periodically
                if (idx + 1) % 10 == 0 or idx == batch.quantity - 1:
                    batch.generated_count = idx + 1
                    batch.save(update_fields=["generated_count"])
                    self.update_state(
                        state="PROGRESS",
                        meta={
                            "current": idx + 1,
                            "total": batch.quantity,
                            "percent": round(((idx + 1) / batch.quantity) * 100, 1),
                        },
                    )

            # CSV manifest
            csv_buf = StringIO()
            csv.writer(csv_buf).writerows(csv_rows)
            zf.writestr("serial_codes.csv", csv_buf.getvalue())

            # Metadata JSON
            zf.writestr("metadata.json", json.dumps({
                "batch_id": str(batch.id),
                "batch_name": batch.name,
                "quantity": batch.quantity,
                "prefix": batch.prefix,
                "product_name": batch.product_name,
                "product_sku": batch.product_sku,
                "created_at": batch.created_at.isoformat(),
                "generated_at": timezone.now().isoformat(),
            }, indent=2))

        # Upload ZIP to storage
        zip_tmp.seek(0)
        zip_filename = f"serial-batches/{batch.user_id}/{batch.id}/qr-codes.zip"

        if settings.DEBUG:
            from pathlib import Path
            full_path = Path(settings.MEDIA_ROOT) / zip_filename
            full_path.parent.mkdir(parents=True, exist_ok=True)
            with open(zip_tmp.name, "rb") as f:
                full_path.write_bytes(f.read())
            export_url = f"{settings.MEDIA_URL}{zip_filename}"
        else:
            import boto3
            s3_client = boto3.client("s3", region_name=settings.AWS_S3_REGION_NAME)
            with open(zip_tmp.name, "rb") as f:
                s3_client.put_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=zip_filename,
                    Body=f.read(),
                    ContentType="application/zip",
                )
            export_url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": zip_filename},
                ExpiresIn=604800,
            )

        # Clean up temp file
        import os
        try:
            os.unlink(zip_tmp.name)
        except OSError:
            pass

        batch.status = "completed"
        batch.export_file_url = export_url
        batch.completed_at = timezone.now()
        batch.generated_count = batch.quantity
        batch.save(update_fields=["status", "export_file_url", "completed_at", "generated_count"])

        logger.info(f"Serial batch {batch_id} completed: {batch.quantity} codes generated")

        return {
            "status": "completed",
            "batch_id": str(batch_id),
            "quantity": batch.quantity,
            "export_url": export_url,
        }

    except Exception as e:
        logger.exception(f"Serial batch {batch_id} failed: {e}")
        batch.status = "failed"
        batch.error_message = str(e)
        batch.save(update_fields=["status", "error_message"])
        raise


@shared_task(queue="default")
def cancel_serial_batch(batch_id):
    """
    Cancel an in-progress serial batch generation.
    Note: Already generated codes will remain.
    """
    from celery.result import AsyncResult
    from .models import SerialBatch

    try:
        batch = SerialBatch.objects.get(id=batch_id)
    except SerialBatch.DoesNotExist:
        logger.error(f"Serial batch {batch_id} not found for cancellation")
        return

    if batch.status not in ("pending", "processing"):
        logger.warning(f"Cannot cancel batch {batch_id} with status {batch.status}")
        return

    # Revoke Celery task if running
    if batch.celery_task_id:
        AsyncResult(batch.celery_task_id).revoke(terminate=True)

    batch.status = "cancelled"
    batch.error_message = "Batch generation cancelled by user"
    batch.save(update_fields=["status", "error_message"])

    logger.info(f"Serial batch {batch_id} cancelled. {batch.generated_count} codes were already generated.")

    return {
        "status": "cancelled",
        "batch_id": str(batch_id),
        "generated_count": batch.generated_count,
    }


@shared_task(queue="bulk")
def cleanup_expired_batch_exports():
    """
    Clean up export files for old serial batches.
    Runs daily to manage storage usage.
    """
    from datetime import timedelta
    from .models import SerialBatch

    # Keep exports for 30 days
    cutoff_date = timezone.now() - timedelta(days=30)

    old_batches = SerialBatch.objects.filter(
        completed_at__lt=cutoff_date,
        export_file_url__isnull=False,
    ).exclude(export_file_url="")

    if settings.DEBUG:
        # Local cleanup
        from pathlib import Path
        for batch in old_batches:
            if batch.export_file_url:
                # Extract path from URL
                path = batch.export_file_url.replace(settings.MEDIA_URL, "")
                full_path = Path(settings.MEDIA_ROOT) / path
                if full_path.exists():
                    full_path.unlink()
                    logger.info(f"Deleted export file for batch {batch.id}")
    else:
        # S3 cleanup
        import boto3

        s3_client = boto3.client(
            "s3",
            region_name=settings.AWS_S3_REGION_NAME,
        )

        for batch in old_batches:
            try:
                # Extract key from URL
                key = f"serial-batches/{batch.user_id}/{batch.id}/qr-codes.zip"
                s3_client.delete_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=key,
                )
                logger.info(f"Deleted S3 export for batch {batch.id}")
            except Exception as e:
                logger.warning(f"Failed to delete S3 export for batch {batch.id}: {e}")

    # Clear export URLs
    count = old_batches.update(export_file_url="")
    logger.info(f"Cleaned up {count} old batch exports")

    return f"Cleaned up {count} exports"
