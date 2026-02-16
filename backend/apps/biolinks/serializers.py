"""
Serializers for bio pages and landing pages.
"""

from rest_framework import serializers

from .models import BioPage, BioLink, LandingPage, LandingPageTemplate, FormSubmission


# =============================================================================
# BIO PAGES
# =============================================================================


class BioLinkSerializer(serializers.ModelSerializer):
    link_short_url = serializers.CharField(source="link.short_url", read_only=True, allow_null=True)

    class Meta:
        model = BioLink
        fields = [
            "id", "bio_page", "link", "link_short_url", "custom_url",
            "title", "description", "icon", "thumbnail_url",
            "position", "is_active", "total_clicks",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "bio_page", "total_clicks", "created_at", "updated_at"]


class CreateBioLinkSerializer(serializers.Serializer):
    link_id = serializers.UUIDField(required=False, allow_null=True)
    custom_url = serializers.URLField(max_length=2048, required=False, allow_blank=True)
    title = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    icon = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    thumbnail_url = serializers.URLField(max_length=500, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs.get("link_id") and not attrs.get("custom_url"):
            raise serializers.ValidationError("Either link_id or custom_url is required.")
        return attrs


class UpdateBioLinkSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=100, required=False)
    description = serializers.CharField(max_length=200, required=False, allow_blank=True)
    icon = serializers.CharField(max_length=50, required=False, allow_blank=True)
    thumbnail_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    custom_url = serializers.URLField(max_length=2048, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)


class BioPageSerializer(serializers.ModelSerializer):
    links_count = serializers.SerializerMethodField()
    public_url = serializers.CharField(read_only=True)

    class Meta:
        model = BioPage
        fields = [
            "id", "slug", "title", "bio", "avatar_url",
            "theme", "background_color", "text_color",
            "button_color", "button_text_color", "button_style",
            "social_links", "seo_title", "seo_description",
            "is_published", "total_views", "links_count", "public_url",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "total_views", "created_at", "updated_at"]

    def get_links_count(self, obj):
        if hasattr(obj, "annotated_links_count"):
            return obj.annotated_links_count
        return obj.links.count()


class CreateBioPageSerializer(serializers.Serializer):
    slug = serializers.SlugField(max_length=50)
    title = serializers.CharField(max_length=100)
    bio = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    avatar_url = serializers.URLField(max_length=500, required=False, allow_blank=True, default="")
    theme = serializers.ChoiceField(choices=BioPage.THEME_CHOICES, required=False, default="minimal")
    background_color = serializers.CharField(max_length=7, required=False, default="#ffffff")
    text_color = serializers.CharField(max_length=7, required=False, default="#111827")
    button_color = serializers.CharField(max_length=7, required=False, default="#f6821f")
    button_text_color = serializers.CharField(max_length=7, required=False, default="#ffffff")
    button_style = serializers.ChoiceField(
        choices=BioPage.BUTTON_STYLE_CHOICES, required=False, default="rounded"
    )
    social_links = serializers.JSONField(required=False, default=list)
    seo_title = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    seo_description = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")

    def validate_slug(self, value):
        if BioPage.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This slug is already taken.")
        return value


class UpdateBioPageSerializer(serializers.Serializer):
    slug = serializers.SlugField(max_length=50, required=False)
    title = serializers.CharField(max_length=100, required=False)
    bio = serializers.CharField(max_length=500, required=False, allow_blank=True)
    avatar_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    theme = serializers.ChoiceField(choices=BioPage.THEME_CHOICES, required=False)
    background_color = serializers.CharField(max_length=7, required=False)
    text_color = serializers.CharField(max_length=7, required=False)
    button_color = serializers.CharField(max_length=7, required=False)
    button_text_color = serializers.CharField(max_length=7, required=False)
    button_style = serializers.ChoiceField(choices=BioPage.BUTTON_STYLE_CHOICES, required=False)
    social_links = serializers.JSONField(required=False)
    seo_title = serializers.CharField(max_length=60, required=False, allow_blank=True)
    seo_description = serializers.CharField(max_length=160, required=False, allow_blank=True)
    is_published = serializers.BooleanField(required=False)

    def validate_slug(self, value):
        instance = self.context.get("instance")
        qs = BioPage.objects.filter(slug=value)
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError("This slug is already taken.")
        return value


# =============================================================================
# LANDING PAGES
# =============================================================================


class LandingPageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingPageTemplate
        fields = [
            "id", "name", "description", "category",
            "thumbnail_url", "blocks", "settings",
        ]


class FormSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormSubmission
        fields = ["id", "landing_page", "block_id", "data", "submitted_at"]
        read_only_fields = ["id", "submitted_at"]


class LandingPageSerializer(serializers.ModelSerializer):
    public_url = serializers.CharField(read_only=True)

    class Meta:
        model = LandingPage
        fields = [
            "id", "slug", "title", "blocks", "settings",
            "seo_title", "seo_description", "og_image_url",
            "template", "is_published",
            "total_views", "total_conversions", "public_url",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "total_views", "total_conversions",
            "created_at", "updated_at",
        ]


class CreateLandingPageSerializer(serializers.Serializer):
    slug = serializers.SlugField(max_length=50)
    title = serializers.CharField(max_length=200)
    blocks = serializers.JSONField(required=False, default=list)
    settings = serializers.JSONField(required=False, default=dict)
    template_id = serializers.UUIDField(required=False, allow_null=True)
    seo_title = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    seo_description = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")

    def validate_slug(self, value):
        if LandingPage.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This slug is already taken.")
        return value


class UpdateLandingPageSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False)
    slug = serializers.SlugField(max_length=50, required=False)
    blocks = serializers.JSONField(required=False)
    settings = serializers.JSONField(required=False)
    seo_title = serializers.CharField(max_length=60, required=False, allow_blank=True)
    seo_description = serializers.CharField(max_length=160, required=False, allow_blank=True)
    og_image_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    is_published = serializers.BooleanField(required=False)

    def validate_slug(self, value):
        instance = self.context.get("instance")
        qs = LandingPage.objects.filter(slug=value)
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError("This slug is already taken.")
        return value
