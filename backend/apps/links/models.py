"""
Link models for TinlyLink.
Core URL shortening functionality.
"""

import re
import uuid
import hashlib
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.core.cache import cache
from django.db import models
from django.utils import timezone

import nanoid


def generate_short_code(n=8):
    """Generate a unique short code using nanoid."""
    # Use URL-safe characters, 8 chars gives us ~10^14 combinations
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    return nanoid.generate(alphabet, n)


class RetargetingPixel(models.Model):
    """
    Retargeting pixel for tracking link clicks across ad platforms.
    Can be attached to multiple links via M2M relationship.
    """

    PLATFORM_CHOICES = [
        ("facebook", "Facebook Pixel"),
        ("google", "Google Ads"),
        ("tiktok", "TikTok Pixel"),
        ("twitter", "Twitter/X Pixel"),
        ("linkedin", "LinkedIn Insight"),
        ("snapchat", "Snapchat Pixel"),
        ("pinterest", "Pinterest Tag"),
        ("custom", "Custom Script"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pixels"
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="pixels"
    )
    name = models.CharField(max_length=100)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    pixel_id = models.CharField(max_length=255)
    custom_script = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "retargeting_pixels"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.get_platform_display()})"


class CustomDomain(models.Model):
    """
    Custom domain for branded short links.
    """
    
    SSL_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("active", "Active"),
        ("failed", "Failed"),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="custom_domains"
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="custom_domains"
    )
    
    domain = models.CharField(max_length=255, unique=True, db_index=True)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    # DNS verification
    dns_txt_record = models.CharField(max_length=100, blank=True)
    
    # SSL status
    ssl_status = models.CharField(
        max_length=20,
        choices=SSL_STATUS_CHOICES,
        default="pending"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "custom_domains"
        ordering = ["-created_at"]
    
    def __str__(self):
        return self.domain
    
    def save(self, *args, **kwargs):
        # Generate DNS TXT record for verification
        if not self.dns_txt_record:
            self.dns_txt_record = f"tinlylink-verify={uuid.uuid4().hex[:16]}"
        super().save(*args, **kwargs)
    
    def verify_dns(self):
        """
        Check if DNS TXT record is properly configured.
        Should be called by a Celery task.
        """
        import dns.resolver
        
        try:
            answers = dns.resolver.resolve(self.domain, "TXT")
            for rdata in answers:
                txt_value = rdata.to_text().strip('"')
                if txt_value == self.dns_txt_record:
                    self.is_verified = True
                    self.verified_at = timezone.now()
                    self.save(update_fields=["is_verified", "verified_at"])
                    return True
        except Exception:
            pass
        
        return False


class Link(models.Model):
    """
    Shortened link model.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="links",
        null=True,
        blank=True  # Allow anonymous links
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="links"
    )
    
    # Domain (null = default domain)
    domain = models.ForeignKey(
        CustomDomain,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="links"
    )
    
    # Short code and URL
    short_code = models.CharField(max_length=50, db_index=True)
    original_url = models.URLField(max_length=2048)
    title = models.CharField(max_length=255, blank=True)
    
    # Campaign
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="links"
    )
    
    # UTM Parameters
    utm_source = models.CharField(max_length=100, blank=True)
    utm_medium = models.CharField(max_length=100, blank=True)
    utm_campaign = models.CharField(max_length=100, blank=True)
    utm_term = models.CharField(max_length=100, blank=True)
    utm_content = models.CharField(max_length=100, blank=True)
    
    # Protection
    password_hash = models.CharField(max_length=255, blank=True)
    
    # Retargeting pixels
    pixels = models.ManyToManyField(
        "RetargetingPixel",
        blank=True,
        related_name="links"
    )

    # Expiration
    expires_at = models.DateTimeField(null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True, db_index=True)
    
    # Denormalized counters (updated periodically from Redis)
    total_clicks = models.BigIntegerField(default=0)
    unique_clicks = models.BigIntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "links"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["domain", "short_code"],
                name="unique_domain_short_code"
            )
        ]
        indexes = [
            models.Index(fields=["short_code"]),
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["is_active", "domain", "short_code"]),
        ]
    
    def __str__(self):
        return f"{self.short_url} -> {self.original_url[:50]}"
    
    def save(self, *args, **kwargs):
        # Generate short code if not set
        if not self.short_code:
            self.short_code = generate_short_code()
            # Ensure uniqueness
            while Link.objects.filter(domain=self.domain, short_code=self.short_code).exists():
                self.short_code = generate_short_code()
        
        super().save(*args, **kwargs)
        
        # Invalidate cache
        self.invalidate_cache()
    
    def delete(self, *args, **kwargs):
        self.invalidate_cache()
        super().delete(*args, **kwargs)
    
    @property
    def short_url(self):
        """Get the full short URL."""
        domain = self.domain.domain if self.domain else settings.DEFAULT_SHORT_DOMAIN
        return f"https://{domain}/{self.short_code}"
    
    @property
    def is_expired(self):
        """Check if link is expired."""
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at
    
    @property
    def is_password_protected(self):
        """Check if link is password protected."""
        return bool(self.password_hash)
    
    @property
    def destination_url(self):
        """Get destination URL with UTM parameters appended."""
        if not any([self.utm_source, self.utm_medium, self.utm_campaign, self.utm_term, self.utm_content]):
            return self.original_url
        
        # Parse original URL
        parsed = urlparse(self.original_url)
        query_params = parse_qs(parsed.query)
        
        # Add UTM parameters
        if self.utm_source:
            query_params["utm_source"] = [self.utm_source]
        if self.utm_medium:
            query_params["utm_medium"] = [self.utm_medium]
        if self.utm_campaign:
            query_params["utm_campaign"] = [self.utm_campaign]
        if self.utm_term:
            query_params["utm_term"] = [self.utm_term]
        if self.utm_content:
            query_params["utm_content"] = [self.utm_content]
        
        # Rebuild URL
        new_query = urlencode(query_params, doseq=True)
        return urlunparse((
            parsed.scheme, parsed.netloc, parsed.path,
            parsed.params, new_query, parsed.fragment
        ))
    
    def set_password(self, password):
        """Set password for link protection."""
        self.password_hash = make_password(password)
    
    def check_password(self, password):
        """Check password against stored hash."""
        return check_password(password, self.password_hash)
    
    def get_cache_key(self):
        """Get Redis cache key for this link."""
        domain = self.domain.domain if self.domain else settings.DEFAULT_SHORT_DOMAIN
        return f"link:{domain}:{self.short_code}"
    
    def invalidate_cache(self):
        """Invalidate Redis cache for this link."""
        cache.delete(self.get_cache_key())
    
    def cache_data(self):
        """Get data to cache in Redis."""
        return {
            "id": str(self.id),
            "original_url": self.original_url,
            "destination_url": self.destination_url,
            "user_id": str(self.user_id) if self.user_id else None,
            "campaign_id": str(self.campaign_id) if self.campaign_id else None,
            "is_active": self.is_active,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_password_protected": bool(self.password_hash),  # Don't cache actual hash
            "show_ads": self._should_show_ads(),
        }
    
    def _should_show_ads(self):
        """Check if ads should be shown for this link."""
        if not self.user:
            return True
        subscription = getattr(self.user, "subscription", None)
        if not subscription:
            return True
        return subscription.should_show_ads()
    
    @classmethod
    def get_by_short_code(cls, domain, short_code):
        """
        Get link by domain and short code.
        Uses Redis cache for fast lookups.
        """
        cache_key = f"link:{domain}:{short_code}"
        
        # Try cache first
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        # Query database
        try:
            # Determine if using custom domain
            if domain == settings.DEFAULT_SHORT_DOMAIN:
                link = cls.objects.select_related("user__subscription").get(
                    domain__isnull=True,
                    short_code=short_code,
                )
            else:
                link = cls.objects.select_related("user__subscription", "domain").get(
                    domain__domain=domain,
                    short_code=short_code,
                )
            
            # Cache the result
            cache.set(cache_key, link.cache_data(), timeout=300)  # 5 minutes
            
            return link.cache_data()
            
        except cls.DoesNotExist:
            return None
    
    def increment_clicks(self):
        """
        Increment click counter in Redis.
        Actual DB update happens via Celery task.
        """
        cache_key = f"link:{self.id}:clicks"
        try:
            cache.incr(cache_key)
        except ValueError:
            cache.set(cache_key, 1, timeout=86400)  # 24 hours
    
    @classmethod
    def validate_url(cls, url):
        """
        Validate URL against blocked patterns.
        Returns (is_valid, error_message).
        """
        # Check URL format
        try:
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https"):
                return False, "URL must use http or https protocol"
            if not parsed.netloc:
                return False, "Invalid URL format"
        except Exception:
            return False, "Invalid URL format"
        
        # Check against blocked patterns
        for pattern in settings.BLOCKED_URL_PATTERNS:
            if re.search(pattern, url, re.IGNORECASE):
                return False, "This URL is not allowed"
        
        return True, None
    
    @classmethod
    def validate_slug(cls, slug, domain=None):
        """
        Validate custom slug.
        Returns (is_valid, error_message).
        """
        # Check format
        if not re.match(r"^[a-zA-Z0-9_-]{4,50}$", slug):
            return False, "Slug must be 4-50 characters and contain only letters, numbers, hyphens, and underscores"
        
        # Check reserved slugs
        if slug.lower() in settings.RESERVED_SLUGS:
            return False, "This slug is reserved"
        
        # Check availability
        if cls.objects.filter(domain=domain, short_code=slug).exists():
            return False, "This slug is already taken"
        
        return True, None
