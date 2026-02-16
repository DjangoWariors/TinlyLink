"""
Admin configuration for campaigns app.
"""

from django.contrib import admin

from .models import Campaign, Variant


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "total_links", "total_clicks", "is_active", "created_at"]
    list_filter = ["is_active", "created_at"]
    search_fields = ["name", "user__email"]
    raw_id_fields = ["user"]
    readonly_fields = ["total_links", "total_clicks", "created_at", "updated_at"]


@admin.register(Variant)
class VariantAdmin(admin.ModelAdmin):
    list_display = ["name", "link", "weight", "clicks", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["name"]
    raw_id_fields = ["link", "qr_code"]
    readonly_fields = ["clicks", "impressions", "conversions", "created_at"]
