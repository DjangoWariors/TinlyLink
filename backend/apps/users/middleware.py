"""
Custom middleware for TinlyLink.
Rate limiting and request logging.
"""

import time
import hashlib
import logging

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse

logger = logging.getLogger(__name__)


class RateLimitMiddleware:
    """
    Redis-based rate limiting middleware using token bucket algorithm.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Skip rate limiting for certain paths
        if self._should_skip(request):
            return self.get_response(request)
        
        # Get rate limit key and config
        limit_key, limit_config = self._get_rate_limit(request)
        
        if limit_key and limit_config:
            allowed, remaining, reset_time = self._check_rate_limit(limit_key, limit_config)
            
            if not allowed:
                return JsonResponse({
                    "error": "Rate limit exceeded",
                    "retry_after": reset_time - int(time.time()),
                }, status=429, headers={
                    "X-RateLimit-Limit": str(limit_config["limit"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_time),
                    "Retry-After": str(reset_time - int(time.time())),
                })
            
            # Add rate limit headers to response
            response = self.get_response(request)
            response["X-RateLimit-Limit"] = str(limit_config["limit"])
            response["X-RateLimit-Remaining"] = str(remaining)
            response["X-RateLimit-Reset"] = str(reset_time)
            return response
        
        return self.get_response(request)
    
    def _should_skip(self, request):
        """Check if rate limiting should be skipped."""
        # Skip for static files
        if request.path.startswith(("/static/", "/media/", "/admin/")):
            return True
        
        # Skip for health checks
        if request.path in ("/health/", "/ready/"):
            return True
        
        return False
    
    def _get_rate_limit(self, request):
        """Determine rate limit based on endpoint and user."""
        path = request.path
        user = request.user if hasattr(request, "user") and request.user.is_authenticated else None
        
        # Login endpoint
        if path == "/api/v1/auth/login/" and request.method == "POST":
            ip = self._get_client_ip(request)
            return f"rate:login:{ip}", {"limit": 5, "window": 900}  # 5 per 15 min
        
        # Password reset
        if path == "/api/v1/auth/forgot-password/" and request.method == "POST":
            ip = self._get_client_ip(request)
            return f"rate:password_reset:{ip}", {"limit": 3, "window": 3600}
        
        # Anonymous link shortening
        if path == "/api/v1/links/" and request.method == "POST" and not user:
            ip = self._get_client_ip(request)
            return f"rate:anon_shorten:{ip}", {"limit": 5, "window": 3600}

        # Public link creation endpoint (AllowAny)
        if path == "/api/v1/links/public/" and request.method == "POST":
            ip = self._get_client_ip(request)
            return f"rate:public_link:{ip}", {"limit": 10, "window": 3600}  # 10 per hour

        # Public verification endpoint
        if path == "/api/v1/verify/" and request.method == "POST":
            ip = self._get_client_ip(request)
            return f"rate:verify:{ip}", {"limit": 30, "window": 60}  # 30 per minute

        # Authenticated requests - based on plan
        if user:
            subscription = getattr(user, "subscription", None)
            plan = subscription.plan if subscription else "free"

            if path.startswith("/api/"):
                rate_key = f"{plan}_api"
                rate_config = self._parse_rate_limit(settings.RATE_LIMITS.get(rate_key, "60/minute"))
                if rate_config is None:  # unlimited
                    return None, None
                return f"rate:{rate_key}:{user.id}", rate_config
        
        # Default: No rate limit
        return None, None
    
    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR", "")

        # Hash IP for privacy
        return hashlib.sha256(ip.encode()).hexdigest()[:16]

    def _parse_rate_limit(self, rate_string):
        """
        Parse rate limit string like '60/minute' into config dict.
        Returns None for 'unlimited'.
        """
        if rate_string == "unlimited":
            return None

        try:
            limit_str, period = rate_string.split("/")
            limit = int(limit_str)

            # Convert period to seconds
            period_map = {
                "second": 1,
                "minute": 60,
                "hour": 3600,
                "day": 86400,
            }
            # Handle periods like "15minutes"
            for unit, seconds in period_map.items():
                if period.endswith(unit):
                    multiplier = period[:-len(unit)] or "1"
                    window = int(multiplier) * seconds if multiplier.isdigit() else seconds
                    return {"limit": limit, "window": window}
                elif period.endswith(unit + "s"):
                    multiplier = period[:-len(unit)-1] or "1"
                    window = int(multiplier) * seconds if multiplier.isdigit() else seconds
                    return {"limit": limit, "window": window}

            # Default to minute if unknown
            return {"limit": limit, "window": 60}
        except (ValueError, AttributeError):
            return {"limit": 60, "window": 60}

    def _check_rate_limit(self, key, config):
        """
        Check rate limit using sliding window counter.
        Returns (allowed, remaining, reset_time).
        """
        limit = config["limit"]
        window = config["window"]
        
        now = int(time.time())
        window_start = now - (now % window)
        reset_time = window_start + window
        
        cache_key = f"{key}:{window_start}"
        
        # Get current count
        current = cache.get(cache_key, 0)
        
        if current >= limit:
            return False, 0, reset_time
        
        # Increment counter
        try:
            cache.incr(cache_key)
        except ValueError:
            cache.set(cache_key, 1, timeout=window)
        
        remaining = max(0, limit - current - 1)
        return True, remaining, reset_time


class RequestLoggingMiddleware:
    """
    Middleware to log all API requests.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Skip logging for certain paths
        if request.path.startswith(("/static/", "/media/", "/health/")):
            return self.get_response(request)
        
        # Add request ID
        import uuid
        request.request_id = str(uuid.uuid4())[:8]
        
        start_time = time.time()
        
        response = self.get_response(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log request
        logger.info(
            "api_request",
            extra={
                "request_id": request.request_id,
                "method": request.method,
                "path": request.path,
                "status": response.status_code,
                "duration_ms": int(duration * 1000),
                "user_id": str(request.user.id) if hasattr(request, "user") and request.user.is_authenticated else None,
            }
        )
        
        # Add request ID to response
        response["X-Request-ID"] = request.request_id
        
        return response


class SecurityHeadersMiddleware:
    """
    Add security headers to all responses.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Security headers
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "DENY"
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # HSTS is handled by Django settings in production
        
        return response


class SessionTrackingMiddleware:
    """
    Track user session activity and validate session existence.
    - Updates last_active timestamp on authenticated requests
    - Rejects requests if user's session was revoked
    Uses throttling to avoid excessive DB writes.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Skip session check for certain paths
        if request.path.startswith(("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh", "/admin", "/static", "/health")):
            return self.get_response(request)
        
        # For authenticated users, verify their session exists
        if hasattr(request, "user") and request.user.is_authenticated:
            if not self._has_valid_session(request.user):
                from django.http import JsonResponse
                return JsonResponse(
                    {"error": "Session expired or revoked. Please log in again."},
                    status=401
                )
        
        response = self.get_response(request)
        
        # Update session activity after successful request
        if hasattr(request, "user") and request.user.is_authenticated:
            self._update_session(request.user)
        
        return response
    
    def _has_valid_session(self, user):
        """
        Check if user has at least one active session.
        Uses cache to avoid checking on every request.
        """
        from .models import UserSession
        from django.core.cache import cache
        
        # Check cache first (valid for 30 seconds)
        cache_key = f"session_valid:{user.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        
        # Check database
        has_session = UserSession.objects.filter(user=user).exists()
        
        # Cache result for 30 seconds
        cache.set(cache_key, has_session, timeout=30)
        
        return has_session
    
    def _update_session(self, user):
        """
        Update the current session's last_active timestamp.
        Only updates if more than 5 minutes have passed.
        """
        from .models import UserSession
        from django.utils import timezone
        from datetime import timedelta
        from django.core.cache import cache
        
        # Throttle updates to once every 5 minutes per user
        cache_key = f"session_update:{user.id}"
        if cache.get(cache_key):
            return  # Recently updated, skip
        
        try:
            # Find and update current session
            session = UserSession.objects.filter(
                user=user, 
                is_current=True
            ).first()
            
            if session:
                session.last_active = timezone.now()
                session.save(update_fields=["last_active"])
            
            # Set cache to throttle updates (5 minutes)
            cache.set(cache_key, True, timeout=300)
        except Exception:
            pass  # Don't break request on session errors

