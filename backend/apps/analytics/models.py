"""
Analytics models for TinlyLink.
Includes click tracking and aggregation.
"""

import uuid

from django.conf import settings
from django.db import models


class ClickEvent(models.Model):
    """
    Individual click/scan event.
    Unified tracking for both links and QR codes.
    This table should be partitioned by month in production.
    """

    VERIFICATION_STATUS_CHOICES = [
        ("valid", "Valid"),
        ("suspicious", "Suspicious"),
        ("invalid", "Invalid"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Link (nullable for non-link QR types)
    link = models.ForeignKey(
        "links.Link",
        on_delete=models.CASCADE,
        related_name="clicks",
        null=True,
        blank=True,
    )

    # QR Code tracking
    qr_code = models.ForeignKey(
        "qrcodes.QRCode",
        on_delete=models.CASCADE,
        related_name="scans",
        null=True,
        blank=True,
    )

    # Campaign tracking
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.SET_NULL,
        related_name="clicks",
        null=True,
        blank=True,
    )

    # A/B Testing
    variant_id = models.UUIDField(null=True, blank=True)

    clicked_at = models.DateTimeField(db_index=True)

    # Visitor info
    ip_hash = models.CharField(max_length=64, blank=True)  # SHA-256 hashed
    user_agent = models.TextField(blank=True)
    referer = models.TextField(blank=True)

    # Geo data (from MaxMind)
    country_code = models.CharField(max_length=2, blank=True, db_index=True)
    country_name = models.CharField(max_length=100, blank=True)
    region = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    timezone = models.CharField(max_length=50, blank=True)

    # Device data (parsed from UA)
    device_type = models.CharField(max_length=20, blank=True, db_index=True)
    browser = models.CharField(max_length=50, blank=True)
    browser_version = models.CharField(max_length=20, blank=True)
    os = models.CharField(max_length=50, blank=True)
    os_version = models.CharField(max_length=20, blank=True)

    # UTM from referer
    utm_source = models.CharField(max_length=100, blank=True)
    utm_medium = models.CharField(max_length=100, blank=True)
    utm_campaign = models.CharField(max_length=100, blank=True)

    # QR specific
    is_qr_scan = models.BooleanField(default=False)

    # Serialized QR verification
    is_first_scan = models.BooleanField(default=False)
    serial_number = models.CharField(max_length=50, blank=True, db_index=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS_CHOICES,
        blank=True,
    )

    class Meta:
        db_table = "clicks"
        ordering = ["-clicked_at"]
        indexes = [
            models.Index(fields=["link", "-clicked_at"]),
            models.Index(fields=["qr_code", "-clicked_at"]),
            models.Index(fields=["campaign", "-clicked_at"]),
            models.Index(fields=["country_code"]),
            models.Index(fields=["device_type"]),
            models.Index(fields=["clicked_at"]),
            models.Index(fields=["serial_number"]),
        ]

    def __str__(self):
        if self.qr_code_id:
            return f"Scan on QR {self.qr_code_id} at {self.clicked_at}"
        return f"Click on {self.link_id} at {self.clicked_at}"


class DailyStats(models.Model):
    """
    Aggregated daily statistics per link, QR code, or campaign.
    Pre-computed for fast dashboard queries.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Can be for link, QR code, or campaign (one of these should be set)
    link = models.ForeignKey(
        "links.Link",
        on_delete=models.CASCADE,
        related_name="daily_stats",
        null=True,
        blank=True,
    )
    qr_code = models.ForeignKey(
        "qrcodes.QRCode",
        on_delete=models.CASCADE,
        related_name="daily_stats",
        null=True,
        blank=True,
    )
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.CASCADE,
        related_name="daily_stats",
        null=True,
        blank=True,
    )

    date = models.DateField(db_index=True)

    # Counts
    total_clicks = models.IntegerField(default=0)
    unique_clicks = models.IntegerField(default=0)
    qr_scans = models.IntegerField(default=0)

    # Top country
    top_country_code = models.CharField(max_length=2, blank=True)
    top_country_clicks = models.IntegerField(default=0)

    # Device breakdown
    mobile_clicks = models.IntegerField(default=0)
    desktop_clicks = models.IntegerField(default=0)
    tablet_clicks = models.IntegerField(default=0)

    class Meta:
        db_table = "daily_stats"
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["link", "-date"]),
            models.Index(fields=["qr_code", "-date"]),
            models.Index(fields=["campaign", "-date"]),
            models.Index(fields=["date"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(link__isnull=False, qr_code__isnull=True, campaign__isnull=True) |
                    models.Q(link__isnull=True, qr_code__isnull=False, campaign__isnull=True) |
                    models.Q(link__isnull=True, qr_code__isnull=True, campaign__isnull=False)
                ),
                name="daily_stats_single_entity",
            ),
        ]

    def __str__(self):
        if self.link_id:
            return f"Stats for link {self.link_id} on {self.date}"
        if self.qr_code_id:
            return f"Stats for QR {self.qr_code_id} on {self.date}"
        if self.campaign_id:
            return f"Stats for campaign {self.campaign_id} on {self.date}"
        return f"Stats on {self.date}"


class CountryStats(models.Model):
    """
    Aggregated country statistics per link.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    link = models.ForeignKey(
        "links.Link",
        on_delete=models.CASCADE,
        related_name="country_stats"
    )
    country_code = models.CharField(max_length=2)
    country_name = models.CharField(max_length=100)
    
    total_clicks = models.IntegerField(default=0)
    unique_clicks = models.IntegerField(default=0)
    
    # Period
    period_start = models.DateField()
    period_end = models.DateField()
    
    class Meta:
        db_table = "country_stats"
        unique_together = ["link", "country_code", "period_start"]
        ordering = ["-total_clicks"]
    
    def __str__(self):
        return f"{self.country_name}: {self.total_clicks} clicks"


class ReferrerStats(models.Model):
    """
    Aggregated referrer statistics per link.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    link = models.ForeignKey(
        "links.Link",
        on_delete=models.CASCADE,
        related_name="referrer_stats"
    )
    referer_domain = models.CharField(max_length=255)
    
    total_clicks = models.IntegerField(default=0)
    
    # Period
    period_start = models.DateField()
    period_end = models.DateField()
    
    class Meta:
        db_table = "referrer_stats"
        unique_together = ["link", "referer_domain", "period_start"]
        ordering = ["-total_clicks"]
    
    def __str__(self):
        return f"{self.referer_domain}: {self.total_clicks} clicks"
