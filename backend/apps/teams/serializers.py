"""
Team serializers for API endpoints.
"""

from rest_framework import serializers
from django.utils import timezone

from .models import Team, TeamMember, TeamInvite


class UserMinimalSerializer(serializers.Serializer):
    """Minimal user representation for team member lists."""
    id = serializers.UUIDField()
    email = serializers.EmailField()
    full_name = serializers.CharField()
    avatar_url = serializers.URLField(allow_blank=True)
    initials = serializers.CharField()


class TeamSerializer(serializers.ModelSerializer):
    """Serializer for Team model."""
    member_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    owner_email = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            "id", "name", "slug", "description", "logo_url",
            "owner", "owner_email", "member_count", "my_role",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "slug", "owner", "created_at", "updated_at"]

    def get_member_count(self, obj):
        return obj.members.count()

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        try:
            membership = TeamMember.objects.get(team=obj, user=request.user)
            return membership.role
        except TeamMember.DoesNotExist:
            return None

    def get_owner_email(self, obj):
        return obj.owner.email


class TeamMemberSerializer(serializers.ModelSerializer):
    """Serializer for TeamMember model."""
    user = serializers.SerializerMethodField()

    class Meta:
        model = TeamMember
        fields = ["id", "user", "role", "joined_at"]
        read_only_fields = ["id", "joined_at"]

    def get_user(self, obj):
        return {
            "id": str(obj.user.id),
            "email": obj.user.email,
            "full_name": obj.user.full_name,
            "avatar_url": obj.user.avatar_url,
            "initials": obj.user.initials,
        }


class TeamInviteSerializer(serializers.ModelSerializer):
    """Serializer for TeamInvite model."""
    invited_by_name = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = TeamInvite
        fields = [
            "id", "email", "role", "status",
            "invited_by_name", "is_expired", "expires_at", "created_at"
        ]
        read_only_fields = ["id", "status", "expires_at", "created_at"]

    def get_invited_by_name(self, obj):
        return obj.invited_by.display_name if obj.invited_by else None

    def get_is_expired(self, obj):
        return obj.is_expired


class CreateTeamSerializer(serializers.Serializer):
    """Serializer for creating a team."""
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True, default="")


class UpdateTeamSerializer(serializers.Serializer):
    """Serializer for updating a team."""
    name = serializers.CharField(max_length=100, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    logo_url = serializers.URLField(max_length=500, required=False, allow_blank=True)


class InviteMemberSerializer(serializers.Serializer):
    """Serializer for inviting a team member."""
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=["admin", "editor", "viewer"],
        default="editor"
    )


class UpdateMemberRoleSerializer(serializers.Serializer):
    """Serializer for updating a member's role."""
    role = serializers.ChoiceField(choices=["admin", "editor", "viewer"])


class TransferOwnershipSerializer(serializers.Serializer):
    """Serializer for transferring team ownership."""
    new_owner_id = serializers.UUIDField()


class MyTeamEntrySerializer(serializers.Serializer):
    """Lightweight serializer for team switcher dropdown."""
    team_id = serializers.UUIDField(source="team.id")
    team_name = serializers.CharField(source="team.name")
    team_slug = serializers.SlugField(source="team.slug")
    role = serializers.CharField()
