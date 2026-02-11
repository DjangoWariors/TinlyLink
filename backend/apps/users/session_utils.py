"""
Session management utilities for TinlyLink.
Handles User-Agent parsing, session creation, and tracking.
"""

import secrets
from typing import Optional, Dict, Any
from django.utils import timezone
from user_agents import parse as parse_user_agent


def get_client_ip(request) -> Optional[str]:
    """
    Extract client IP address from request.
    Handles X-Forwarded-For header for proxied requests.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # Take the first IP in the chain (original client)
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def parse_request_device_info(request) -> Dict[str, Any]:
    """
    Parse User-Agent header to extract device information.
    
    Returns:
        dict with keys: device_type, browser, os
    """
    user_agent_string = request.META.get('HTTP_USER_AGENT', '')
    
    if not user_agent_string:
        return {
            'device_type': 'Unknown',
            'browser': 'Unknown',
            'os': 'Unknown',
        }
    
    user_agent = parse_user_agent(user_agent_string)
    
    # Determine device type
    if user_agent.is_mobile:
        device_type = 'Mobile'
    elif user_agent.is_tablet:
        device_type = 'Tablet'
    elif user_agent.is_pc:
        device_type = 'Desktop'
    elif user_agent.is_bot:
        device_type = 'Bot'
    else:
        device_type = 'Unknown'
    
    # Get browser info
    browser = user_agent.browser.family
    if user_agent.browser.version_string:
        browser = f"{browser} {user_agent.browser.version_string}"
    
    # Get OS info
    os = user_agent.os.family
    if user_agent.os.version_string:
        os = f"{os} {user_agent.os.version_string}"
    
    return {
        'device_type': device_type,
        'browser': browser or 'Unknown',
        'os': os or 'Unknown',
    }


def generate_session_key() -> str:
    """Generate a unique session key."""
    return secrets.token_urlsafe(32)


def create_session_for_user(user, request, is_current: bool = True):
    """
    Create a new UserSession for the given user.
    
    Args:
        user: The User instance
        request: The HTTP request
        is_current: Whether this is the current active session
    
    Returns:
        The created UserSession instance
    """
    from .models import UserSession
    
    device_info = parse_request_device_info(request)
    ip_address = get_client_ip(request)
    
    # Mark all other sessions as not current
    if is_current:
        UserSession.objects.filter(user=user, is_current=True).update(is_current=False)
    
    session = UserSession.objects.create(
        user=user,
        session_key=generate_session_key(),
        device_type=device_info['device_type'],
        browser=device_info['browser'],
        os=device_info['os'],
        ip_address=ip_address,
        location='',  # Could be enriched with GeoIP later
        is_current=is_current,
    )
    
    return session


def update_session_activity(session):
    """
    Update the last_active timestamp of a session.
    Only updates if more than 5 minutes have passed to reduce DB writes.
    """
    from django.utils import timezone
    from datetime import timedelta
    
    # Only update if last_active is more than 5 minutes old
    threshold = timezone.now() - timedelta(minutes=5)
    if session.last_active < threshold:
        session.last_active = timezone.now()
        session.save(update_fields=['last_active'])


def delete_session_for_user(user, session_key: Optional[str] = None):
    """
    Delete session(s) for a user.
    
    Args:
        user: The User instance
        session_key: If provided, delete specific session; otherwise delete current session
    """
    from .models import UserSession
    
    if session_key:
        UserSession.objects.filter(user=user, session_key=session_key).delete()
    else:
        UserSession.objects.filter(user=user, is_current=True).delete()


def revoke_all_other_sessions(user) -> int:
    """
    Revoke all sessions except the current one.
    Also invalidates session cache for affected sessions.
    
    Returns:
        Number of sessions revoked
    """
    from .models import UserSession
    from django.core.cache import cache
    
    # Get sessions to be revoked (for cache invalidation)
    sessions_to_revoke = UserSession.objects.filter(user=user, is_current=False)
    count = sessions_to_revoke.count()
    
    if count > 0:
        # Delete the sessions
        sessions_to_revoke.delete()
        
        # Invalidate session valid cache for this user
        # This forces the middleware to re-check the database
        cache.delete(f"session_valid:{user.id}")
    
    return count


def cleanup_expired_sessions(days: int = 30) -> int:
    """
    Delete sessions inactive for more than the specified days.
    
    Returns:
        Number of sessions deleted
    """
    from .models import UserSession
    from datetime import timedelta
    
    threshold = timezone.now() - timedelta(days=days)
    count, _ = UserSession.objects.filter(last_active__lt=threshold).delete()
    return count
