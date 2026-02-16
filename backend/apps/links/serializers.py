"""
Serializers for links app.
"""

from rest_framework import serializers

from apps.users.models import UsageTracking
from apps.users.exceptions import (
    UsageLimitExceeded, FeatureNotAvailable, InvalidURL, SlugNotAvailable
)
from .models import Link, CustomDomain, RetargetingPixel


class CustomDomainSerializer(serializers.ModelSerializer):
    """Serializer for custom domains."""
    
    class Meta:
        model = CustomDomain
        fields = [
            "id", "domain", "is_verified", "verified_at",
            "dns_txt_record", "ssl_status", "created_at"
        ]
        read_only_fields = ["id", "is_verified", "verified_at", "dns_txt_record", "ssl_status", "created_at"]


class CreateCustomDomainSerializer(serializers.Serializer):
    """Serializer for creating custom domain."""
    
    domain = serializers.CharField(max_length=255)
    
    def validate_domain(self, value):
        """Validate domain format and availability."""
        import re
        
        # Check format
        if not re.match(r"^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$", value):
            raise serializers.ValidationError("Invalid domain format")
        
        # Check availability
        if CustomDomain.objects.filter(domain=value.lower()).exists():
            raise serializers.ValidationError("This domain is already registered")
        
        return value.lower()


class LinkSerializer(serializers.ModelSerializer):
    """Serializer for Link model."""
    
    short_url = serializers.CharField(read_only=True)
    domain_name = serializers.CharField(source="domain.domain", read_only=True, allow_null=True)
    campaign_name = serializers.CharField(source="campaign.name", read_only=True, allow_null=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_password_protected = serializers.BooleanField(read_only=True)
    destination_url = serializers.CharField(read_only=True)
    qr_code = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    def get_qr_code(self, obj):
        if hasattr(obj, 'qr_code') and obj.qr_code:
            from apps.qrcodes.serializers import QRCodeSerializer
            return QRCodeSerializer(obj.qr_code).data
        return None

    def get_created_by_name(self, obj):
        """Return creator name for team mode."""
        if obj.user:
            return obj.user.display_name
        return None
    
    class Meta:
        model = Link
        fields = [
            "id", "short_code", "short_url", "original_url", "destination_url",
            "title", "domain", "domain_name", "campaign", "campaign_name",
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
            "is_password_protected", "expires_at", "is_expired", "is_active",
            "total_clicks", "unique_clicks", "qr_code", "created_by_name",
            "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "short_code", "short_url", "destination_url", "is_expired",
            "is_password_protected", "total_clicks", "unique_clicks",
            "created_at", "updated_at"
        ]


class CreateLinkSerializer(serializers.Serializer):
    """Serializer for creating a link."""
    
    original_url = serializers.URLField(max_length=2048)
    custom_slug = serializers.CharField(max_length=50, required=False, allow_blank=True)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    domain_id = serializers.UUIDField(required=False, allow_null=True)
    campaign_id = serializers.UUIDField(required=False, allow_null=True)
    password = serializers.CharField(max_length=100, required=False, allow_blank=True, write_only=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    
    # UTM parameters
    utm_source = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_medium = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_campaign = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_term = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_content = serializers.CharField(max_length=100, required=False, allow_blank=True)
    
    # Option to create QR
    # Option to create QR
    create_qr = serializers.BooleanField(default=False)
    qr_style = serializers.CharField(max_length=20, required=False, default="square")
    qr_frame = serializers.CharField(max_length=20, required=False, default="none")
    qr_foreground_color = serializers.CharField(max_length=7, required=False, default="#000000")
    qr_background_color = serializers.CharField(max_length=7, required=False, default="#FFFFFF")
    
    def validate_original_url(self, value):
        """Validate URL against blocked patterns."""
        is_valid, error = Link.validate_url(value)
        if not is_valid:
            raise InvalidURL(detail=error)
        return value
    
    def validate(self, attrs):
        """Validate based on user's subscription."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            # Anonymous link - limited options
            attrs.pop("custom_slug", None)
            attrs.pop("domain_id", None)
            attrs.pop("password", None)
            return attrs
        
        user = request.user
        subscription = getattr(user, "subscription", None)
        
        # Check usage limits
        usage = UsageTracking.get_current_period(user)
        if not subscription.can_create_link(usage.links_created):
            raise UsageLimitExceeded(
                detail="You have reached your monthly link limit. Please upgrade your plan."
            )
        
        plan = subscription.plan

        # Validate custom slug
        custom_slug = attrs.get("custom_slug")
        if custom_slug:
            if not subscription.can_use_custom_slug():
                raise FeatureNotAvailable(
                    detail="Custom slugs are only available on paid plans."
                )
            
            domain_id = attrs.get("domain_id")
            domain = None
            if domain_id:
                try:
                    team = getattr(request, "team", None)
                    if team:
                        domain = CustomDomain.objects.get(id=domain_id, team=team)
                    else:
                        domain = CustomDomain.objects.get(id=domain_id, user=user)
                except CustomDomain.DoesNotExist:
                    raise serializers.ValidationError({"domain_id": "Invalid domain"})
            
            is_valid, error = Link.validate_slug(custom_slug, domain)
            if not is_valid:
                raise SlugNotAvailable(detail=error)
        
        # Validate password protection
        if attrs.get("password"):
            if not subscription.can_use_password_protection():
                raise FeatureNotAvailable(
                    detail="Password protection is only available on paid plans."
                )

        # Validate QR customization options if creating QR
        if attrs.get("create_qr") and plan == "free":
            if attrs.get("qr_style") != "square":
                raise FeatureNotAvailable(
                    detail="Custom QR styles are only available on paid plans."
                )
            if attrs.get("qr_frame") and attrs.get("qr_frame") != "none":
                raise FeatureNotAvailable(
                    detail="QR code frames are only available on paid plans."
                )
            if attrs.get("qr_foreground_color") != "#000000":
                raise FeatureNotAvailable(
                    detail="Custom QR colors are only available on paid plans."
                )
            if attrs.get("qr_background_color") != "#FFFFFF":
                raise FeatureNotAvailable(
                    detail="Custom QR colors are only available on paid plans."
                )
        
        # Validate domain
        domain_id = attrs.get("domain_id")
        if domain_id:
            # Check if user's plan allows custom domains
            domain_limit = subscription.limits.get("custom_domains", 0)
            if domain_limit == 0:
                raise FeatureNotAvailable(
                    detail="Custom domains are only available on paid plans."
                )
            try:
                team = getattr(request, "team", None)
                if team:
                    domain = CustomDomain.objects.get(id=domain_id, team=team, is_verified=True)
                else:
                    domain = CustomDomain.objects.get(id=domain_id, user=user, is_verified=True)
                attrs["domain"] = domain
            except CustomDomain.DoesNotExist:
                raise serializers.ValidationError({
                    "domain_id": "Invalid or unverified domain"
                })

        # Validate campaign ownership
        campaign_id = attrs.get("campaign_id")
        if campaign_id:
            from apps.campaigns.models import Campaign
            team = getattr(request, "team", None)
            try:
                if team:
                    Campaign.objects.get(id=campaign_id, team=team)
                else:
                    Campaign.objects.get(id=campaign_id, user=user, team__isnull=True)
            except Campaign.DoesNotExist:
                raise serializers.ValidationError({
                    "campaign_id": "Invalid campaign or you don't have access to it"
                })

        return attrs
    
    def create(self, validated_data):
        """Create the link."""
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        team = getattr(request, "team", None) if request else None
        
        # Extract fields
        custom_slug = validated_data.pop("custom_slug", None)
        password = validated_data.pop("password", None)
        create_qr = validated_data.pop("create_qr", False)
        
        # QR Customization
        qr_style = validated_data.pop("qr_style", "square")
        qr_frame = validated_data.pop("qr_frame", "none")
        qr_fg = validated_data.pop("qr_foreground_color", "#000000")
        qr_bg = validated_data.pop("qr_background_color", "#FFFFFF")
        
        validated_data.pop("domain_id", None)  # Already processed
        campaign_id = validated_data.pop("campaign_id", None)

        # Create link
        link = Link(
            user=user,
            team=team,  # Team context
            **validated_data
        )

        # Assign campaign if provided
        if campaign_id:
            link.campaign_id = campaign_id
        
        if custom_slug:
            link.short_code = custom_slug
        
        if password:
            link.set_password(password)
        
        link.save()
        
        # Track usage
        if user:
            usage = UsageTracking.get_current_period(user)
            usage.increment_links()
        
        # Store QR flag for view to handle
        link._create_qr = create_qr
        link._qr_style = qr_style
        link._qr_frame = qr_frame
        link._qr_foreground_color = qr_fg
        link._qr_background_color = qr_bg
        
        return link


class UpdateLinkSerializer(serializers.Serializer):
    """Serializer for updating a link."""
    
    original_url = serializers.URLField(max_length=2048, required=False)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    campaign_id = serializers.UUIDField(required=False, allow_null=True)
    password = serializers.CharField(max_length=100, required=False, allow_blank=True, write_only=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)
    
    # UTM parameters
    utm_source = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_medium = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_campaign = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_term = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_content = serializers.CharField(max_length=100, required=False, allow_blank=True)
    
    def validate_original_url(self, value):
        """Validate URL."""
        if value:
            is_valid, error = Link.validate_url(value)
            if not is_valid:
                raise InvalidURL(detail=error)
        return value

    def validate(self, attrs):
        """Validate based on user's subscription."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return attrs

        user = request.user
        subscription = getattr(user, "subscription", None)

        # Validate password protection
        if attrs.get("password"):
            if not subscription or not subscription.can_use_password_protection():
                raise FeatureNotAvailable(
                    detail="Password protection is only available on paid plans."
                )

        return attrs

    def update(self, instance, validated_data):
        """Update the link."""
        password = validated_data.pop("password", None)
        
        # Update fields
        for field, value in validated_data.items():
            setattr(instance, field, value)
        
        # Handle password
        if password:
            instance.set_password(password)
        elif password == "":
            instance.password_hash = ""
        
        instance.save()
        return instance


class BulkCreateLinksSerializer(serializers.Serializer):
    """Serializer for bulk link creation."""
    
    urls = serializers.ListField(
        child=serializers.URLField(max_length=2048),
        min_length=1,
        max_length=100
    )
    campaign_id = serializers.UUIDField(required=False, allow_null=True)


class RetargetingPixelSerializer(serializers.ModelSerializer):
    """Serializer for RetargetingPixel model."""

    links_count = serializers.SerializerMethodField()

    class Meta:
        model = RetargetingPixel
        fields = [
            "id", "name", "platform", "pixel_id", "custom_script",
            "is_active", "links_count", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_links_count(self, obj):
        return obj.links.count()


class CreatePixelSerializer(serializers.Serializer):
    """Serializer for creating a retargeting pixel."""

    name = serializers.CharField(max_length=100)
    platform = serializers.ChoiceField(choices=RetargetingPixel.PLATFORM_CHOICES)
    pixel_id = serializers.CharField(max_length=255)
    custom_script = serializers.CharField(required=False, allow_blank=True, default="")


class UpdatePixelSerializer(serializers.Serializer):
    """Serializer for updating a retargeting pixel."""

    name = serializers.CharField(max_length=100, required=False)
    pixel_id = serializers.CharField(max_length=255, required=False)
    custom_script = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)


class LinkStatsSerializer(serializers.Serializer):
    """Serializer for link statistics."""
    
    total_clicks = serializers.IntegerField()
    unique_clicks = serializers.IntegerField()
    clicks_by_day = serializers.ListField()
    top_countries = serializers.ListField()
    top_cities = serializers.ListField()
    devices = serializers.DictField()
    browsers = serializers.ListField()
    referrers = serializers.ListField()
