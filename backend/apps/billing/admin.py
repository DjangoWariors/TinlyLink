"""
Admin configuration for billing app.
"""

from django.contrib import admin

from .models import Plan


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "slug",
        "formatted_monthly_price",
        "is_enabled",
        "is_coming_soon",
        "is_popular",
        "sort_order",
    ]
    list_editable = ["is_enabled", "is_coming_soon", "sort_order"]
    list_filter = ["is_enabled", "is_coming_soon", "is_popular"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        (
            "Identity",
            {
                "fields": ("name", "slug", "description"),
            },
        ),
        (
            "Status & Display",
            {
                "fields": (
                    "is_enabled",
                    "is_coming_soon",
                    "sort_order",
                    "is_popular",
                    "badge_text",
                    "cta_text",
                    "features_json",
                ),
            },
        ),
        (
            "Pricing",
            {
                "fields": (
                    "monthly_price",
                    "yearly_price",
                    "stripe_monthly_price_id",
                    "stripe_yearly_price_id",
                ),
                "description": "Prices in cents (e.g. 1200 = $12.00)",
            },
        ),
        (
            "Numeric Limits",
            {
                "fields": (
                    "links_per_month",
                    "qr_codes_per_month",
                    "api_calls_per_month",
                    "custom_domains",
                    "analytics_retention_days",
                    "team_members",
                    "serial_batch_limit",
                    "bio_pages_limit",
                    "landing_pages_limit",
                ),
                "description": "Use -1 for unlimited",
            },
        ),
        (
            "Feature Flags",
            {
                "fields": (
                    "retargeting_pixels",
                    "custom_slugs",
                    "password_protection",
                    "show_ads",
                    "priority_support",
                    "sso",
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Monthly Price")
    def formatted_monthly_price(self, obj):
        return f"${obj.monthly_price / 100:.2f}"
