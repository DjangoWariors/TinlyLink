"""
Content data schemas for QR code types.
Validates and generates QR content strings.
"""

from decimal import Decimal
from typing import Optional, List
from rest_framework import serializers


# =============================================================================
# PAYMENT SCHEMAS
# =============================================================================

class UPIPaymentSchema(serializers.Serializer):
    """UPI Payment QR content."""
    pa = serializers.CharField(max_length=100, help_text="Payee VPA (UPI ID)")
    pn = serializers.CharField(max_length=100, help_text="Payee name")
    am = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        required=False, allow_null=True,
        help_text="Amount"
    )
    cu = serializers.CharField(max_length=3, default="INR", help_text="Currency")
    tn = serializers.CharField(max_length=200, required=False, allow_blank=True, help_text="Transaction note")

    def to_qr_string(self, data):
        params = [f"pa={data['pa']}", f"pn={data['pn']}"]
        if data.get("am"):
            params.append(f"am={data['am']}")
        params.append(f"cu={data.get('cu', 'INR')}")
        if data.get("tn"):
            params.append(f"tn={data['tn']}")
        return f"upi://pay?{'&'.join(params)}"


class PixPaymentSchema(serializers.Serializer):
    """Pix Payment QR content (Brazil)."""
    key = serializers.CharField(max_length=100, help_text="Pix key (CPF, email, phone, random)")
    name = serializers.CharField(max_length=100, help_text="Receiver name")
    city = serializers.CharField(max_length=100, help_text="City")
    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        required=False, allow_null=True
    )
    txid = serializers.CharField(max_length=50, required=False, allow_blank=True)


# =============================================================================
# PRODUCT/BUSINESS SCHEMAS
# =============================================================================

class ProductInfoSchema(serializers.Serializer):
    """Product information QR content."""
    sku = serializers.CharField(max_length=100)
    name = serializers.CharField(max_length=200)
    brand = serializers.CharField(max_length=100, required=False, allow_blank=True)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    price = serializers.DictField(required=False, allow_null=True)  # {amount, currency, sale_price}
    images = serializers.ListField(
        child=serializers.URLField(),
        required=False,
        default=list
    )
    specifications = serializers.DictField(required=False, default=dict)
    nutrition = serializers.DictField(required=False, allow_null=True)
    allergens = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )
    certifications = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )
    buy_url = serializers.URLField(required=False, allow_blank=True)
    reviews_url = serializers.URLField(required=False, allow_blank=True)


class MenuSchema(serializers.Serializer):
    """Restaurant menu QR content."""
    restaurant_name = serializers.CharField(max_length=200)
    menu_url = serializers.URLField(help_text="URL to digital menu")
    logo_url = serializers.URLField(required=False, allow_blank=True)
    categories = serializers.ListField(
        child=serializers.DictField(),  # {name, items: [{name, description, price, image_url}]}
        required=False,
        default=list
    )
    dietary_info = serializers.DictField(required=False, default=dict)


# =============================================================================
# DOCUMENT SCHEMAS
# =============================================================================

class DocumentSchema(serializers.Serializer):
    """Document/File QR content."""
    title = serializers.CharField(max_length=200)
    file_url = serializers.URLField(help_text="URL to document")
    file_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    file_size = serializers.IntegerField(required=False, allow_null=True, help_text="Size in bytes")
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    password_protected = serializers.BooleanField(default=False)


class PDFDocumentSchema(serializers.Serializer):
    """PDF Document QR content."""
    title = serializers.CharField(max_length=200)
    pdf_url = serializers.URLField(help_text="URL to PDF document")
    pages = serializers.IntegerField(required=False, allow_null=True)
    author = serializers.CharField(max_length=100, required=False, allow_blank=True)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)


# =============================================================================
# MULTI-DESTINATION SCHEMAS
# =============================================================================

class MultiURLLinkSchema(serializers.Serializer):
    """Individual link in multi-URL QR."""
    label = serializers.CharField(max_length=100)
    url = serializers.URLField()
    icon = serializers.CharField(max_length=50, required=False, allow_blank=True)
    description = serializers.CharField(max_length=200, required=False, allow_blank=True)


class MultiURLSchema(serializers.Serializer):
    """Multiple links QR content."""
    title = serializers.CharField(max_length=200)
    subtitle = serializers.CharField(max_length=300, required=False, allow_blank=True)
    avatar_url = serializers.URLField(required=False, allow_blank=True)
    links = serializers.ListField(
        child=MultiURLLinkSchema(),
        min_length=1,
        max_length=20
    )
    style = serializers.ChoiceField(
        choices=["list", "grid", "buttons"],
        default="list"
    )
    background_color = serializers.CharField(max_length=7, required=False, default="#FFFFFF")
    text_color = serializers.CharField(max_length=7, required=False, default="#000000")


class AppStoreLinksSchema(serializers.Serializer):
    """App store smart links."""
    app_name = serializers.CharField(max_length=200)
    ios_url = serializers.URLField(required=False, allow_blank=True)
    android_url = serializers.URLField(required=False, allow_blank=True)
    fallback_url = serializers.URLField(help_text="Fallback for other devices")
    app_icon_url = serializers.URLField(required=False, allow_blank=True)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate(self, data):
        if not data.get("ios_url") and not data.get("android_url"):
            raise serializers.ValidationError(
                "At least one of ios_url or android_url is required"
            )
        return data


class SocialLinkSchema(serializers.Serializer):
    """Individual social media link."""
    platform = serializers.ChoiceField(choices=[
        ("facebook", "Facebook"),
        ("twitter", "Twitter/X"),
        ("instagram", "Instagram"),
        ("linkedin", "LinkedIn"),
        ("youtube", "YouTube"),
        ("tiktok", "TikTok"),
        ("pinterest", "Pinterest"),
        ("snapchat", "Snapchat"),
        ("whatsapp", "WhatsApp"),
        ("telegram", "Telegram"),
        ("discord", "Discord"),
        ("twitch", "Twitch"),
        ("github", "GitHub"),
        ("website", "Website"),
        ("other", "Other"),
    ])
    url = serializers.URLField()
    username = serializers.CharField(max_length=100, required=False, allow_blank=True)


class SocialHubSchema(serializers.Serializer):
    """Social media hub content."""
    title = serializers.CharField(max_length=200)
    bio = serializers.CharField(max_length=500, required=False, allow_blank=True)
    avatar_url = serializers.URLField(required=False, allow_blank=True)
    links = serializers.ListField(
        child=SocialLinkSchema(),
        min_length=1,
        max_length=15
    )
    theme = serializers.ChoiceField(
        choices=["light", "dark", "gradient"],
        default="light"
    )


# =============================================================================
# ENTERPRISE SCHEMAS
# =============================================================================

class SerializedProductSchema(serializers.Serializer):
    """Serialized product QR content for authentication."""
    serial_number = serializers.CharField(max_length=50)
    product_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    product_sku = serializers.CharField(max_length=100, required=False, allow_blank=True)
    batch_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    manufacture_date = serializers.DateField(required=False, allow_null=True)
    expiry_date = serializers.DateField(required=False, allow_null=True)
    metadata = serializers.DictField(required=False, default=dict)


# =============================================================================
# EXISTING TYPE SCHEMAS
# =============================================================================

class VCardSchema(serializers.Serializer):
    """Contact card (vCard) content."""
    name = serializers.CharField(max_length=200)
    organization = serializers.CharField(max_length=200, required=False, allow_blank=True)
    title = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    website = serializers.URLField(required=False, allow_blank=True)
    address = serializers.CharField(max_length=500, required=False, allow_blank=True)


class WiFiSchema(serializers.Serializer):
    """WiFi network QR content."""
    ssid = serializers.CharField(max_length=100)
    password = serializers.CharField(max_length=100, required=False, allow_blank=True)
    auth = serializers.ChoiceField(
        choices=["WPA", "WEP", "nopass"],
        default="WPA"
    )
    hidden = serializers.BooleanField(default=False)


class EmailSchema(serializers.Serializer):
    """Email QR content."""
    email = serializers.EmailField()
    subject = serializers.CharField(max_length=200, required=False, allow_blank=True)
    body = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class SMSSchema(serializers.Serializer):
    """SMS message QR content."""
    phone = serializers.CharField(max_length=20)
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)


class CalendarEventSchema(serializers.Serializer):
    """Calendar event QR content."""
    title = serializers.CharField(max_length=200)
    start = serializers.DateTimeField()
    end = serializers.DateTimeField(required=False, allow_null=True)
    location = serializers.CharField(max_length=500, required=False, allow_blank=True)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class LocationSchema(serializers.Serializer):
    """Geographic location QR content."""
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)


# =============================================================================
# SCHEMA REGISTRY
# =============================================================================

QR_TYPE_SCHEMAS = {
    "vcard": VCardSchema,
    "wifi": WiFiSchema,
    "email": EmailSchema,
    "sms": SMSSchema,
    "calendar": CalendarEventSchema,
    "location": LocationSchema,
    "upi": UPIPaymentSchema,
    "pix": PixPaymentSchema,
    "product": ProductInfoSchema,
    "menu": MenuSchema,
    "document": DocumentSchema,
    "pdf": PDFDocumentSchema,
    "multi_url": MultiURLSchema,
    "app_store": AppStoreLinksSchema,
    "social": SocialHubSchema,
    "serial": SerializedProductSchema,
}


def _sanitize_decimals(obj):
    """Recursively convert Decimal values to int/float for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_decimals(v) for v in obj]
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    return obj


def validate_content_data(qr_type: str, content_data: dict) -> dict:
    """
    Validate content_data against the appropriate schema.
    Returns validated data or raises ValidationError.
    """
    schema_class = QR_TYPE_SCHEMAS.get(qr_type)

    if not schema_class:
        # Types without schemas (link, text, phone) just pass through
        return content_data

    serializer = schema_class(data=content_data)
    serializer.is_valid(raise_exception=True)
    # DecimalField validators produce Decimal objects which aren't JSON-serializable
    return _sanitize_decimals(serializer.validated_data)
