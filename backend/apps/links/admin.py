"""
Admin configuration for links app.
"""

from django.contrib import admin

from .models import Link, CustomDomain


@admin.register(Link)
class LinkAdmin(admin.ModelAdmin):
    list_display = [
        "short_code", "original_url_truncated", "user", "total_clicks",
        "is_active", "created_at"
    ]
    list_filter = ["is_active", "created_at", "domain"]
    search_fields = ["short_code", "original_url", "user__email"]
    raw_id_fields = ["user", "domain", "campaign"]
    readonly_fields = ["total_clicks", "unique_clicks", "created_at", "updated_at"]
    ordering = ["-created_at"]
    
    fieldsets = (
        (None, {
            "fields": ("user", "short_code", "original_url", "title")
        }),
        ("Domain & Campaign", {
            "fields": ("domain", "campaign")
        }),
        ("UTM Parameters", {
            "fields": ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"),
            "classes": ("collapse",)
        }),
        ("Protection", {
            "fields": ("password_hash", "expires_at")
        }),
        ("Status", {
            "fields": ("is_active",)
        }),
        ("Statistics", {
            "fields": ("total_clicks", "unique_clicks")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at")
        }),
    )
    
    def original_url_truncated(self, obj):
        """Truncate long URLs for display."""
        url = obj.original_url
        return url[:50] + "..." if len(url) > 50 else url
    original_url_truncated.short_description = "Original URL"


@admin.register(CustomDomain)
class CustomDomainAdmin(admin.ModelAdmin):
    list_display = ["domain", "user", "is_verified", "ssl_status", "created_at"]
    list_filter = ["is_verified", "ssl_status", "created_at"]
    search_fields = ["domain", "user__email"]
    raw_id_fields = ["user"]
    readonly_fields = ["dns_txt_record", "verified_at", "created_at", "updated_at"]
