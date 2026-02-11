"""
QR Code models for TinlyLink.
"""

import uuid
import io
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import models



class QRCode(models.Model):
    """
    QR Code model - supports multiple content types.
    Enhanced with payment, product, and multi-destination types.
    """

    STYLE_CHOICES = [
        ("square", "Square"),
        ("dots", "Dots"),
        ("rounded", "Rounded"),
    ]

    EYE_STYLE_CHOICES = [
        ("square", "Square"),
        ("circle", "Circle"),
        ("rounded", "Rounded"),
        ("leaf", "Leaf"),
        ("diamond", "Diamond"),
    ]

    FRAME_CHOICES = [
        ("none", "None"),
        ("simple", "Simple Border"),
        ("scan_me", "Scan Me"),
        ("balloon", "Speech Balloon"),
        ("badge", "ID Badge"),
        ("phone", "Phone Mockup"),
        ("polaroid", "Polaroid"),
        ("laptop", "Laptop Mockup"),
        ("ticket", "Event Ticket"),
        ("card", "Card"),
        ("tag", "Price Tag"),
        ("certificate", "Certificate"),
    ]

    GRADIENT_DIRECTION_CHOICES = [
        ("vertical", "Vertical"),
        ("horizontal", "Horizontal"),
        ("diagonal", "Diagonal"),
        ("radial", "Radial"),
    ]

    TYPE_CHOICES = [
        # Basic types
        ("link", "Website Link"),
        ("vcard", "Contact Card"),
        ("wifi", "WiFi Network"),
        ("email", "Email"),
        ("sms", "SMS Message"),
        ("phone", "Phone Call"),
        ("text", "Plain Text"),
        ("calendar", "Calendar Event"),
        ("location", "Location"),
        # Payment types
        ("upi", "UPI Payment"),
        ("pix", "Pix Payment (Brazil)"),
        # Product/Business types
        ("product", "Product Information"),
        ("menu", "Restaurant Menu"),
        # Document types
        ("document", "Document/File"),
        ("pdf", "PDF Document"),
        # Multi-destination types
        ("multi_url", "Multiple Links"),
        ("app_store", "App Store Links"),
        ("social", "Social Media Hub"),
        # Enterprise types
        ("serial", "Serialized Product"),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="qr_codes"
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="qr_codes"
    )
    
    # QR Content
    qr_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="link")
    title = models.CharField(max_length=200, blank=True, help_text="User-friendly name for this QR code")
    
    # Link type: uses this field
    link = models.OneToOneField(
        "links.Link",
        on_delete=models.CASCADE,
        related_name="qr_code",
        null=True,
        blank=True
    )
    
    # Other types: store data as JSON
    content_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Type-specific content data (vcard, wifi, etc.)"
    )
    
    # Dynamic QR - can change destination without reprinting (Pro+)
    is_dynamic = models.BooleanField(default=False)
    short_code = models.CharField(max_length=10, unique=True, blank=True, null=True)
    destination_url = models.URLField(max_length=2048, blank=True)
    
    # Design settings - Basic
    style = models.CharField(max_length=20, choices=STYLE_CHOICES, default="square")
    frame = models.CharField(max_length=20, choices=FRAME_CHOICES, default="none")
    frame_text = models.CharField(max_length=50, blank=True, help_text="Custom text for frame label")
    foreground_color = models.CharField(max_length=7, default="#000000")
    background_color = models.CharField(max_length=7, default="#FFFFFF")
    logo_url = models.URLField(max_length=500, blank=True)

    # Design settings - Enhanced
    eye_style = models.CharField(max_length=20, choices=EYE_STYLE_CHOICES, default="square")
    eye_color = models.CharField(max_length=7, blank=True, help_text="Separate color for QR eyes/corners")

    # Gradient settings
    gradient_enabled = models.BooleanField(default=False)
    gradient_start = models.CharField(max_length=7, blank=True)
    gradient_end = models.CharField(max_length=7, blank=True)
    gradient_direction = models.CharField(
        max_length=20,
        choices=GRADIENT_DIRECTION_CHOICES,
        default="vertical"
    )
    
    # File paths (stored in S3 in production)
    png_path = models.CharField(max_length=500, blank=True)
    svg_path = models.CharField(max_length=500, blank=True)
    pdf_path = models.CharField(max_length=500, blank=True)
    
    # Statistics
    total_scans = models.BigIntegerField(default=0)
    unique_scans = models.BigIntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "qr_codes"
        ordering = ["-created_at"]
    
    def __str__(self):
        if self.title:
            return f"QR: {self.title}"
        if self.qr_type == "link" and self.link:
            return f"QR: {self.link.short_code}"
        return f"QR: {self.get_qr_type_display()}"
    
    def save(self, *args, **kwargs):
        is_new = self._state.adding
        update_fields = kwargs.get('update_fields')
        
        # Check design changed BEFORE saving (so we compare against DB values)
        design_changed = not is_new and not update_fields and self._design_changed()
        
        # Generate short_code for dynamic QRs
        if self.is_dynamic and not self.short_code:
            from apps.links.models import generate_short_code
            self.short_code = generate_short_code(8)
        
        super().save(*args, **kwargs)
        
        # Generate QR code images on create or design change
        # Skip if update_fields is specified (called from task to save paths)
        if not update_fields and (is_new or design_changed):
            from .tasks import generate_qr_images
            generate_qr_images.delay(str(self.id))
    
    def _design_changed(self):
        """Check if design settings have changed compared to database."""
        if not self.pk:
            return False
        try:
            old = QRCode.objects.get(pk=self.pk)
            return (
                old.style != self.style or
                old.frame != self.frame or
                old.frame_text != self.frame_text or
                old.foreground_color != self.foreground_color or
                old.background_color != self.background_color or
                old.logo_url != self.logo_url or
                old.eye_style != self.eye_style or
                old.eye_color != self.eye_color or
                old.gradient_enabled != self.gradient_enabled or
                old.gradient_start != self.gradient_start or
                old.gradient_end != self.gradient_end or
                old.gradient_direction != self.gradient_direction or
                old.content_data != self.content_data or
                old.qr_type != self.qr_type
            )
        except QRCode.DoesNotExist:
            return False
    
    @property
    def short_url(self):
        """Get the URL to encode in QR code."""
        if self.qr_type == "link" and self.link:
            return self.link.short_url
        # For dynamic QRs, return the redirect URL
        if self.is_dynamic and self.short_code:
            from django.conf import settings
            return f"{settings.DEFAULT_SHORT_DOMAIN}/q/{self.short_code}"
        return self.get_qr_content()
    
    def get_redirect_url(self):
        """Get the destination URL for dynamic QR redirect."""
        if self.qr_type == "link" and self.link:
            return self.link.original_url
        return self.destination_url

    def get_qr_content(self):
        """Generate the actual content string for the QR code based on type."""
        data = self.content_data or {}
        
        if self.qr_type == "link":
            return self.link.short_url if self.link else data.get("url", "")
        
        elif self.qr_type == "vcard":
            # Generate vCard 3.0 format
            lines = ["BEGIN:VCARD", "VERSION:3.0"]
            if data.get("name"):
                lines.append(f"FN:{data['name']}")
                # Parse first/last name
                parts = data['name'].split(' ', 1)
                if len(parts) == 2:
                    lines.append(f"N:{parts[1]};{parts[0]};;;")
            if data.get("organization"):
                lines.append(f"ORG:{data['organization']}")
            if data.get("title"):
                lines.append(f"TITLE:{data['title']}")
            if data.get("phone"):
                lines.append(f"TEL;TYPE=CELL:{data['phone']}")
            if data.get("email"):
                lines.append(f"EMAIL:{data['email']}")
            if data.get("website"):
                lines.append(f"URL:{data['website']}")
            if data.get("address"):
                lines.append(f"ADR:;;{data['address']};;;;")
            lines.append("END:VCARD")
            return "\n".join(lines)
        
        elif self.qr_type == "wifi":
            # WiFi network format: WIFI:T:WPA;S:network;P:password;;
            auth = data.get("auth", "WPA")
            ssid = data.get("ssid", "")
            password = data.get("password", "")
            hidden = "true" if data.get("hidden") else "false"
            return f"WIFI:T:{auth};S:{ssid};P:{password};H:{hidden};;"
        
        elif self.qr_type == "email":
            email = data.get("email", "")
            subject = data.get("subject", "")
            body = data.get("body", "")
            mailto = f"mailto:{email}"
            params = []
            if subject:
                params.append(f"subject={subject}")
            if body:
                params.append(f"body={body}")
            if params:
                mailto += "?" + "&".join(params)
            return mailto
        
        elif self.qr_type == "sms":
            phone = data.get("phone", "")
            message = data.get("message", "")
            if message:
                return f"SMSTO:{phone}:{message}"
            return f"SMSTO:{phone}"
        
        elif self.qr_type == "phone":
            return f"tel:{data.get('phone', '')}"
        
        elif self.qr_type == "text":
            return data.get("text", "")
        
        elif self.qr_type == "calendar":
            # Generate iCalendar VEVENT format
            lines = ["BEGIN:VEVENT"]
            if data.get("title"):
                lines.append(f"SUMMARY:{data['title']}")
            if data.get("start"):
                lines.append(f"DTSTART:{data['start']}")
            if data.get("end"):
                lines.append(f"DTEND:{data['end']}")
            if data.get("location"):
                lines.append(f"LOCATION:{data['location']}")
            if data.get("description"):
                lines.append(f"DESCRIPTION:{data['description']}")
            lines.append("END:VEVENT")
            return "\n".join(lines)
        
        elif self.qr_type == "location":
            lat = data.get("latitude", 0)
            lng = data.get("longitude", 0)
            name = data.get("name", "")
            if name:
                return f"geo:{lat},{lng}?q={name}"
            return f"geo:{lat},{lng}"

        # Payment types
        elif self.qr_type == "upi":
            # UPI payment format: upi://pay?pa=...&pn=...&am=...
            pa = data.get("pa", "")  # Payee VPA
            pn = data.get("pn", "")  # Payee name
            am = data.get("am", "")  # Amount
            cu = data.get("cu", "INR")  # Currency
            tn = data.get("tn", "")  # Transaction note
            params = [f"pa={pa}", f"pn={pn}"]
            if am:
                params.append(f"am={am}")
            params.append(f"cu={cu}")
            if tn:
                params.append(f"tn={tn}")
            return f"upi://pay?{'&'.join(params)}"

        elif self.qr_type == "pix":
            # Pix payment - simplified EMV format
            # In production, use proper EMV QR code generation
            key = data.get("key", "")
            name = data.get("name", "")
            city = data.get("city", "")
            # Simplified - actual implementation needs proper EMV encoding
            return f"pix:{key}"

        # Product/Business types - these use dynamic redirect URLs
        elif self.qr_type in ("product", "menu", "document", "pdf"):
            # These types use dynamic QR with landing page
            if self.is_dynamic and self.short_code:
                return f"{settings.DEFAULT_SHORT_DOMAIN}/q/{self.short_code}"
            return data.get("url", self.destination_url or "")

        # Multi-destination types - use dynamic redirect with landing page
        elif self.qr_type == "multi_url":
            # Multi-URL QRs redirect to a link tree page
            if self.is_dynamic and self.short_code:
                return f"{settings.DEFAULT_SHORT_DOMAIN}/q/{self.short_code}"
            return data.get("fallback_url", "")

        elif self.qr_type == "app_store":
            # App store smart links - redirect detects device and redirects
            if self.is_dynamic and self.short_code:
                return f"{settings.DEFAULT_SHORT_DOMAIN}/q/{self.short_code}"
            return data.get("fallback_url", "")

        elif self.qr_type == "social":
            # Social media hub - link tree style page
            if self.is_dynamic and self.short_code:
                return f"{settings.DEFAULT_SHORT_DOMAIN}/q/{self.short_code}"
            return data.get("fallback_url", "")

        # Enterprise types
        elif self.qr_type == "serial":
            # Serialized QR - uses verification URL
            if self.is_dynamic and self.short_code:
                return f"{settings.DEFAULT_SHORT_DOMAIN}/verify/{self.short_code}"
            serial_number = data.get("serial_number", "")
            return f"{settings.DEFAULT_SHORT_DOMAIN}/verify/{serial_number}"

        return ""
    
    def generate_png(self, size=400):
        """
        Generate PNG QR code image with full styling support.
        Returns bytes.
        """
        from .image_generator import qr_generator

        img = qr_generator.generate(
            content=self.short_url,
            size=size,
            style=self.style,
            frame=self.frame,
            frame_text=self.frame_text,
            fg_color=self.foreground_color,
            bg_color=self.background_color,
            eye_style=self.eye_style,
            eye_color=self.eye_color or "",
            logo_url=self.logo_url,
            gradient_enabled=self.gradient_enabled,
            gradient_start=self.gradient_start,
            gradient_end=self.gradient_end,
            gradient_direction=self.gradient_direction,
        )

        buffer = io.BytesIO()
        img.save(buffer, format="PNG", quality=95)
        buffer.seek(0)
        return buffer.getvalue()
    
    def generate_svg(self):
        """
        Generate SVG QR code.
        Returns SVG string.
        """
        import qrcode
        import qrcode.image.svg
        
        # Create QR code
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(self.short_url)
        qr.make(fit=True)
        
        # Generate SVG
        factory = qrcode.image.svg.SvgPathImage
        img = qr.make_image(
            image_factory=factory,
            fill_color=self.foreground_color,
            back_color=self.background_color,
        )
        
        # Get SVG bytes
        buffer = io.BytesIO()
        img.save(buffer)
        buffer.seek(0)
        return buffer.getvalue().decode("utf-8")
    
    def generate_pdf(self):
        """
        Generate PDF with QR code.
        Returns PDF bytes.
        """
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader
        
        # Generate PNG first
        png_bytes = self.generate_png(size=800)
        
        # Create PDF
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        
        # Center QR code on page
        width, height = A4
        qr_size = 150 * mm
        x = (width - qr_size) / 2
        y = (height - qr_size) / 2
        
        # Draw QR code
        img = ImageReader(io.BytesIO(png_bytes))
        c.drawImage(img, x, y, width=qr_size, height=qr_size)
        
        # Add URL below
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2, y - 20, self.short_url)
        
        c.showPage()
        c.save()
        
        buffer.seek(0)
        return buffer.getvalue()
    
    @staticmethod
    def _validate_logo_url(url):
        """Validate logo URL to prevent SSRF attacks."""
        import ipaddress
        import socket
        from urllib.parse import urlparse
        from django.core.exceptions import ValidationError

        parsed = urlparse(url)

        # Only allow http and https schemes
        if parsed.scheme not in ("http", "https"):
            raise ValidationError("Only HTTP and HTTPS URLs are allowed for logos.")

        hostname = parsed.hostname
        if not hostname:
            raise ValidationError("Invalid logo URL.")

        # Resolve hostname to IP and check against private/reserved ranges
        try:
            addrinfo = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
        except socket.gaierror:
            raise ValidationError("Could not resolve logo URL hostname.")

        for family, _type, _proto, _canonname, sockaddr in addrinfo:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
                raise ValidationError("Logo URL must not point to a private or internal address.")

    def _add_logo_to_image(self, qr_img):
        """Add logo to center of QR code image."""
        from PIL import Image
        from django.core.exceptions import ValidationError
        import requests

        # Validate URL before fetching to prevent SSRF
        self._validate_logo_url(self.logo_url)

        # Download logo with size limit (5MB max)
        max_file_size = 5 * 1024 * 1024  # 5MB
        response = requests.get(self.logo_url, timeout=10, allow_redirects=False, stream=True)
        response.raise_for_status()

        content_length = response.headers.get("Content-Length")
        if content_length and int(content_length) > max_file_size:
            raise ValidationError("Logo file exceeds 5MB size limit.")

        chunks = []
        downloaded = 0
        for chunk in response.iter_content(chunk_size=8192):
            downloaded += len(chunk)
            if downloaded > max_file_size:
                raise ValidationError("Logo file exceeds 5MB size limit.")
            chunks.append(chunk)

        logo = Image.open(io.BytesIO(b"".join(chunks)))
        
        # Resize logo (max 30% of QR code)
        qr_width, qr_height = qr_img.size
        max_logo_size = int(min(qr_width, qr_height) * 0.3)
        
        logo_width, logo_height = logo.size
        ratio = min(max_logo_size / logo_width, max_logo_size / logo_height)
        new_size = (int(logo_width * ratio), int(logo_height * ratio))
        logo = logo.resize(new_size, Image.Resampling.LANCZOS)
        
        # Center logo on QR code
        logo_x = (qr_width - logo.width) // 2
        logo_y = (qr_height - logo.height) // 2
        
        # Create white background for logo
        if logo.mode == "RGBA":
            background = Image.new("RGBA", logo.size, (255, 255, 255, 255))
            background.paste(logo, mask=logo.split()[3])
            logo = background
        
        qr_img.paste(logo, (logo_x, logo_y))
        return qr_img
    
    def get_download_url(self, format="png"):
        """
        Get download URL for QR code.
        Returns signed S3 URL in production.
        """
        path_map = {
            "png": self.png_path,
            "svg": self.svg_path,
            "pdf": self.pdf_path,
        }
        path = path_map.get(format)
        
        if not path:
            return None
        
        if settings.DEBUG:
            return f"{settings.MEDIA_URL}{path}"
        
        # Generate signed S3 URL
        import boto3
        from botocore.config import Config
        
        s3_client = boto3.client(
            "s3",
            config=Config(signature_version="s3v4"),
            region_name=settings.AWS_S3_REGION_NAME,
        )
        
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
                "Key": path,
            },
            ExpiresIn=3600,  # 1 hour
        )
        
        return url


# =============================================================================
# SERIALIZATION MODELS
# =============================================================================

class SerialBatch(models.Model):
    """
    Batch of serialized QR codes for product authentication.
    Supports bulk generation with progress tracking.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    EXPORT_FORMAT_CHOICES = [
        ("zip", "ZIP Archive"),
        ("csv", "CSV Only"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="serial_batches"
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="serial_batches"
    )

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Generation settings
    prefix = models.CharField(
        max_length=20,
        blank=True,
        help_text="Prefix for serial numbers (e.g., 'PROD-')"
    )
    quantity = models.IntegerField(help_text="Number of QR codes to generate")
    generated_count = models.IntegerField(default=0)

    # Template URL - {serial} will be replaced with actual serial number
    destination_url_template = models.CharField(
        max_length=2048,
        blank=True,
        help_text="URL template with {serial} placeholder for serial number"
    )

    # QR styling template
    style = models.CharField(max_length=20, choices=QRCode.STYLE_CHOICES, default="square")
    frame = models.CharField(max_length=20, choices=QRCode.FRAME_CHOICES, default="none")
    foreground_color = models.CharField(max_length=7, default="#000000")
    background_color = models.CharField(max_length=7, default="#FFFFFF")
    eye_style = models.CharField(max_length=20, choices=QRCode.EYE_STYLE_CHOICES, default="square")
    eye_color = models.CharField(max_length=7, blank=True)
    gradient_enabled = models.BooleanField(default=False)
    gradient_start = models.CharField(max_length=7, blank=True)
    gradient_end = models.CharField(max_length=7, blank=True)
    gradient_direction = models.CharField(
        max_length=20, choices=QRCode.GRADIENT_DIRECTION_CHOICES, default="vertical"
    )
    logo_url = models.URLField(max_length=500, blank=True)

    # Product information
    product_name = models.CharField(max_length=200, blank=True)
    product_sku = models.CharField(max_length=100, blank=True)
    product_category = models.CharField(max_length=100, blank=True)
    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    # Custom metadata for all codes in batch
    batch_metadata = models.JSONField(default=dict, blank=True)

    # Export settings
    export_format = models.CharField(
        max_length=10,
        choices=EXPORT_FORMAT_CHOICES,
        default="zip"
    )
    export_file_url = models.CharField(max_length=500, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    error_message = models.TextField(blank=True)

    # Celery task tracking
    celery_task_id = models.CharField(max_length=50, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "serial_batches"
        ordering = ["-created_at"]
        verbose_name_plural = "Serial batches"

    def __str__(self):
        return f"{self.name} ({self.quantity} codes)"

    @property
    def progress_percent(self):
        """Calculate generation progress percentage."""
        if self.quantity == 0:
            return 0
        return round((self.generated_count / self.quantity) * 100, 1)

    @property
    def is_complete(self):
        return self.status == "completed"

    @property
    def can_download(self):
        return self.status == "completed" and self.export_file_url


class SerialCode(models.Model):
    """
    Individual serialized QR code for product verification.
    Tracks first scan, scan history, and suspicion status.
    """

    STATUS_CHOICES = [
        ("active", "Active"),
        ("suspicious", "Suspicious"),
        ("blocked", "Blocked"),
        ("recalled", "Recalled"),
        ("expired", "Expired"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(
        SerialBatch,
        on_delete=models.CASCADE,
        related_name="codes"
    )
    qr_code = models.OneToOneField(
        QRCode,
        on_delete=models.CASCADE,
        related_name="serial"
    )

    # Unique serial number
    serial_number = models.CharField(max_length=50, unique=True, db_index=True)

    # Verification tracking - first scan info
    first_scanned_at = models.DateTimeField(null=True, blank=True)
    first_scan_ip_hash = models.CharField(max_length=64, blank=True)
    first_scan_location = models.CharField(max_length=200, blank=True)
    first_scan_country = models.CharField(max_length=2, blank=True)
    first_scan_city = models.CharField(max_length=100, blank=True)
    first_scan_device = models.CharField(max_length=100, blank=True)

    # Scan statistics
    total_scans = models.IntegerField(default=0)
    unique_ips = models.IntegerField(default=0)
    unique_locations = models.IntegerField(default=0)
    unique_countries = models.IntegerField(default=0)

    # Last scan info
    last_scanned_at = models.DateTimeField(null=True, blank=True)
    last_scan_location = models.CharField(max_length=200, blank=True)

    # Status and verification
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    status_reason = models.TextField(blank=True)
    status_changed_at = models.DateTimeField(null=True, blank=True)
    status_changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+"
    )

    # Suspicion scoring
    suspicion_score = models.IntegerField(
        default=0,
        help_text="0-100 score, higher = more suspicious"
    )
    suspicion_reasons = models.JSONField(default=list, blank=True)

    # Product-specific metadata (can override batch metadata)
    metadata = models.JSONField(default=dict, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "serial_codes"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["serial_number"]),
            models.Index(fields=["batch", "status"]),
            models.Index(fields=["status", "-suspicion_score"]),
            models.Index(fields=["first_scanned_at"]),
        ]

    def __str__(self):
        return self.serial_number

    @property
    def is_verified(self):
        """Check if this serial has been verified (first scan occurred)."""
        return self.first_scanned_at is not None

    @property
    def is_suspicious(self):
        return self.status == "suspicious" or self.suspicion_score > 70

    @property
    def product_info(self):
        """Get combined product info from batch and code metadata."""
        info = {
            "name": self.batch.product_name,
            "sku": self.batch.product_sku,
            "category": self.batch.product_category,
            "manufacture_date": self.batch.manufacture_date,
            "expiry_date": self.batch.expiry_date,
        }
        # Override with code-specific metadata
        info.update(self.metadata.get("product", {}))
        return info

    def record_scan(self, ip_hash, location_data=None, device_data=None):
        """
        Record a scan event and update statistics.
        Returns (is_first_scan, suspicion_score).
        """
        from django.utils import timezone

        location_data = location_data or {}
        device_data = device_data or {}
        now = timezone.now()

        is_first = self.first_scanned_at is None

        if is_first:
            self.first_scanned_at = now
            self.first_scan_ip_hash = ip_hash
            self.first_scan_location = f"{location_data.get('city', '')}, {location_data.get('country_name', '')}"
            self.first_scan_country = location_data.get("country_code", "")[:2]
            self.first_scan_city = location_data.get("city", "")[:100]
            self.first_scan_device = device_data.get("device_type", "")[:100]

        # Update scan stats
        self.total_scans += 1
        self.last_scanned_at = now
        self.last_scan_location = f"{location_data.get('city', '')}, {location_data.get('country_name', '')}"

        # Calculate suspicion score
        suspicion_score = self._calculate_suspicion(ip_hash, location_data)

        if suspicion_score > 70 and self.status == "active":
            self.status = "suspicious"
            self.status_reason = f"High suspicion score: {suspicion_score}"
            self.status_changed_at = now

        self.suspicion_score = suspicion_score
        self.save()

        return is_first, suspicion_score

    def _calculate_suspicion(self, current_ip_hash, location_data):
        """
        Calculate suspicion score based on scan patterns.
        Returns 0-100 score.
        """
        from django.utils import timezone
        from datetime import timedelta

        score = 0
        reasons = []

        # Factor 1: Different IP than first scan (max 20 points)
        if self.first_scan_ip_hash and self.first_scan_ip_hash != current_ip_hash:
            if self.unique_ips > 5:
                score += 20
                reasons.append(f"Scanned from {self.unique_ips} different IPs")
            elif self.unique_ips > 3:
                score += 10
                reasons.append(f"Scanned from {self.unique_ips} different IPs")

        # Factor 2: Scan velocity - too many scans too fast (max 30 points)
        if self.total_scans > 1:
            if self.first_scanned_at:
                time_since_first = (timezone.now() - self.first_scanned_at).total_seconds()
                scans_per_hour = (self.total_scans / max(time_since_first, 1)) * 3600

                if scans_per_hour > 20:
                    score += 30
                    reasons.append(f"High scan velocity: {scans_per_hour:.1f}/hour")
                elif scans_per_hour > 10:
                    score += 20
                    reasons.append(f"Elevated scan velocity: {scans_per_hour:.1f}/hour")
                elif scans_per_hour > 5:
                    score += 10
                    reasons.append(f"Moderate scan velocity: {scans_per_hour:.1f}/hour")

        # Factor 3: Geographic spread (max 30 points)
        if self.unique_countries > 3:
            score += 30
            reasons.append(f"Scanned in {self.unique_countries} different countries")
        elif self.unique_countries > 2:
            score += 20
            reasons.append(f"Scanned in {self.unique_countries} different countries")
        elif self.unique_countries > 1:
            score += 10
            reasons.append(f"Scanned in {self.unique_countries} different countries")

        # Factor 4: Total scan count (max 20 points)
        if self.total_scans > 50:
            score += 20
            reasons.append(f"Very high scan count: {self.total_scans}")
        elif self.total_scans > 20:
            score += 10
            reasons.append(f"High scan count: {self.total_scans}")

        self.suspicion_reasons = reasons
        return min(score, 100)

    def block(self, reason="", user=None):
        """Block this serial code."""
        from django.utils import timezone

        self.status = "blocked"
        self.status_reason = reason
        self.status_changed_at = timezone.now()
        self.status_changed_by = user
        self.save()

    def recall(self, reason="", user=None, recall_info=None):
        """Mark this serial code as recalled."""
        from django.utils import timezone

        self.status = "recalled"
        self.status_reason = reason
        self.status_changed_at = timezone.now()
        self.status_changed_by = user
        if recall_info:
            self.metadata["recall_info"] = recall_info
        self.save()

    def reactivate(self, user=None):
        """Reactivate a blocked or suspicious serial code."""
        from django.utils import timezone

        self.status = "active"
        self.status_reason = ""
        self.suspicion_score = 0
        self.suspicion_reasons = []
        self.status_changed_at = timezone.now()
        self.status_changed_by = user
        self.save()
