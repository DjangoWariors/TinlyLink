"""
Serializers for user authentication and account management.
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Subscription, APIKey, UsageTracking


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    
    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "company", "avatar_url",
            "email_verified", "created_at", "initials", "display_name"
        ]
        read_only_fields = ["id", "email_verified", "created_at", "initials", "display_name"]


class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for Subscription model."""
    
    limits = serializers.SerializerMethodField()
    
    class Meta:
        model = Subscription
        fields = [
            "plan", "status", "current_period_start", "current_period_end",
            "cancel_at_period_end", "is_paid", "limits"
        ]
        read_only_fields = fields
    
    def get_limits(self, obj):
        """Get plan limits."""
        return obj.limits


class UsageSerializer(serializers.ModelSerializer):
    """Serializer for usage tracking."""
    
    class Meta:
        model = UsageTracking
        fields = ["period_start", "period_end", "links_created", "qr_codes_created", "api_calls"]


class RegisterSerializer(serializers.Serializer):
    """Serializer for user registration."""
    
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    
    def validate_email(self, value):
        """Check if email is already registered."""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()
    
    def validate_password(self, value):
        """Validate password strength."""
        validate_password(value)
        return value
    
    def create(self, validated_data):
        """Create new user."""
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data.get("full_name", ""),
        )
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for user login."""
    
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, attrs):
        """Validate credentials."""
        email = attrs.get("email", "").lower()
        password = attrs.get("password", "")
        
        user = authenticate(username=email, password=password)
        
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        
        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")
        
        attrs["user"] = user
        return attrs


class TokenSerializer(serializers.Serializer):
    """Serializer for token response."""
    
    access_token = serializers.CharField()
    refresh_token = serializers.CharField()
    user = UserSerializer()
    subscription = SubscriptionSerializer()


class RefreshTokenSerializer(serializers.Serializer):
    """Serializer for token refresh."""
    
    refresh_token = serializers.CharField()
    
    def validate_refresh_token(self, value):
        """Validate refresh token."""
        try:
            RefreshToken(value)
        except Exception:
            raise serializers.ValidationError("Invalid or expired refresh token.")
        return value


class ForgotPasswordSerializer(serializers.Serializer):
    """Serializer for forgot password request."""
    
    email = serializers.EmailField()
    
    def validate_email(self, value):
        """Check if email exists."""
        try:
            self.user = User.objects.get(email__iexact=value)
        except User.DoesNotExist:
            # Don't reveal if email exists
            pass
        return value.lower()


class ResetPasswordSerializer(serializers.Serializer):
    """Serializer for password reset."""
    
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    
    def validate_password(self, value):
        """Validate password strength."""
        validate_password(value)
        return value


class VerifyEmailSerializer(serializers.Serializer):
    """Serializer for email verification."""
    
    token = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change."""
    
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    
    def validate_new_password(self, value):
        """Validate password strength."""
        validate_password(value)
        return value
    
    def validate_current_password(self, value):
        """Check current password is correct."""
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class UpdateProfileSerializer(serializers.ModelSerializer):
    """Serializer for profile updates."""
    
    class Meta:
        model = User
        fields = ["full_name", "company", "avatar_url"]


class APIKeySerializer(serializers.ModelSerializer):
    """Serializer for API Key."""
    
    class Meta:
        model = APIKey
        fields = [
            "id", "name", "key_prefix", "scopes", "rate_limit_per_minute",
            "last_used_at", "total_requests", "is_active", "expires_at", "created_at"
        ]
        read_only_fields = [
            "id", "key_prefix", "last_used_at", "total_requests", "created_at"
        ]


class CreateAPIKeySerializer(serializers.Serializer):
    """Serializer for creating API key."""
    
    name = serializers.CharField(max_length=100)
    scopes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=["links:read", "links:write"]
    )
    
    def validate_scopes(self, value):
        """Validate scopes."""
        valid_scopes = [
            "links:read", "links:write", "links:delete",
            "qr:read", "qr:write", "qr:delete",
            "analytics:read", "campaigns:read", "campaigns:write",
        ]
        for scope in value:
            if scope not in valid_scopes and scope != "*":
                raise serializers.ValidationError(f"Invalid scope: {scope}")
        return value


class APIKeyResponseSerializer(serializers.Serializer):
    """Serializer for API key creation response (includes unhashed key)."""
    
    api_key = APIKeySerializer()
    key = serializers.CharField()  # Only shown once


class UserWithSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for user with subscription details."""
    
    subscription = SubscriptionSerializer()
    usage = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "company", "avatar_url",
            "email_verified", "created_at", "initials", "display_name",
            "subscription", "usage"
        ]
        read_only_fields = fields
    
    def get_usage(self, obj):
        """Get current usage."""
        usage = UsageTracking.get_current_period(obj)
        return UsageSerializer(usage).data


class DeleteAccountSerializer(serializers.Serializer):
    """Serializer for account deletion."""
    
    password = serializers.CharField(write_only=True)
    
    def validate_password(self, value):
        """Verify password."""
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Password is incorrect.")
        return value
