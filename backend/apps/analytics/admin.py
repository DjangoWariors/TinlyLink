"""
Admin configuration for analytics app.
"""

from django.contrib import admin

from .models import ClickEvent, DailyStats, CountryStats, ReferrerStats


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


@admin.register(DailyStats)
class DailyStatsAdmin(admin.ModelAdmin):
    list_display = ["date", "link", "qr_code", "total_clicks", "unique_clicks"]
    list_filter = ["date"]
    date_hierarchy = "date"
    raw_id_fields = ["link", "qr_code", "campaign"]

    def has_add_permission(self, request):
        return False


@admin.register(CountryStats)
class CountryStatsAdmin(admin.ModelAdmin):
    list_display = ["country_code", "country_name", "total_clicks", "period_start"]
    list_filter = ["period_start", "country_code"]
    search_fields = ["country_name", "country_code"]

    def has_add_permission(self, request):
        return False


@admin.register(ReferrerStats)
class ReferrerStatsAdmin(admin.ModelAdmin):
    list_display = ["referer_domain", "total_clicks", "period_start"]
    list_filter = ["period_start"]
    search_fields = ["referer_domain"]

    def has_add_permission(self, request):
        return False
