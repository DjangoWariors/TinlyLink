"""
Models for bio pages and landing pages.
"""

import uuid

from django.conf import settings
from django.db import models


# =============================================================================
# BIO PAGES
# =============================================================================


class BioPage(models.Model):
    """Link-in-bio page. Renders at /@slug."""

    THEME_CHOICES = [
        ("minimal", "Minimal"),
        ("dark", "Dark"),
        ("colorful", "Colorful"),
        ("gradient", "Gradient"),
        ("professional", "Professional"),
    ]

    BUTTON_STYLE_CHOICES = [
        ("rounded", "Rounded"),
        ("square", "Square"),
        ("pill", "Pill"),
        ("outline", "Outline"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bio_pages",
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="bio_pages",
    )

    slug = models.SlugField(max_length=50, unique=True)
    title = models.CharField(max_length=100)
    bio = models.TextField(max_length=500, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True)

    # Theme
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default="minimal")
    background_color = models.CharField(max_length=7, default="#ffffff")
    text_color = models.CharField(max_length=7, default="#111827")
    button_color = models.CharField(max_length=7, default="#f6821f")
    button_text_color = models.CharField(max_length=7, default="#ffffff")
    button_style = models.CharField(
        max_length=20, choices=BUTTON_STYLE_CHOICES, default="rounded"
    )

    # Social links stored as JSON: [{"platform": "twitter", "url": "..."}]
    social_links = models.JSONField(default=list, blank=True)

    # SEO
    seo_title = models.CharField(max_length=60, blank=True)
    seo_description = models.CharField(max_length=160, blank=True)

    is_published = models.BooleanField(default=False)
    total_views = models.BigIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bio_pages"
        ordering = ["-created_at"]

    def __str__(self):
        return f"@{self.slug} — {self.title}"

    @property
    def public_url(self):
        return f"https://{settings.DEFAULT_SHORT_DOMAIN}/@{self.slug}"


class BioLink(models.Model):
    """A single link entry on a bio page."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bio_page = models.ForeignKey(
        BioPage, on_delete=models.CASCADE, related_name="links"
    )

    # Can reference an existing TinlyLink or a custom URL
    link = models.ForeignKey(
        "links.Link",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bio_links",
    )
    custom_url = models.URLField(max_length=2048, blank=True)

    title = models.CharField(max_length=100)
    description = models.CharField(max_length=200, blank=True)
    icon = models.CharField(max_length=50, blank=True)
    thumbnail_url = models.URLField(max_length=500, blank=True)
    position = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    total_clicks = models.BigIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bio_links"
        ordering = ["position", "created_at"]

    def __str__(self):
        return self.title

    @property
    def destination_url(self):
        if self.link:
            return self.link.short_url
        return self.custom_url


# =============================================================================
# LANDING PAGES
# =============================================================================


class LandingPageTemplate(models.Model):
    """Pre-built landing page template."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=50, blank=True)
    thumbnail_url = models.URLField(max_length=500, blank=True)
    blocks = models.JSONField(default=list)
    settings = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "landing_page_templates"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class LandingPage(models.Model):
    """Block-based landing page."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="landing_pages",
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="landing_pages",
    )

    slug = models.SlugField(max_length=50, unique=True)
    title = models.CharField(max_length=200)

    # Block-based content: [{id, type, content, settings}, ...]
    blocks = models.JSONField(default=list)
    # Global settings: fonts, colors, custom CSS
    settings = models.JSONField(default=dict)

    # SEO
    seo_title = models.CharField(max_length=60, blank=True)
    seo_description = models.CharField(max_length=160, blank=True)
    og_image_url = models.URLField(max_length=500, blank=True)

    template = models.ForeignKey(
        LandingPageTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    is_published = models.BooleanField(default=False)
    total_views = models.BigIntegerField(default=0)
    total_conversions = models.BigIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "landing_pages"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def public_url(self):
        return f"https://{settings.DEFAULT_SHORT_DOMAIN}/p/{self.slug}"


class FormSubmission(models.Model):
    """Submission from a landing page form block."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    landing_page = models.ForeignKey(
        LandingPage, on_delete=models.CASCADE, related_name="submissions"
    )
    block_id = models.CharField(max_length=100)
    data = models.JSONField(default=dict)
    ip_hash = models.CharField(max_length=64, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "form_submissions"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"Submission for {self.landing_page.title}"
