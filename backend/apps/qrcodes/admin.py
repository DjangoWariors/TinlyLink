"""
Admin configuration for QR codes app.
"""

from django.contrib import admin

from .models import QRCode, SerialBatch, SerialCode


@admin.register(QRCode)
class QRCodeAdmin(admin.ModelAdmin):
    list_display = ["id", "link", "user", "style", "total_scans", "created_at"]
    list_filter = ["style", "created_at"]
    search_fields = ["link__short_code", "user__email"]
    raw_id_fields = ["link", "user"]
    readonly_fields = ["total_scans", "png_path", "svg_path", "pdf_path", "created_at", "updated_at"]
    
    fieldsets = (
        (None, {
            "fields": ("link", "user")
        }),
        ("Design", {
            "fields": ("style", "foreground_color", "background_color", "logo_url")
        }),
        ("Files", {
            "fields": ("png_path", "svg_path", "pdf_path")
        }),
        ("Statistics", {
            "fields": ("total_scans",)
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at")
        }),
    )


@admin.register(SerialBatch)
class SerialBatchAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "quantity", "generated_count", "status", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["name", "user__email"]
    raw_id_fields = ["user", "team"]
    readonly_fields = ["generated_count", "created_at", "updated_at"]


@admin.register(SerialCode)
class SerialCodeAdmin(admin.ModelAdmin):
    list_display = ["serial_number", "batch", "status", "total_scans", "first_scanned_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["serial_number", "batch__name"]
    raw_id_fields = ["batch", "qr_code"]
    readonly_fields = ["serial_number", "total_scans", "unique_ips", "first_scanned_at", "created_at"]
