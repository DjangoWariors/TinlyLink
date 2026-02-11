"""
Custom permissions for TinlyLink.
"""

from rest_framework import permissions


class HasPaidPlan(permissions.BasePermission):
    """
    Permission that requires a paid plan (Pro, Business, or Enterprise).
    """
    message = "This feature requires a Pro, Business, or Enterprise subscription."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        subscription = getattr(request.user, "subscription", None)
        if not subscription:
            return False

        return subscription.plan in ("pro", "business", "enterprise")


class HasBusinessPlan(permissions.BasePermission):
    """
    Permission that requires a Business or Enterprise plan.
    """
    message = "This feature requires a Business or Enterprise subscription."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        subscription = getattr(request.user, "subscription", None)
        if not subscription:
            return False

        return subscription.plan in ("business", "enterprise")


class CanCreateLinks(permissions.BasePermission):
    """
    Permission that checks if user can create more links.
    """
    message = "You have reached your monthly link limit. Please upgrade your plan."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if request.method not in ("POST",):
            return True
        
        from .models import UsageTracking
        
        subscription = getattr(request.user, "subscription", None)
        if not subscription:
            return False
        
        usage = UsageTracking.get_current_period(request.user)
        return subscription.can_create_link(usage.links_created)


class CanCreateQRCodes(permissions.BasePermission):
    """
    Permission that checks if user can create more QR codes.
    """
    message = "You have reached your monthly QR code limit. Please upgrade your plan."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if request.method not in ("POST",):
            return True
        
        from .models import UsageTracking
        
        subscription = getattr(request.user, "subscription", None)
        if not subscription:
            return False
        
        usage = UsageTracking.get_current_period(request.user)
        return subscription.can_create_qr(usage.qr_codes_created)


class CanUseCustomSlug(permissions.BasePermission):
    """
    Permission that checks if user can use custom slugs.
    """
    message = "Custom slugs are only available on Pro, Business, and Enterprise plans."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Only check on POST requests with custom_slug
        if request.method != "POST":
            return True
        
        custom_slug = request.data.get("custom_slug")
        if not custom_slug:
            return True
        
        subscription = getattr(request.user, "subscription", None)
        if not subscription:
            return False
        
        return subscription.can_use_custom_slug()


class HasAPIScope(permissions.BasePermission):
    """
    Permission that checks API key scope.
    """
    
    def __init__(self, required_scope):
        self.required_scope = required_scope
    
    def has_permission(self, request, view):
        api_key = getattr(request, "api_key", None)
        
        # If not using API key auth, allow
        if api_key is None:
            return True
        
        return api_key.has_scope(self.required_scope)


class IsOwner(permissions.BasePermission):
    """
    Object-level permission to only allow owners of an object to access it.
    Also allows access if user is a member of the object's team.
    """
    
    def has_object_permission(self, request, view, obj):
        # Check team membership first
        if hasattr(obj, "team") and obj.team:
            team = obj.team
            # Check if user is a member of the team
            if hasattr(team, "members"):
                return team.members.filter(user=request.user).exists()
        
        # Fall back to user ownership check
        if hasattr(obj, "user_id"):
            return obj.user_id == request.user.id
        if hasattr(obj, "user"):
            return obj.user == request.user
        return False
