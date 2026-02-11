"""
Admin configuration for analytics app.
"""

from django.contrib import admin

from .models import ClickEvent


@admin.register(ClickEvent)
class ClickEventAdmin(admin.ModelAdmin):
    list_display = ["link", "clicked_at", "country_code", "device_type", "browser"]
    list_filter = ["device_type", "country_code", "clicked_at"]
    search_fields = ["link__short_code", "country_name", "city"]
    raw_id_fields = ["link"]
    date_hierarchy = "clicked_at"
    readonly_fields = [
        "link", "clicked_at", "ip_hash", "user_agent", "referer",
        "country_code", "country_name", "region", "city",
        "device_type", "browser", "os"
    ]
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
