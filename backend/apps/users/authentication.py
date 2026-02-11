"""
Custom authentication classes for TinlyLink.
JWT and API Key authentication.
"""

from django.utils import timezone
from rest_framework import authentication, exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication as BaseJWTAuthentication

from .models import APIKey


class JWTAuthentication(BaseJWTAuthentication):
    """
    Extended JWT authentication with additional validation.
    """
    
    def authenticate(self, request):
        """Authenticate the request and return a tuple of (user, token)."""
        result = super().authenticate(request)
        
        if result is not None:
            user, token = result
            
            # Check if user is active
            if not user.is_active:
                raise exceptions.AuthenticationFailed("User account is disabled.")
            
            # Update last activity (async would be better)
            # user.last_activity = timezone.now()
            # user.save(update_fields=['last_activity'])
        
        return result


class APIKeyAuthentication(authentication.BaseAuthentication):
    """
    API Key authentication for programmatic access.
    Expects header: Authorization: Bearer ls_live_xxxxx
    Or: X-API-Key: ls_live_xxxxx
    """
    
    keyword = "Bearer"
    
    def authenticate(self, request):
        """Authenticate using API key."""
        # Try Authorization header first
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        
        if auth_header.startswith(f"{self.keyword} ls_"):
            key = auth_header[len(self.keyword) + 1:]
        else:
            # Try X-API-Key header
            key = request.META.get("HTTP_X_API_KEY", "")
        
        if not key or not key.startswith("ls_"):
            return None
        
        # Validate key format
        if len(key) < 20:
            raise exceptions.AuthenticationFailed("Invalid API key format.")
        
        # Find API key by prefix
        prefix = key[:12]
        key_hash = APIKey.hash_key(key)
        
        try:
            api_key = APIKey.objects.select_related("user", "user__subscription").get(
                key_prefix=prefix,
                key_hash=key_hash,
            )
        except APIKey.DoesNotExist:
            raise exceptions.AuthenticationFailed("Invalid API key.")
        
        # Validate key
        if not api_key.is_valid():
            raise exceptions.AuthenticationFailed("API key is inactive or expired.")
        
        # Check user is active
        if not api_key.user.is_active:
            raise exceptions.AuthenticationFailed("User account is disabled.")
        
        # Check subscription allows API access
        subscription = getattr(api_key.user, "subscription", None)
        if not subscription or subscription.plan == "free":
            raise exceptions.AuthenticationFailed("API access requires a paid plan.")
        
        # Throttle usage recording: only update DB if >1 minute since last update
        if not api_key.last_used_at or (timezone.now() - api_key.last_used_at).total_seconds() > 60:
            api_key.record_usage()
        
        # Attach API key to request for scope checking
        request.api_key = api_key
        
        return (api_key.user, api_key)
    
    def authenticate_header(self, request):
        """Return authentication header for 401 responses."""
        return self.keyword
