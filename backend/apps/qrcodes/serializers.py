"""
Serializers for QR codes app.
"""

import re
from decimal import Decimal

from rest_framework import serializers

from apps.users.models import UsageTracking
from apps.users.exceptions import UsageLimitExceeded, FeatureNotAvailable
from apps.links.models import Link
from .models import QRCode
from .schemas import validate_content_data, QR_TYPE_SCHEMAS


# Regex pattern for validating hex color codes
HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")

# QR types that require Business plan
BUSINESS_ONLY_TYPES = {"serial", "product", "menu"}


def _sanitize_json(obj):
    """Recursively convert Decimal values to int/float for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    return obj

# QR types that require Pro+ plan
PRO_PLUS_TYPES = {"upi", "pix", "document", "pdf", "multi_url", "app_store", "social"}


def validate_hex_color(value, required=True):
    """
    Validate hex color format and return uppercase value.

    Args:
        value: The color value to validate
        required: If False, empty/None values are allowed

    Returns:
        Uppercase hex color string or original value if not required and empty

    Raises:
        serializers.ValidationError if invalid format
    """
    if not value:
        if required:
            raise serializers.ValidationError("Color value is required")
        return value

    if not HEX_COLOR_PATTERN.match(value):
        raise serializers.ValidationError("Invalid color format. Use hex format like #000000")
    return value.upper()


class QRCodeSerializer(serializers.ModelSerializer):
    """Serializer for QR Code model."""

    short_url = serializers.CharField(read_only=True)
    link_short_code = serializers.SerializerMethodField()
    link_original_url = serializers.SerializerMethodField()
    download_urls = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    qr_content = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QRCode
        fields = [
            "id", "qr_type", "title", "link", "link_short_code", "link_original_url",
            "short_url", "content_data", "qr_content", "is_dynamic", "short_code",
            "destination_url",
            # Basic styling
            "style", "frame", "frame_text", "foreground_color", "background_color",
            # Enhanced styling
            "eye_style", "eye_color",
            "gradient_enabled", "gradient_start", "gradient_end", "gradient_direction",
            "logo_url",
            "png_path", "svg_path", "pdf_path", "download_urls",
            "total_scans", "created_by_name", "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "png_path", "svg_path", "pdf_path",
            "total_scans", "created_at", "updated_at"
        ]
    
    def get_link_short_code(self, obj):
        return obj.link.short_code if obj.link else None
    
    def get_link_original_url(self, obj):
        return obj.link.original_url if obj.link else None
    
    def get_download_urls(self, obj):
        """Get download URLs for all formats."""
        return {
            "png": obj.get_download_url("png"),
            "svg": obj.get_download_url("svg"),
            "pdf": obj.get_download_url("pdf"),
        }
    
    def get_qr_content(self, obj):
        """Get the encoded QR content string."""
        return obj.get_qr_content()
    
    def get_logo_url(self, obj):
        """Build absolute URL for logo."""
        if not obj.logo_url:
            return ""
        
        # Already an absolute URL
        if obj.logo_url.startswith("http://") or obj.logo_url.startswith("https://"):
            return obj.logo_url
        
        # Build absolute URL from relative path
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.logo_url)
        
        return obj.logo_url

    def get_created_by_name(self, obj):
        """Return creator name for team mode."""
        if obj.user:
            return obj.user.display_name
        return None


class CreateQRCodeSerializer(serializers.Serializer):
    """Serializer for creating a QR code - supports multiple types."""

    # Core fields
    qr_type = serializers.ChoiceField(choices=QRCode.TYPE_CHOICES, default="link")
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)

    # Link type only
    link_id = serializers.UUIDField(required=False, allow_null=True)

    # Other types: JSON content data
    content_data = serializers.JSONField(required=False, default=dict)

    # Dynamic QR (Pro+ only)
    is_dynamic = serializers.BooleanField(required=False, default=False)
    destination_url = serializers.URLField(max_length=2048, required=False, allow_blank=True)

    # Basic design settings
    style = serializers.ChoiceField(choices=QRCode.STYLE_CHOICES, default="square")
    frame = serializers.ChoiceField(choices=QRCode.FRAME_CHOICES, default="none")
    frame_text = serializers.CharField(max_length=50, required=False, allow_blank=True)
    foreground_color = serializers.CharField(max_length=7, default="#000000")
    background_color = serializers.CharField(max_length=7, default="#FFFFFF")
    logo = serializers.ImageField(required=False, allow_null=True)

    # Enhanced styling (Pro+ only)
    eye_style = serializers.ChoiceField(
        choices=QRCode.EYE_STYLE_CHOICES, default="square", required=False
    )
    eye_color = serializers.CharField(max_length=7, required=False, allow_blank=True)

    # Gradient styling (Business only)
    gradient_enabled = serializers.BooleanField(required=False, default=False)
    gradient_start = serializers.CharField(max_length=7, required=False, allow_blank=True)
    gradient_end = serializers.CharField(max_length=7, required=False, allow_blank=True)
    gradient_direction = serializers.ChoiceField(
        choices=QRCode.GRADIENT_DIRECTION_CHOICES,
        default="vertical",
        required=False
    )

    def validate_link_id(self, value):
        """Validate link exists and belongs to user/team (for link type only)."""
        if not value:
            return value

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required")

        # Team-aware lookup
        team = getattr(request, "team", None)
        link_filter = {"id": value}
        if team:
            link_filter["team"] = team
        else:
            link_filter["user"] = request.user
            link_filter["team__isnull"] = True

        try:
            link = Link.objects.get(**link_filter)
        except Link.DoesNotExist:
            raise serializers.ValidationError("Link not found")

        # Check if QR already exists for this link
        try:
            if link.qr_code:
                raise serializers.ValidationError("QR code already exists for this link")
        except Link.qr_code.RelatedObjectDoesNotExist:
            pass

        return value
    
    def validate_foreground_color(self, value):
        """Validate hex color format."""
        return validate_hex_color(value)

    def validate_background_color(self, value):
        """Validate hex color format."""
        return validate_hex_color(value)

    def validate_eye_color(self, value):
        """Validate hex color format for eye color."""
        return validate_hex_color(value, required=False)

    def validate_gradient_start(self, value):
        """Validate hex color format for gradient start."""
        return validate_hex_color(value, required=False)

    def validate_gradient_end(self, value):
        """Validate hex color format for gradient end."""
        return validate_hex_color(value, required=False)

    def validate_logo(self, value):
        """Validate logo file and check permissions."""
        if not value:
            return value
        
        request = self.context.get("request")
        subscription = getattr(request.user, "subscription", None)
        
        if not subscription or subscription.plan == "free":
            raise FeatureNotAvailable(
                detail="Custom logos are only available on Pro and Business plans."
            )
        
        # Validate file size (max 2MB)
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Logo file must be less than 2MB.")
        
        return value
    
    def validate_content_data(self, value):
        """Validate content data structure and sanitize Decimal values."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Content data must be a JSON object")
        return _sanitize_json(value)
    
    def validate(self, attrs):
        """Check usage limits and type-specific requirements."""
        request = self.context.get("request")
        user = request.user
        subscription = getattr(user, "subscription", None)
        qr_type = attrs.get("qr_type", "link")
        content_data = attrs.get("content_data", {})

        if not subscription:
            raise serializers.ValidationError("No subscription found")

        plan = subscription.plan

        # Check usage limits
        usage = UsageTracking.get_current_period(user)
        if not subscription.can_create_qr(usage.qr_codes_created):
            raise UsageLimitExceeded(
                detail="You have reached your monthly QR code limit. Please upgrade your plan."
            )

        # Business-only types
        if qr_type in BUSINESS_ONLY_TYPES and plan not in ("business", "enterprise"):
            type_label = dict(QRCode.TYPE_CHOICES).get(qr_type, qr_type)
            raise FeatureNotAvailable(
                detail=f"{type_label} QR codes are only available on Business and Enterprise plans."
            )

        # Pro+ types
        if qr_type in PRO_PLUS_TYPES and plan == "free":
            type_label = dict(QRCode.TYPE_CHOICES).get(qr_type, qr_type)
            raise FeatureNotAvailable(
                detail=f"{type_label} QR codes are only available on paid plans."
            )

        # Non-link basic types require Pro+ plan
        if qr_type not in ("link",) and qr_type not in BUSINESS_ONLY_TYPES and qr_type not in PRO_PLUS_TYPES:
            if plan == "free":
                type_label = dict(QRCode.TYPE_CHOICES).get(qr_type, qr_type)
                raise FeatureNotAvailable(
                    detail=f"{type_label} QR codes are only available on paid plans."
                )

        # Dynamic QR requires Pro+ plan
        if attrs.get("is_dynamic") and plan == "free":
            raise FeatureNotAvailable(
                detail="Dynamic QR codes are only available on paid plans."
            )

        # Check advanced styling features (Pro+ only)
        has_custom_style = attrs.get("style") != "square"
        has_custom_fg_color = attrs.get("foreground_color") != "#000000"
        has_custom_bg_color = attrs.get("background_color") != "#FFFFFF"
        has_logo = attrs.get("logo") is not None
        has_frame = attrs.get("frame") and attrs.get("frame") != "none"
        has_eye_color = attrs.get("eye_color") and attrs.get("eye_color") not in ("", None)

        if plan == "free":
            if has_custom_style:
                raise FeatureNotAvailable(
                    detail="Custom QR styles are only available on paid plans."
                )
            if has_custom_fg_color or has_custom_bg_color:
                raise FeatureNotAvailable(
                    detail="Custom colors are only available on paid plans."
                )
            if has_logo:
                raise FeatureNotAvailable(
                    detail="Logo embedding is only available on paid plans."
                )
            if has_frame:
                raise FeatureNotAvailable(
                    detail="QR code frames are only available on paid plans."
                )
            if has_eye_color:
                raise FeatureNotAvailable(
                    detail="Custom eye colors are only available on paid plans."
                )

        # Enhanced eye styling requires Pro+
        if attrs.get("eye_style") and attrs.get("eye_style") != "square":
            if plan == "free":
                raise FeatureNotAvailable(
                    detail="Custom eye styles are only available on paid plans."
                )

        # Gradient styling requires Business+ plan
        if attrs.get("gradient_enabled"):
            if plan not in ("business", "enterprise"):
                raise FeatureNotAvailable(
                    detail="Gradient styling is only available on Business and Enterprise plans."
                )
            # Validate gradient colors are provided
            if not attrs.get("gradient_start") or not attrs.get("gradient_end"):
                raise serializers.ValidationError({
                    "gradient_start": "Gradient colors are required when gradient is enabled.",
                    "gradient_end": "Gradient colors are required when gradient is enabled."
                })

        # Frame text requires Pro+
        if attrs.get("frame_text") and plan == "free":
            raise FeatureNotAvailable(
                detail="Custom frame text is only available on paid plans."
            )

        # Validate content data using schemas for types that have them
        if qr_type in QR_TYPE_SCHEMAS:
            try:
                validated_content = validate_content_data(qr_type, content_data)
                attrs["content_data"] = validated_content
            except serializers.ValidationError as e:
                raise serializers.ValidationError({"content_data": e.detail})

        # Type-specific validation for types without schemas
        if qr_type == "link":
            if not attrs.get("link_id"):
                raise serializers.ValidationError({"link_id": "Required for link type"})

        elif qr_type == "phone":
            if not content_data.get("phone"):
                raise serializers.ValidationError({"content_data": "Phone number is required"})

        elif qr_type == "text":
            if not content_data.get("text"):
                raise serializers.ValidationError({"content_data": "Text content is required"})

        return attrs
    
    def create(self, validated_data):
        """Create the QR code."""
        from django.core.files.storage import default_storage
        from django.conf import settings
        import uuid

        request = self.context.get("request")
        logo_file = validated_data.pop("logo", None)
        logo_url = ""

        # Save logo file if provided
        if logo_file:
            ext = logo_file.name.split('.')[-1].lower()
            filename = f"qr-logos/{request.user.id}/{uuid.uuid4()}.{ext}"
            saved_path = default_storage.save(filename, logo_file)

            # Build absolute URL for the logo
            if settings.DEBUG:
                logo_url = request.build_absolute_uri(f"{settings.MEDIA_URL}{saved_path}")
            else:
                logo_url = default_storage.url(saved_path)

        # Prepare QR creation data
        qr_data = {
            "user": request.user,
            "team": getattr(request, "team", None),  # Team context
            "qr_type": validated_data.get("qr_type", "link"),
            "title": validated_data.get("title", ""),
            "content_data": _sanitize_json(validated_data.get("content_data", {})),
            "is_dynamic": validated_data.get("is_dynamic", False),
            "destination_url": validated_data.get("destination_url", ""),
            # Basic styling
            "style": validated_data.get("style", "square"),
            "frame": validated_data.get("frame", "none"),
            "frame_text": validated_data.get("frame_text", ""),
            "foreground_color": validated_data.get("foreground_color", "#000000"),
            "background_color": validated_data.get("background_color", "#FFFFFF"),
            "logo_url": logo_url,
            # Enhanced styling
            "eye_style": validated_data.get("eye_style", "square"),
            "eye_color": validated_data.get("eye_color", ""),
            # Gradient styling
            "gradient_enabled": validated_data.get("gradient_enabled", False),
            "gradient_start": validated_data.get("gradient_start", ""),
            "gradient_end": validated_data.get("gradient_end", ""),
            "gradient_direction": validated_data.get("gradient_direction", "vertical"),
        }

        # Add link_id only for link type
        if validated_data.get("qr_type") == "link" and validated_data.get("link_id"):
            qr_data["link_id"] = validated_data["link_id"]

        qr = QRCode.objects.create(**qr_data)

        # Track usage
        usage = UsageTracking.get_current_period(request.user)
        usage.increment_qr_codes()

        return qr


class UpdateQRCodeSerializer(serializers.Serializer):
    """Serializer for updating a QR code."""

    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    destination_url = serializers.URLField(max_length=2048, required=False, allow_blank=True)
    content_data = serializers.JSONField(required=False)

    # Basic styling
    style = serializers.ChoiceField(choices=QRCode.STYLE_CHOICES, required=False)
    frame = serializers.ChoiceField(choices=QRCode.FRAME_CHOICES, required=False)
    frame_text = serializers.CharField(max_length=50, required=False, allow_blank=True)
    foreground_color = serializers.CharField(max_length=7, required=False)
    background_color = serializers.CharField(max_length=7, required=False)
    logo = serializers.ImageField(required=False, allow_null=True)
    remove_logo = serializers.BooleanField(required=False, default=False)

    # Enhanced styling
    eye_style = serializers.ChoiceField(choices=QRCode.EYE_STYLE_CHOICES, required=False)
    eye_color = serializers.CharField(max_length=7, required=False, allow_blank=True)

    # Gradient styling
    gradient_enabled = serializers.BooleanField(required=False)
    gradient_start = serializers.CharField(max_length=7, required=False, allow_blank=True)
    gradient_end = serializers.CharField(max_length=7, required=False, allow_blank=True)
    gradient_direction = serializers.ChoiceField(
        choices=QRCode.GRADIENT_DIRECTION_CHOICES,
        required=False
    )

    def validate_destination_url(self, value):
        """Validate destination URL - block private IPs and dangerous schemes."""
        if not value:
            return value
        is_valid, error = Link.validate_url(value)
        if not is_valid:
            raise serializers.ValidationError(error)
        return value

    def validate_foreground_color(self, value):
        """Validate hex color format."""
        return validate_hex_color(value, required=False)

    def validate_background_color(self, value):
        """Validate hex color format."""
        return validate_hex_color(value, required=False)

    def validate_eye_color(self, value):
        """Validate hex color format for eye color."""
        return validate_hex_color(value, required=False)

    def validate_gradient_start(self, value):
        """Validate hex color format for gradient start."""
        return validate_hex_color(value, required=False)

    def validate_gradient_end(self, value):
        """Validate hex color format for gradient end."""
        return validate_hex_color(value, required=False)

    def validate_logo(self, value):
        """Validate logo file."""
        if not value:
            return value

        # Validate file size (max 2MB)
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Logo file must be less than 2MB.")

        return value

    def validate(self, attrs):
        """Cross-field validation and plan permission checks."""
        request = self.context.get("request")
        subscription = getattr(request.user, "subscription", None)
        plan = subscription.plan if subscription else "free"

        # Check advanced styling features (Pro+ only)
        if plan == "free":
            if attrs.get("style") and attrs.get("style") != "square":
                raise FeatureNotAvailable(
                    detail="Custom QR styles are only available on paid plans."
                )
            if attrs.get("foreground_color") and attrs.get("foreground_color") != "#000000":
                raise FeatureNotAvailable(
                    detail="Custom colors are only available on paid plans."
                )
            if attrs.get("background_color") and attrs.get("background_color") != "#FFFFFF":
                raise FeatureNotAvailable(
                    detail="Custom colors are only available on paid plans."
                )
            if attrs.get("logo"):
                raise FeatureNotAvailable(
                    detail="Logo embedding is only available on paid plans."
                )
            if attrs.get("frame") and attrs.get("frame") != "none":
                raise FeatureNotAvailable(
                    detail="QR code frames are only available on paid plans."
                )
            if attrs.get("eye_color"):
                raise FeatureNotAvailable(
                    detail="Custom eye colors are only available on paid plans."
                )
            if attrs.get("eye_style") and attrs.get("eye_style") != "square":
                raise FeatureNotAvailable(
                    detail="Custom eye styles are only available on paid plans."
                )
            if attrs.get("frame_text"):
                raise FeatureNotAvailable(
                    detail="Custom frame text is only available on paid plans."
                )

        # Gradient styling requires Business+ plan
        if attrs.get("gradient_enabled"):
            if plan not in ("business", "enterprise"):
                raise FeatureNotAvailable(
                    detail="Gradient styling is only available on Business and Enterprise plans."
                )

        # Validate content data using schemas if provided
        if "content_data" in attrs:
            # We need the instance to get the qr_type
            # This will be validated in update() where we have access to instance
            pass

        return attrs

    def update(self, instance, validated_data):
        """Update the QR code."""
        from django.core.files.storage import default_storage
        from django.conf import settings
        from django.core.cache import cache
        import uuid

        request = self.context.get("request")
        logo_file = validated_data.pop("logo", None)
        remove_logo = validated_data.pop("remove_logo", False)
        destination_url = validated_data.pop("destination_url", None)
        content_data = validated_data.pop("content_data", None)

        # Validate destination_url only allowed on dynamic QRs
        if destination_url is not None and not instance.is_dynamic:
            raise serializers.ValidationError(
                {"destination_url": "Destination URL can only be set on dynamic QR codes."}
            )

        # Validate content_data using schema if provided
        if content_data is not None:
            content_data = _sanitize_json(content_data)
            if instance.qr_type in QR_TYPE_SCHEMAS:
                try:
                    content_data = validate_content_data(instance.qr_type, content_data)
                except serializers.ValidationError as e:
                    raise serializers.ValidationError({"content_data": e.detail})
            instance.content_data = content_data

        # Handle destination_url update
        if destination_url is not None:
            instance.destination_url = destination_url
            # For link-type dynamic QRs, also update the linked Link object
            if instance.qr_type == "link" and instance.link and destination_url:
                instance.link.original_url = destination_url
                instance.link.save(update_fields=["original_url", "updated_at"])
                # Invalidate link cache
                cache_key = f"link:{instance.link.domain_id or 'default'}:{instance.link.short_code}"
                cache.delete(cache_key)

        # Handle logo update
        if remove_logo:
            instance.logo_url = ""
        elif logo_file:
            ext = logo_file.name.split('.')[-1].lower()
            filename = f"qr-logos/{request.user.id}/{uuid.uuid4()}.{ext}"
            saved_path = default_storage.save(filename, logo_file)

            # Build absolute URL for the logo
            if settings.DEBUG:
                instance.logo_url = request.build_absolute_uri(f"{settings.MEDIA_URL}{saved_path}")
            else:
                instance.logo_url = default_storage.url(saved_path)

        # Update other fields
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()
        return instance


# =============================================================================
# SERIAL BATCH SERIALIZERS
# =============================================================================

from .models import SerialBatch, SerialCode


class SerialCodeSerializer(serializers.ModelSerializer):
    """Serializer for individual serial codes."""

    product_info = serializers.SerializerMethodField()
    verify_url = serializers.SerializerMethodField()
    qr_download_url = serializers.SerializerMethodField()

    class Meta:
        model = SerialCode
        fields = [
            "id", "serial_number", "status", "suspicion_score",
            "first_scanned_at", "first_scan_location",
            "total_scans", "unique_ips", "unique_countries",
            "last_scanned_at", "last_scan_location",
            "product_info", "verify_url", "qr_download_url",
            "created_at",
        ]
        read_only_fields = fields

    def get_product_info(self, obj):
        return obj.product_info

    def get_verify_url(self, obj):
        from django.conf import settings
        base_url = getattr(settings, "SITE_URL", f"https://{settings.DEFAULT_SHORT_DOMAIN}")
        return f"{base_url}/verify/{obj.serial_number}"

    def get_qr_download_url(self, obj):
        if obj.qr_code:
            return obj.qr_code.get_download_url("png")
        return None


class SerialCodeDetailSerializer(SerialCodeSerializer):
    """Detailed serializer for serial codes with full info."""

    suspicion_reasons = serializers.JSONField(read_only=True)
    status_reason = serializers.CharField(read_only=True)
    metadata = serializers.JSONField(read_only=True)

    class Meta(SerialCodeSerializer.Meta):
        fields = SerialCodeSerializer.Meta.fields + [
            "suspicion_reasons", "status_reason", "metadata",
            "first_scan_ip_hash", "first_scan_country", "first_scan_city",
            "first_scan_device", "unique_locations",
        ]


class UpdateSerialCodeStatusSerializer(serializers.Serializer):
    """Serializer for updating serial code status."""

    status = serializers.ChoiceField(choices=SerialCode.STATUS_CHOICES)
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)
    recall_info = serializers.JSONField(required=False)

    def update(self, instance, validated_data):
        from django.utils import timezone

        status = validated_data["status"]
        reason = validated_data.get("reason", "")
        recall_info = validated_data.get("recall_info")
        user = self.context.get("request").user

        instance.status = status
        instance.status_reason = reason
        instance.status_changed_at = timezone.now()
        instance.status_changed_by = user

        if status == "recalled" and recall_info:
            instance.metadata["recall_info"] = recall_info

        instance.save()
        return instance


class SerialBatchSerializer(serializers.ModelSerializer):
    """Serializer for serial batch list/detail views."""

    codes_count = serializers.SerializerMethodField()
    progress_percent = serializers.FloatField(read_only=True)
    can_download = serializers.BooleanField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SerialBatch
        fields = [
            "id", "name", "description",
            "prefix", "quantity", "generated_count", "progress_percent",
            "product_name", "product_sku", "product_category",
            "manufacture_date", "expiry_date",
            "status", "can_download", "export_file_url",
            "style", "frame", "foreground_color", "background_color",
            "eye_style", "eye_color",
            "gradient_enabled", "gradient_start", "gradient_end", "gradient_direction",
            "codes_count", "created_by_name",
            "created_at", "started_at", "completed_at",
        ]
        read_only_fields = [
            "id", "generated_count", "status", "export_file_url",
            "created_at", "started_at", "completed_at",
        ]

    def get_codes_count(self, obj):
        return obj.codes.count()

    def get_created_by_name(self, obj):
        if obj.user:
            return obj.user.display_name
        return None


class CreateSerialBatchSerializer(serializers.Serializer):
    """Serializer for creating a new serial batch."""

    # Basic info
    name = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    # Generation settings
    prefix = serializers.CharField(max_length=20, required=False, allow_blank=True)
    quantity = serializers.IntegerField(min_value=1, max_value=10000)
    destination_url_template = serializers.CharField(
        max_length=2048,
        required=False,
        allow_blank=True,
        help_text="URL template with {serial} placeholder"
    )

    # Product info
    product_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    product_sku = serializers.CharField(max_length=100, required=False, allow_blank=True)
    product_category = serializers.CharField(max_length=100, required=False, allow_blank=True)
    manufacture_date = serializers.DateField(required=False, allow_null=True)
    expiry_date = serializers.DateField(required=False, allow_null=True)
    batch_metadata = serializers.JSONField(required=False, default=dict)

    # QR styling
    style = serializers.ChoiceField(choices=QRCode.STYLE_CHOICES, default="square")
    frame = serializers.ChoiceField(choices=QRCode.FRAME_CHOICES, default="none")
    foreground_color = serializers.CharField(max_length=7, default="#000000")
    background_color = serializers.CharField(max_length=7, default="#FFFFFF")
    eye_style = serializers.ChoiceField(choices=QRCode.EYE_STYLE_CHOICES, default="square", required=False)
    eye_color = serializers.CharField(max_length=7, required=False, allow_blank=True, default="")
    gradient_enabled = serializers.BooleanField(default=False, required=False)
    gradient_start = serializers.CharField(max_length=7, required=False, allow_blank=True, default="")
    gradient_end = serializers.CharField(max_length=7, required=False, allow_blank=True, default="")
    gradient_direction = serializers.ChoiceField(
        choices=QRCode.GRADIENT_DIRECTION_CHOICES, default="vertical", required=False
    )
    logo_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    logo = serializers.ImageField(required=False, allow_null=True)

    # Export settings
    export_format = serializers.ChoiceField(
        choices=SerialBatch.EXPORT_FORMAT_CHOICES,
        default="zip"
    )

    # Whether to start generation immediately
    start_immediately = serializers.BooleanField(default=True)

    def validate_quantity(self, value):
        """Check quantity against plan limits."""
        request = self.context.get("request")
        subscription = getattr(request.user, "subscription", None)

        if not subscription or subscription.plan not in ("business", "enterprise"):
            raise FeatureNotAvailable(
                detail="Serial batch generation is only available on Business and Enterprise plans."
            )

        # Check batch size limits from settings
        from django.conf import settings
        plan_limits = settings.PLAN_LIMITS.get(subscription.plan, {})
        max_quantity = plan_limits.get("serial_batch_limit", 100)

        if value > max_quantity:
            raise serializers.ValidationError(
                f"Maximum batch size for your plan is {max_quantity} codes."
            )

        return value

    def validate_logo(self, value):
        """Validate logo file size."""
        if not value:
            return value

        # Validate file size (max 2MB)
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Logo file must be less than 2MB.")

        return value

    def validate_foreground_color(self, value):
        return validate_hex_color(value)

    def validate_background_color(self, value):
        return validate_hex_color(value)

    def validate_destination_url_template(self, value):
        """Validate URL template - replace {serial} with dummy value and check URL format."""
        if not value:
            return value

        from django.core.validators import URLValidator
        from django.core.exceptions import ValidationError as DjangoValidationError

        # Replace {serial} placeholder with a dummy value for URL validation
        test_url = value.replace("{serial}", "TEST123")
        validator = URLValidator()
        try:
            validator(test_url)
        except DjangoValidationError:
            raise serializers.ValidationError(
                "Invalid URL template. Must be a valid URL with optional {serial} placeholder."
            )

        return value

    def validate(self, attrs):
        # Validate expiry_date is after manufacture_date
        mfg_date = attrs.get("manufacture_date")
        exp_date = attrs.get("expiry_date")

        if mfg_date and exp_date and exp_date <= mfg_date:
            raise serializers.ValidationError({
                "expiry_date": "Expiry date must be after manufacture date."
            })

        return attrs

    def create(self, validated_data):
        from django.core.files.storage import default_storage
        from django.conf import settings
        import uuid

        from .tasks import generate_serial_batch

        request = self.context.get("request")
        start_immediately = validated_data.pop("start_immediately", True)
        logo_file = validated_data.pop("logo", None)

        # Save logo file if provided
        if logo_file:
            ext = logo_file.name.split('.')[-1].lower()
            filename = f"qr-logos/{request.user.id}/{uuid.uuid4()}.{ext}"
            saved_path = default_storage.save(filename, logo_file)

            # Build absolute URL for the logo
            if settings.DEBUG:
                validated_data["logo_url"] = request.build_absolute_uri(
                    f"{settings.MEDIA_URL}{saved_path}"
                )
            else:
                validated_data["logo_url"] = default_storage.url(saved_path)

        batch = SerialBatch.objects.create(
            user=request.user,
            team=getattr(request, "team", None),
            **validated_data
        )

        # Start generation task
        if start_immediately:
            generate_serial_batch.delay(str(batch.id))

        return batch


class SerialBatchProgressSerializer(serializers.Serializer):
    """Serializer for batch generation progress."""

    batch_id = serializers.UUIDField()
    status = serializers.CharField()
    quantity = serializers.IntegerField()
    generated_count = serializers.IntegerField()
    progress_percent = serializers.FloatField()
    error_message = serializers.CharField(allow_blank=True)
    export_file_url = serializers.CharField(allow_blank=True)
    started_at = serializers.DateTimeField(allow_null=True)
    completed_at = serializers.DateTimeField(allow_null=True)

