"""
Serializers for campaigns app.
"""

from rest_framework import serializers

from .models import Campaign, Variant


class CampaignSerializer(serializers.ModelSerializer):
    """Serializer for Campaign model."""

    links_count = serializers.IntegerField(source="total_links", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    is_currently_active = serializers.BooleanField(read_only=True)
    budget_percent = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "description",
            # Scheduling
            "status", "starts_at", "ends_at", "campaign_timezone",
            # Budget
            "click_budget", "clicks_used", "budget_percent",
            # Fallback
            "fallback_url", "expired_message",
            # UTM
            "default_utm_source", "default_utm_medium", "default_utm_campaign",
            # Tags
            "tags",
            # Stats
            "total_links", "total_clicks", "links_count",
            # Meta
            "created_by_name", "is_currently_active", "is_active",
            "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "total_links", "total_clicks", "clicks_used",
            "created_at", "updated_at"
        ]

    def get_created_by_name(self, obj):
        """Return creator name for team mode."""
        if obj.user:
            return obj.user.display_name
        return None

    def get_budget_percent(self, obj):
        """Return budget usage percentage."""
        if not obj.click_budget:
            return None
        return round((obj.clicks_used / obj.click_budget) * 100, 1)


class CreateCampaignSerializer(serializers.Serializer):
    """Serializer for creating a campaign."""

    name = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    # Scheduling
    status = serializers.ChoiceField(
        choices=Campaign.STATUS_CHOICES,
        required=False,
        default="draft"
    )
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    ends_at = serializers.DateTimeField(required=False, allow_null=True)
    campaign_timezone = serializers.CharField(max_length=50, required=False, default="UTC")
    # Budget
    click_budget = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    # Fallback
    fallback_url = serializers.URLField(max_length=2048, required=False, allow_blank=True)
    expired_message = serializers.CharField(required=False, allow_blank=True)
    # UTM
    default_utm_source = serializers.CharField(max_length=100, required=False, allow_blank=True)
    default_utm_medium = serializers.CharField(max_length=100, required=False, allow_blank=True)
    default_utm_campaign = serializers.CharField(max_length=100, required=False, allow_blank=True)
    # Tags
    tags = serializers.ListField(child=serializers.CharField(), required=False, default=list)

    def validate(self, data):
        """Validate scheduling dates."""
        starts_at = data.get("starts_at")
        ends_at = data.get("ends_at")

        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError({
                "ends_at": "End date must be after start date"
            })

        # If status is scheduled, start date is required
        if data.get("status") == "scheduled" and not starts_at:
            raise serializers.ValidationError({
                "starts_at": "Start date is required for scheduled campaigns"
            })

        return data


class UpdateCampaignSerializer(serializers.Serializer):
    """Serializer for updating a campaign."""

    name = serializers.CharField(max_length=200, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    # Scheduling
    status = serializers.ChoiceField(choices=Campaign.STATUS_CHOICES, required=False)
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    ends_at = serializers.DateTimeField(required=False, allow_null=True)
    campaign_timezone = serializers.CharField(max_length=50, required=False)
    # Budget
    click_budget = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    # Fallback
    fallback_url = serializers.URLField(max_length=2048, required=False, allow_blank=True)
    expired_message = serializers.CharField(required=False, allow_blank=True)
    # UTM
    default_utm_source = serializers.CharField(max_length=100, required=False, allow_blank=True)
    default_utm_medium = serializers.CharField(max_length=100, required=False, allow_blank=True)
    default_utm_campaign = serializers.CharField(max_length=100, required=False, allow_blank=True)
    # Tags
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    # Legacy
    is_active = serializers.BooleanField(required=False)


class CampaignStatsSerializer(serializers.Serializer):
    """Serializer for campaign statistics."""

    total_clicks = serializers.IntegerField()
    unique_visitors = serializers.IntegerField()
    qr_scans = serializers.IntegerField()
    clicks_by_day = serializers.ListField()
    top_links = serializers.ListField()
    top_countries = serializers.ListField()
    device_breakdown = serializers.ListField()


# =============================================================================
# VARIANT SERIALIZERS
# =============================================================================

class VariantSerializer(serializers.ModelSerializer):
    """Serializer for Variant model."""

    click_rate = serializers.FloatField(read_only=True)
    conversion_rate = serializers.FloatField(read_only=True)

    class Meta:
        model = Variant
        fields = [
            "id", "name", "destination_url", "weight",
            "impressions", "clicks", "conversions",
            "click_rate", "conversion_rate",
            "is_control", "is_winner", "is_active",
            "created_at"
        ]
        read_only_fields = [
            "id", "impressions", "clicks", "conversions",
            "is_winner", "created_at"
        ]


class CreateVariantSerializer(serializers.Serializer):
    """Serializer for creating a variant."""

    name = serializers.CharField(max_length=100)
    destination_url = serializers.URLField(max_length=2048)
    weight = serializers.IntegerField(min_value=0, max_value=100, default=50)
    is_control = serializers.BooleanField(default=False)


class UpdateVariantSerializer(serializers.Serializer):
    """Serializer for updating a variant."""

    name = serializers.CharField(max_length=100, required=False)
    destination_url = serializers.URLField(max_length=2048, required=False)
    weight = serializers.IntegerField(min_value=0, max_value=100, required=False)
    is_active = serializers.BooleanField(required=False)


class VariantStatsSerializer(serializers.Serializer):
    """Serializer for A/B test statistics."""

    id = serializers.UUIDField()
    name = serializers.CharField()
    weight = serializers.IntegerField()
    impressions = serializers.IntegerField()
    clicks = serializers.IntegerField()
    click_rate = serializers.FloatField()
    conversions = serializers.IntegerField()
    conversion_rate = serializers.FloatField()
    is_control = serializers.BooleanField()
    is_winner = serializers.BooleanField()
    lift = serializers.FloatField(required=False, allow_null=True)
    significance = serializers.IntegerField(required=False, allow_null=True)
