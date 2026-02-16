"""
Admin configuration for biolinks app.
"""

from django.contrib import admin

from .models import BioPage, BioLink, LandingPage, LandingPageTemplate, FormSubmission


class BioLinkInline(admin.TabularInline):
    model = BioLink
    extra = 0
    fields = ["title", "custom_url", "link", "position", "is_active"]
    raw_id_fields = ["link"]


@admin.register(BioPage)
class BioPageAdmin(admin.ModelAdmin):
    list_display = ["slug", "title", "user", "theme", "is_published", "total_views", "created_at"]
    list_filter = ["is_published", "theme", "created_at"]
    search_fields = ["slug", "title", "user__email"]
    raw_id_fields = ["user", "team"]
    readonly_fields = ["total_views", "created_at", "updated_at"]
    inlines = [BioLinkInline]


@admin.register(BioLink)
class BioLinkAdmin(admin.ModelAdmin):
    list_display = ["title", "bio_page", "position", "is_active", "total_clicks"]
    list_filter = ["is_active"]
    search_fields = ["title"]
    raw_id_fields = ["bio_page", "link"]
    readonly_fields = ["total_clicks", "created_at", "updated_at"]


@admin.register(LandingPage)
class LandingPageAdmin(admin.ModelAdmin):
    list_display = ["slug", "title", "user", "is_published", "total_views", "total_conversions", "created_at"]
    list_filter = ["is_published", "created_at"]
    search_fields = ["slug", "title", "user__email"]
    raw_id_fields = ["user", "team", "template"]
    readonly_fields = ["total_views", "total_conversions", "created_at", "updated_at"]


@admin.register(LandingPageTemplate)
class LandingPageTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "is_active", "sort_order"]
    list_filter = ["is_active", "category"]
    search_fields = ["name"]


@admin.register(FormSubmission)
class FormSubmissionAdmin(admin.ModelAdmin):
    list_display = ["landing_page", "block_id", "submitted_at"]
    list_filter = ["submitted_at"]
    raw_id_fields = ["landing_page"]
    readonly_fields = ["submitted_at"]
