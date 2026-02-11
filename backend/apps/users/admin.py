"""
Admin configuration for users app.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, Subscription, APIKey, UsageTracking


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "full_name", "email_verified", "is_active", "created_at"]
    list_filter = ["email_verified", "is_active", "is_staff", "created_at"]
    search_fields = ["email", "full_name"]
    ordering = ["-created_at"]
    
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("full_name", "company", "avatar_url")}),
        ("Verification", {"fields": ("email_verified", "email_verified_at")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "created_at")}),
    )
    
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "password1", "password2"),
        }),
    )
    
    readonly_fields = ["created_at", "email_verified_at"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "plan", "status", "current_period_end"]
    list_filter = ["plan", "status"]
    search_fields = ["user__email"]
    raw_id_fields = ["user"]


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "key_prefix", "is_active", "last_used_at", "created_at"]
    list_filter = ["is_active", "created_at"]
    search_fields = ["name", "user__email", "key_prefix"]
    raw_id_fields = ["user"]
    readonly_fields = ["key_prefix", "key_hash", "total_requests", "last_used_at", "created_at"]


@admin.register(UsageTracking)
class UsageTrackingAdmin(admin.ModelAdmin):
    list_display = ["user", "period_start", "links_created", "qr_codes_created", "api_calls"]
    list_filter = ["period_start"]
    search_fields = ["user__email"]
    raw_id_fields = ["user"]
