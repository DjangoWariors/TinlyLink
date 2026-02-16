"""
Billing models for TinlyLink.
Database-driven plan configuration.
"""

from django.conf import settings
from django.db import models


class Plan(models.Model):
    """
    Database-driven plan configuration.
    Single source of truth for plan limits, pricing, and display settings.
    Falls back to settings.PLAN_LIMITS for plans not yet in DB.
    """

    # Identity
    slug = models.SlugField(max_length=30, unique=True, db_index=True)
    name = models.CharField(max_length=50)
    description = models.CharField(max_length=200, blank=True)

    # Status
    is_enabled = models.BooleanField(default=True)
    is_coming_soon = models.BooleanField(default=False)

    # Display
    sort_order = models.IntegerField(default=0)
    is_popular = models.BooleanField(default=False)
    badge_text = models.CharField(max_length=30, blank=True)
    cta_text = models.CharField(max_length=50, default="Get Started")
    features_json = models.JSONField(default=list)

    # Pricing (cents)
    monthly_price = models.IntegerField(default=0)
    yearly_price = models.IntegerField(default=0)

    # Stripe
    stripe_monthly_price_id = models.CharField(max_length=100, blank=True)
    stripe_yearly_price_id = models.CharField(max_length=100, blank=True)

    # Numeric limits (-1 = unlimited)
    links_per_month = models.IntegerField(default=50)
    qr_codes_per_month = models.IntegerField(default=10)
    api_calls_per_month = models.IntegerField(default=0)
    custom_domains = models.IntegerField(default=0)
    analytics_retention_days = models.IntegerField(default=30)
    team_members = models.IntegerField(default=0)
    serial_batch_limit = models.IntegerField(default=0)

    # New feature limits
    bio_pages_limit = models.IntegerField(default=1)       # -1 = unlimited
    landing_pages_limit = models.IntegerField(default=0)   # -1 = unlimited
    retargeting_pixels = models.BooleanField(default=False)

    # Boolean features
    custom_slugs = models.BooleanField(default=False)
    password_protection = models.BooleanField(default=False)
    show_ads = models.BooleanField(default=True)
    priority_support = models.BooleanField(default=False)
    sso = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "monthly_price"]

    def __str__(self):
        status = ""
        if not self.is_enabled:
            status = " [DISABLED]"
        elif self.is_coming_soon:
            status = " [COMING SOON]"
        return f"{self.name} (${self.monthly_price / 100:.0f}/mo){status}"

    def to_limits_dict(self):
        """Return a dict matching the shape of settings.PLAN_LIMITS[slug]."""
        return {
            "links_per_month": self.links_per_month,
            "qr_codes_per_month": self.qr_codes_per_month,
            "api_calls_per_month": self.api_calls_per_month,
            "custom_domains": self.custom_domains,
            "analytics_retention_days": self.analytics_retention_days,
            "team_members": self.team_members,
            "serial_batch_limit": self.serial_batch_limit,
            "bio_pages_limit": self.bio_pages_limit,
            "landing_pages_limit": self.landing_pages_limit,
            "retargeting_pixels": self.retargeting_pixels,
            "custom_slugs": self.custom_slugs,
            "password_protection": self.password_protection,
            "show_ads": self.show_ads,
            "priority_support": self.priority_support,
            "sso": self.sso,
        }

    @classmethod
    def get_limits(cls, slug):
        """Get limits dict for a plan slug, with Django cache (5 min TTL).
        Falls back to settings.PLAN_LIMITS if plan not in DB."""
        from django.core.cache import cache

        cache_key = f"plan_limits:{slug}"
        limits = cache.get(cache_key)
        if limits is None:
            try:
                plan = cls.objects.get(slug=slug)
                limits = plan.to_limits_dict()
            except cls.DoesNotExist:
                limits = settings.PLAN_LIMITS.get(
                    slug, settings.PLAN_LIMITS.get("free", {})
                )
            cache.set(cache_key, limits, timeout=300)
        return limits

    def save(self, *args, **kwargs):
        """Invalidate cache on save."""
        super().save(*args, **kwargs)
        from django.core.cache import cache

        cache.delete(f"plan_limits:{self.slug}")
        cache.delete("plans_list")
        cache.delete("pricing_page_plans")
