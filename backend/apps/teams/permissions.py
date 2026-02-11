"""
Team permissions for role-based access control.
"""

from rest_framework import permissions


class IsTeamMember(permissions.BasePermission):
    """User must be a member of the active team."""
    message = "You are not a member of this team."

    def has_permission(self, request, view):
        return request.team is not None and request.team_membership is not None


class IsTeamAdmin(permissions.BasePermission):
    """User must be owner or admin of the active team."""
    message = "You must be a team admin to perform this action."

    def has_permission(self, request, view):
        if not request.team_membership:
            return False
        return request.team_membership.role in ("owner", "admin")


class IsTeamOwner(permissions.BasePermission):
    """User must be the owner of the active team."""
    message = "Only the team owner can perform this action."

    def has_permission(self, request, view):
        if not request.team_membership:
            return False
        return request.team_membership.role == "owner"


class CanEditResource(permissions.BasePermission):
    """
    Team-aware resource permission.
    - owner/admin/editor: full CRUD
    - viewer: read only
    - Solo mode (no team): falls back to IsOwner behavior
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        # Solo mode — allow, object-level check handles ownership
        if not request.team:
            return True
        if not request.team_membership:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True  # All team members can read
        return request.team_membership.role in ("owner", "admin", "editor")

    def has_object_permission(self, request, view, obj):
        # Solo mode
        if not request.team:
            return obj.user_id == request.user.id
        # Team mode — check object belongs to team
        if hasattr(obj, 'team_id') and obj.team_id:
            if obj.team_id != request.team.id:
                return False
            # Check role for write operations
            if request.method not in permissions.SAFE_METHODS:
                return request.team_membership.role in ("owner", "admin", "editor")
            return True
        # Legacy object without team — only original owner
        return obj.user_id == request.user.id


class HasBusinessPlan(permissions.BasePermission):
    """User must have a Business or Enterprise subscription to access team features."""
    message = "Team features require a Business or Enterprise subscription."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'subscription'):
            return False
        return request.user.subscription.plan in ("business", "enterprise")
