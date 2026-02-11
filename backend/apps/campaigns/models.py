"""
Campaign models for TinlyLink.
Organize and track marketing campaigns.
"""

import random
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Campaign(models.Model):
    """
    Campaign model for organizing links.
    Supports scheduling, budget limits, and A/B testing.
    """

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("scheduled", "Scheduled"),
        ("active", "Active"),
        ("paused", "Paused"),
        ("completed", "Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="campaigns"
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="campaigns"
    )

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Scheduling
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    campaign_timezone = models.CharField(max_length=50, default="UTC")

    # Budget/Limits
    click_budget = models.IntegerField(null=True, blank=True, help_text="Maximum clicks allowed")
    clicks_used = models.IntegerField(default=0)

    # Fallback behavior when campaign is inactive
    fallback_url = models.URLField(max_length=2048, blank=True)
    expired_message = models.TextField(blank=True, default="This campaign has ended.")

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    # Default UTM parameters for links in this campaign
    default_utm_source = models.CharField(max_length=100, blank=True)
    default_utm_medium = models.CharField(max_length=100, blank=True)
    default_utm_campaign = models.CharField(max_length=100, blank=True)

    # Tags for organization
    tags = models.JSONField(default=list, blank=True)

    # Denormalized stats
    total_links = models.IntegerField(default=0)
    total_clicks = models.BigIntegerField(default=0)

    # Legacy field - kept for backwards compatibility
    is_active = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaigns"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["starts_at"]),
            models.Index(fields=["ends_at"]),
        ]

    def __str__(self):
        return self.name

    @property
    def is_currently_active(self):
        """Check if campaign is currently active based on status and schedule."""
        now = timezone.now()

        if self.status != "active":
            return False

        if self.starts_at and now < self.starts_at:
            return False

        if self.ends_at and now > self.ends_at:
            return False

        if self.click_budget and self.clicks_used >= self.click_budget:
            return False

        return True

    def increment_clicks(self):
        """Increment click counter atomically."""
        Campaign.objects.filter(id=self.id).update(
            clicks_used=models.F("clicks_used") + 1
        )

    def update_stats(self):
        """Update denormalized stats from links."""
        from django.db.models import Sum

        stats = self.links.aggregate(
            total_links=models.Count("id"),
            total_clicks=Sum("total_clicks")
        )

        self.total_links = stats["total_links"] or 0
        self.total_clicks = stats["total_clicks"] or 0
        self.save(update_fields=["total_links", "total_clicks"])


class Variant(models.Model):
    """
    A/B test variant for links or QR codes.
    Allows testing multiple destinations with weighted traffic distribution.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Can be attached to Link or QRCode (one of these should be set)
    link = models.ForeignKey(
        "links.Link",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="variants"
    )
    qr_code = models.ForeignKey(
        "qrcodes.QRCode",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="variants"
    )

    name = models.CharField(max_length=100)
    destination_url = models.URLField(max_length=2048)
    weight = models.IntegerField(default=50, help_text="Weight percentage 0-100")

    # Stats
    impressions = models.IntegerField(default=0)
    clicks = models.IntegerField(default=0)
    conversions = models.IntegerField(default=0)

    # Flags
    is_control = models.BooleanField(default=False, help_text="Is this the control variant")
    is_winner = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "variants"
        ordering = ["-is_control", "-weight"]
        indexes = [
            models.Index(fields=["link", "is_active"]),
            models.Index(fields=["qr_code", "is_active"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(link__isnull=False, qr_code__isnull=True) |
                    models.Q(link__isnull=True, qr_code__isnull=False)
                ),
                name="variant_single_parent",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.weight}%)"

    @property
    def click_rate(self):
        """Calculate click-through rate."""
        if self.impressions == 0:
            return 0
        return round((self.clicks / self.impressions) * 100, 2)

    @property
    def conversion_rate(self):
        """Calculate conversion rate."""
        if self.clicks == 0:
            return 0
        return round((self.conversions / self.clicks) * 100, 2)

    def increment_impressions(self):
        """Increment impression counter atomically."""
        Variant.objects.filter(id=self.id).update(
            impressions=models.F("impressions") + 1
        )

    def increment_clicks(self):
        """Increment click counter atomically."""
        Variant.objects.filter(id=self.id).update(
            clicks=models.F("clicks") + 1
        )


class VariantSelector:
    """Select variant based on weights using weighted random selection."""

    @staticmethod
    def select(variants):
        """
        Select a variant based on weight distribution.
        Returns None if no active variants.
        """
        active = [v for v in variants if v.is_active]
        if not active:
            return None

        total_weight = sum(v.weight for v in active)
        if total_weight == 0:
            return random.choice(active)

        r = random.uniform(0, total_weight)
        cumulative = 0

        for variant in active:
            cumulative += variant.weight
            if r <= cumulative:
                return variant

        return active[-1]
