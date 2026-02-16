"""
User models for TinlyLink.
Custom User model with UUID primary key and subscription support.
"""

import uuid
import hashlib
import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.conf import settings

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model with UUID primary key.
    Email is the unique identifier for authentication.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255, db_index=True)
    full_name = models.CharField(max_length=100, blank=True)
    company = models.CharField(max_length=100, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True)
    
    # Email verification
    email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    email_verification_token = models.CharField(max_length=100, blank=True)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Password reset
    password_reset_token = models.CharField(max_length=100, blank=True)
    password_reset_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    # Timestamps
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Deletion
    deletion_scheduled_at = models.DateTimeField(null=True, blank=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = "users"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["created_at"]),
        ]
    
    def __str__(self):
        return self.email
    
    @property
    def first_name(self):
        """Get first name from full_name."""
        return self.full_name.split()[0] if self.full_name else ""
    
    @property
    def last_name(self):
        """Get last name from full_name."""
        parts = self.full_name.split()
        return " ".join(parts[1:]) if len(parts) > 1 else ""
    
    @property
    def display_name(self):
        """Get display name (full name or email prefix)."""
        return self.full_name or self.email.split("@")[0]
    
    @property
    def initials(self):
        """Get user initials for avatar."""
        if self.full_name:
            parts = self.full_name.split()
            return "".join(p[0].upper() for p in parts[:2])
        return self.email[0].upper()
    
    def generate_verification_token(self):
        """Generate email verification token."""
        self.email_verification_token = secrets.token_urlsafe(32)
        self.email_verification_sent_at = timezone.now()
        self.save(update_fields=["email_verification_token", "email_verification_sent_at"])
        return self.email_verification_token
    
    def verify_email(self, token):
        """Verify email with token."""
        if self.email_verification_token != token:
            return False
        if self.email_verification_sent_at:
            expiry = self.email_verification_sent_at + timedelta(hours=24)
            if timezone.now() > expiry:
                return False
        self.email_verified = True
        self.email_verified_at = timezone.now()
        self.email_verification_token = ""
        self.save(update_fields=["email_verified", "email_verified_at", "email_verification_token"])
        return True
    
    def generate_password_reset_token(self):
        """Generate password reset token."""
        self.password_reset_token = secrets.token_urlsafe(32)
        self.password_reset_sent_at = timezone.now()
        self.save(update_fields=["password_reset_token", "password_reset_sent_at"])
        return self.password_reset_token
    
    def reset_password(self, token, new_password):
        """Reset password with token."""
        if self.password_reset_token != token:
            return False
        if self.password_reset_sent_at:
            expiry = self.password_reset_sent_at + timedelta(hours=1)
            if timezone.now() > expiry:
                return False
        self.set_password(new_password)
        self.password_reset_token = ""
        self.save(update_fields=["password", "password_reset_token"])
        return True


class Subscription(models.Model):
    """
    User subscription model for plan management.
    """
    
    PLAN_CHOICES = [
        ("free", "Free"),
        ("pro", "Pro"),
        ("business", "Business"),
        ("enterprise", "Enterprise"),
    ]
    
    STATUS_CHOICES = [
        ("active", "Active"),
        ("canceled", "Canceled"),
        ("past_due", "Past Due"),
        ("trialing", "Trialing"),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="subscription")
    
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default="free", db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    
    # Stripe
    stripe_customer_id = models.CharField(max_length=100, blank=True, db_index=True)
    stripe_subscription_id = models.CharField(max_length=100, blank=True, db_index=True)
    
    # Billing period
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "subscriptions"
    
    def __str__(self):
        return f"{self.user.email} - {self.plan}"
    
    @property
    def is_paid(self):
        """Check if user has a paid plan."""
        return self.plan in ("pro", "business", "enterprise") and self.status == "active"
    
    @property
    def limits(self):
        """Get plan limits from DB (cached), with settings fallback."""
        from apps.billing.models import Plan
        return Plan.get_limits(self.plan)
    
    def can_create_link(self, current_count):
        """Check if user can create another link."""
        limit = self.limits["links_per_month"]
        return current_count < limit

    def can_create_qr(self, current_count):
        """Check if user can create another QR code."""
        limit = self.limits["qr_codes_per_month"]
        return current_count < limit
    
    def can_use_custom_slug(self):
        """Check if user can use custom slugs."""
        return self.limits["custom_slugs"]
    
    def can_use_password_protection(self):
        """Check if user can use password protection."""
        return self.limits["password_protection"]
    
    def should_show_ads(self):
        """Check if ads should be shown."""
        return self.limits["show_ads"]

    def can_add_team_member(self, current_count):
        """Check if team can add another member."""
        limit = self.limits.get("team_members", 0)
        return current_count < limit

    @property
    def can_create_team(self):
        """Check if user can create teams."""
        return self.limits.get("team_members", 0) > 0


class APIKey(models.Model):
    """
    API Key model for programmatic access.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="api_keys")
    
    name = models.CharField(max_length=100)
    key_prefix = models.CharField(max_length=12, db_index=True)  # ls_live_
    key_hash = models.CharField(max_length=64)  # SHA-256 hash
    
    # Permissions
    scopes = models.JSONField(default=list)  # ['links:read', 'links:write']
    
    # Rate limiting
    rate_limit_per_minute = models.IntegerField(default=60)
    
    # Usage tracking
    last_used_at = models.DateTimeField(null=True, blank=True)
    total_requests = models.BigIntegerField(default=0)
    
    # Status
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = "api_keys"
        ordering = ["-created_at"]
    
    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"
    
    @classmethod
    def generate_key(cls):
        """Generate a new API key."""
        key = f"ls_live_{secrets.token_urlsafe(24)}"
        return key
    
    @classmethod
    def hash_key(cls, key):
        """Hash an API key."""
        return hashlib.sha256(key.encode()).hexdigest()
    
    @classmethod
    def create_for_user(cls, user, name, scopes=None):
        """Create a new API key for a user."""
        key = cls.generate_key()
        prefix = key[:12]
        key_hash = cls.hash_key(key)
        
        api_key = cls.objects.create(
            user=user,
            name=name,
            key_prefix=prefix,
            key_hash=key_hash,
            scopes=scopes or ["links:read", "links:write"],
        )
        
        # Return the unhashed key (only shown once)
        return api_key, key
    
    def verify_key(self, key):
        """Verify an API key."""
        return self.key_hash == self.hash_key(key)
    
    def record_usage(self):
        """Record API key usage."""
        self.last_used_at = timezone.now()
        self.total_requests += 1
        self.save(update_fields=["last_used_at", "total_requests"])
    
    def is_valid(self):
        """Check if API key is valid."""
        if not self.is_active:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return True
    
    def has_scope(self, scope):
        """Check if API key has a specific scope."""
        return scope in self.scopes or "*" in self.scopes


class UsageTracking(models.Model):
    """
    Monthly usage tracking per user.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="usage_records")
    
    period_start = models.DateField(db_index=True)
    period_end = models.DateField()
    
    links_created = models.IntegerField(default=0)
    qr_codes_created = models.IntegerField(default=0)
    api_calls = models.IntegerField(default=0)
    
    class Meta:
        db_table = "usage_tracking"
        unique_together = ["user", "period_start"]
        ordering = ["-period_start"]
    
    def __str__(self):
        return f"{self.user.email} - {self.period_start}"
    
    @classmethod
    def get_current_period(cls, user):
        """Get or create usage tracking for current period."""
        today = timezone.now().date()
        period_start = today.replace(day=1)
        
        # Calculate period end (last day of month)
        if period_start.month == 12:
            period_end = period_start.replace(year=period_start.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            period_end = period_start.replace(month=period_start.month + 1, day=1) - timedelta(days=1)
        
        usage, _ = cls.objects.get_or_create(
            user=user,
            period_start=period_start,
            defaults={"period_end": period_end}
        )
        return usage
    
    def increment_links(self):
        """Atomically increment link count and trigger usage warning at 80%."""
        from django.db.models import F
        type(self).objects.filter(pk=self.pk).update(links_created=F("links_created") + 1)
        self.refresh_from_db(fields=["links_created"])
        self._check_usage_warning("links", self.links_created, "links_per_month")

    def increment_qr_codes(self):
        """Atomically increment QR code count and trigger usage warning at 80%."""
        from django.db.models import F
        type(self).objects.filter(pk=self.pk).update(qr_codes_created=F("qr_codes_created") + 1)
        self.refresh_from_db(fields=["qr_codes_created"])
        self._check_usage_warning("QR codes", self.qr_codes_created, "qr_codes_per_month")

    def increment_api_calls(self):
        """Atomically increment API call count."""
        from django.db.models import F
        type(self).objects.filter(pk=self.pk).update(api_calls=F("api_calls") + 1)
        self.refresh_from_db(fields=["api_calls"])

    def _check_usage_warning(self, resource, current, limit_key):
        """Send a warning email when usage reaches 80% of plan limit."""
        from django.conf import settings as app_settings
        subscription = getattr(self.user, "subscription", None)
        plan = subscription.plan if subscription else "free"
        limit = app_settings.PLAN_LIMITS.get(plan, {}).get(limit_key, 0)
        if limit and current == int(limit * 0.8):
            from apps.users.tasks import send_usage_warning_email
            percent = int(current / limit * 100)
            send_usage_warning_email.delay(str(self.user_id), resource, percent)


# =============================================================================
# NEW MODELS FOR MISSING FEATURES
# =============================================================================

class NotificationSettings(models.Model):
    """User notification preferences."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="notification_settings")
    
    weekly_report = models.BooleanField(default=True)
    usage_warning = models.BooleanField(default=True)
    link_alerts = models.BooleanField(default=True)
    security_alerts = models.BooleanField(default=True)
    marketing = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "notification_settings"
    
    def __str__(self):
        return f"Notifications for {self.user.email}"


class Integration(models.Model):
    """Connected third-party integrations."""
    
    PROVIDER_CHOICES = [
        ("zapier", "Zapier"),
        ("slack", "Slack"),
        ("google_analytics", "Google Analytics"),
        ("webhook", "Webhook"),
    ]
    
    STATUS_CHOICES = [
        ("connected", "Connected"),
        ("disconnected", "Disconnected"),
        ("error", "Error"),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="integrations")
    
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="disconnected")
    
    # OAuth tokens / credentials (encrypted in production)
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    webhook_url = models.URLField(max_length=500, blank=True)
    
    # Settings
    settings = models.JSONField(default=dict)
    
    # Timestamps
    connected_at = models.DateTimeField(null=True, blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "integrations"
        unique_together = ["user", "provider"]
    
    def __str__(self):
        return f"{self.user.email} - {self.provider}"
    
    def connect(self, access_token=None, refresh_token=None, webhook_url=None):
        """Mark integration as connected."""
        self.status = "connected"
        self.connected_at = timezone.now()
        if access_token:
            self.access_token = access_token
        if refresh_token:
            self.refresh_token = refresh_token
        if webhook_url:
            self.webhook_url = webhook_url
        self.save()
    
    def disconnect(self):
        """Disconnect integration."""
        self.status = "disconnected"
        self.access_token = ""
        self.refresh_token = ""
        self.webhook_url = ""
        self.save()


class UserSession(models.Model):
    """Track active user sessions."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    
    session_key = models.CharField(max_length=100, unique=True)
    device_type = models.CharField(max_length=50, blank=True)  # desktop, mobile, tablet
    browser = models.CharField(max_length=100, blank=True)
    os = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    location = models.CharField(max_length=100, blank=True)
    
    is_current = models.BooleanField(default=False)
    last_active = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = "user_sessions"
        ordering = ["-last_active"]
    
    def __str__(self):
        return f"{self.user.email} - {self.device_type}"
    
    def revoke(self):
        """Revoke this session."""
        self.delete()


class ExportJob(models.Model):
    """Track async export jobs."""
    
    TYPE_CHOICES = [
        ("links", "Links"),
        ("analytics", "Analytics"),
        ("all", "All Data"),
    ]
    
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="export_jobs")
    
    export_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    
    # Result
    file_url = models.URLField(max_length=500, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    # Timestamps
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = "export_jobs"
        ordering = ["-created_at"]
    
    def __str__(self):
        return f"{self.user.email} - {self.export_type} - {self.status}"
