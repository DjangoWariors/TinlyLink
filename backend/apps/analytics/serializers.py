"""
Serializers for analytics app.
"""

from rest_framework import serializers


class OverviewStatsSerializer(serializers.Serializer):
    """Serializer for overview statistics."""
    
    total_clicks = serializers.IntegerField()
    total_links = serializers.IntegerField()
    total_qr_scans = serializers.IntegerField()
    unique_visitors = serializers.IntegerField()
    countries = serializers.IntegerField()
    clicks_trend = serializers.DictField()


class ClickChartDataSerializer(serializers.Serializer):
    """Serializer for click chart data."""
    
    date = serializers.CharField()
    clicks = serializers.IntegerField()
    unique_clicks = serializers.IntegerField()


class CountryStatsSerializer(serializers.Serializer):
    """Serializer for country statistics."""
    
    code = serializers.CharField()
    name = serializers.CharField()
    clicks = serializers.IntegerField()
    percentage = serializers.FloatField()


class GeographyStatsSerializer(serializers.Serializer):
    """Serializer for geography statistics."""
    
    countries = CountryStatsSerializer(many=True)
    total = serializers.IntegerField()


class DeviceStatsSerializer(serializers.Serializer):
    """Serializer for device statistics."""
    
    devices = serializers.DictField()
    browsers = serializers.ListField()
    operating_systems = serializers.ListField()
    total = serializers.IntegerField()


class ReferrerStatsSerializer(serializers.Serializer):
    """Serializer for referrer statistics."""
    
    referrers = serializers.ListField()
    direct = serializers.IntegerField()
    total = serializers.IntegerField()


class DailyStatsSerializer(serializers.Serializer):
    """Serializer for daily aggregated statistics."""

    id = serializers.UUIDField(read_only=True)
    date = serializers.DateField()
    total_clicks = serializers.IntegerField()
    unique_clicks = serializers.IntegerField()
    qr_scans = serializers.IntegerField()
    top_country_code = serializers.CharField()
    top_country_clicks = serializers.IntegerField()
    top_device = serializers.CharField()
    top_device_clicks = serializers.IntegerField()
    top_browser = serializers.CharField()
    top_browser_clicks = serializers.IntegerField()
    top_os = serializers.CharField()
    top_os_clicks = serializers.IntegerField()
    top_referrer = serializers.CharField()
    top_referrer_clicks = serializers.IntegerField()


class ExportRequestSerializer(serializers.Serializer):
    """Serializer for analytics export request."""

    period = serializers.ChoiceField(choices=["7d", "30d", "90d", "all"], default="30d")
    format = serializers.ChoiceField(choices=["csv", "json"], default="csv")
    link_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True
    )
