"""
Team views for API endpoints.
"""

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

from .models import Team, TeamMember, TeamInvite
from .serializers import (
    TeamSerializer, TeamMemberSerializer, TeamInviteSerializer,
    CreateTeamSerializer, UpdateTeamSerializer, InviteMemberSerializer,
    UpdateMemberRoleSerializer, MyTeamEntrySerializer
)
from .permissions import IsTeamMember, IsTeamAdmin, IsTeamOwner, HasBusinessPlan
from .tasks import send_team_invite_email


class TeamListCreateView(generics.ListCreateAPIView):
    """
    GET: List teams the user is a member of.
    POST: Create a new team (Business plan required).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TeamSerializer
    pagination_class = None
    def get_queryset(self):
        # Get all teams where user is a member
        team_ids = TeamMember.objects.filter(
            user=self.request.user
        ).values_list("team_id", flat=True)
        return Team.objects.filter(id__in=team_ids).select_related("owner")

    def create(self, request, *args, **kwargs):
        # Check Business plan
        subscription = getattr(request.user, "subscription", None)
        if not subscription or not subscription.can_create_team:
            return Response(
                {"error": "Team features require a Business subscription."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CreateTeamSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            # Create team
            team = Team.objects.create(
                name=serializer.validated_data["name"],
                description=serializer.validated_data.get("description", ""),
                owner=request.user
            )

            # Add creator as owner member
            TeamMember.objects.create(
                team=team,
                user=request.user,
                role="owner"
            )

        response_serializer = TeamSerializer(team, context={"request": request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class TeamDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Team details (any member).
    PATCH: Update team (owner/admin only).
    DELETE: Delete team (owner only).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TeamSerializer
    lookup_field = "pk"

    def get_queryset(self):
        team_ids = TeamMember.objects.filter(
            user=self.request.user
        ).values_list("team_id", flat=True)
        return Team.objects.filter(id__in=team_ids).select_related("owner")

    def update(self, request, *args, **kwargs):
        team = self.get_object()

        # Check admin permission
        try:
            membership = TeamMember.objects.get(team=team, user=request.user)
            if membership.role not in ("owner", "admin"):
                return Response(
                    {"error": "You must be a team admin to update team settings."},
                    status=status.HTTP_403_FORBIDDEN
                )
        except TeamMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this team."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = UpdateTeamSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(team, field, value)
        team.save()

        response_serializer = TeamSerializer(team, context={"request": request})
        return Response(response_serializer.data)

    def destroy(self, request, *args, **kwargs):
        team = self.get_object()

        # Only owner can delete
        try:
            membership = TeamMember.objects.get(team=team, user=request.user)
            if membership.role != "owner":
                return Response(
                    {"error": "Only the team owner can delete the team."},
                    status=status.HTTP_403_FORBIDDEN
                )
        except TeamMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this team."},
                status=status.HTTP_403_FORBIDDEN
            )

        team.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamMemberListView(generics.ListAPIView):
    """
    GET: List members of a team (any member).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TeamMemberSerializer
    pagination_class = None
    def get_queryset(self):
        team_id = self.kwargs.get("pk")
        # Verify user is a member
        if not TeamMember.objects.filter(
            team_id=team_id, user=self.request.user
        ).exists():
            return TeamMember.objects.none()
        return TeamMember.objects.filter(team_id=team_id).select_related("user")


class TeamMemberDetailView(APIView):
    """
    PATCH: Update member role (owner/admin only).
    DELETE: Remove member (owner/admin, or self to leave).
    """
    permission_classes = [IsAuthenticated]
    pagination_class = None
    def get_team_and_membership(self, pk, member_pk):
        team = get_object_or_404(Team, pk=pk)
        member = get_object_or_404(TeamMember, pk=member_pk, team=team)
        try:
            requester_membership = TeamMember.objects.get(
                team=team, user=self.request.user
            )
        except TeamMember.DoesNotExist:
            requester_membership = None
        return team, member, requester_membership

    def patch(self, request, pk, member_pk):
        """Update member role."""
        team, member, requester_membership = self.get_team_and_membership(pk, member_pk)

        if not requester_membership:
            return Response(
                {"error": "You are not a member of this team."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Only owner/admin can change roles
        if requester_membership.role not in ("owner", "admin"):
            return Response(
                {"error": "You must be a team admin to change member roles."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Cannot change own role
        if member.user_id == request.user.id:
            return Response(
                {"error": "You cannot change your own role."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cannot change owner's role
        if member.role == "owner":
            return Response(
                {"error": "Cannot change the owner's role. Transfer ownership first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = UpdateMemberRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        member.role = serializer.validated_data["role"]
        member.save(update_fields=["role"])

        return Response(TeamMemberSerializer(member).data)

    def delete(self, request, pk, member_pk):
        """Remove member from team."""
        team, member, requester_membership = self.get_team_and_membership(pk, member_pk)

        if not requester_membership:
            return Response(
                {"error": "You are not a member of this team."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Self-removal (leaving team)
        if member.user_id == request.user.id:
            if member.role == "owner":
                return Response(
                    {"error": "The team owner cannot leave. Transfer ownership first."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            member.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        # Removing others requires admin+
        if requester_membership.role not in ("owner", "admin"):
            return Response(
                {"error": "You must be a team admin to remove members."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Cannot remove the owner
        if member.role == "owner":
            return Response(
                {"error": "Cannot remove the team owner."},
                status=status.HTTP_400_BAD_REQUEST
            )

        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamInviteListCreateView(generics.ListCreateAPIView):
    """
    GET: List pending invites (admin+).
    POST: Send invite (admin+).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TeamInviteSerializer
    pagination_class = None
    def get_queryset(self):
        team_id = self.kwargs.get("pk")
        # Verify user is admin+
        try:
            membership = TeamMember.objects.get(
                team_id=team_id, user=self.request.user
            )
            if membership.role not in ("owner", "admin"):
                return TeamInvite.objects.none()
        except TeamMember.DoesNotExist:
            return TeamInvite.objects.none()

        return TeamInvite.objects.filter(
            team_id=team_id, status="pending"
        ).select_related("invited_by")

    def create(self, request, *args, **kwargs):
        team_id = self.kwargs.get("pk")
        team = get_object_or_404(Team, pk=team_id)

        # Verify admin permission
        try:
            membership = TeamMember.objects.get(team=team, user=request.user)
            if membership.role not in ("owner", "admin"):
                return Response(
                    {"error": "You must be a team admin to invite members."},
                    status=status.HTTP_403_FORBIDDEN
                )
        except TeamMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this team."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = InviteMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].lower()
        role = serializer.validated_data["role"]

        # Check if already a member
        from apps.users.models import User
        existing_user = User.objects.filter(email=email).first()
        if existing_user and TeamMember.objects.filter(
            team=team, user=existing_user
        ).exists():
            return Response(
                {"error": "This user is already a member of the team."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check pending invite exists
        if TeamInvite.objects.filter(
            team=team, email=email, status="pending"
        ).exists():
            return Response(
                {"error": "An invite has already been sent to this email."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check team member limit
        current_count = team.members.count()
        subscription = team.owner.subscription
        if not subscription.can_add_team_member(current_count):
            return Response(
                {"error": "Team member limit reached. Upgrade your plan to add more members."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Create invite
        invite = TeamInvite.objects.create(
            team=team,
            email=email,
            role=role,
            invited_by=request.user
        )

        # Send invite email
        send_team_invite_email.delay(str(invite.id))

        return Response(
            TeamInviteSerializer(invite).data,
            status=status.HTTP_201_CREATED
        )


class TeamInviteRevokeView(APIView):
    """
    POST: Revoke a pending invite (admin+).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, invite_pk):
        team = get_object_or_404(Team, pk=pk)
        invite = get_object_or_404(TeamInvite, pk=invite_pk, team=team)

        # Verify admin permission
        try:
            membership = TeamMember.objects.get(team=team, user=request.user)
            if membership.role not in ("owner", "admin"):
                return Response(
                    {"error": "You must be a team admin to revoke invites."},
                    status=status.HTTP_403_FORBIDDEN
                )
        except TeamMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this team."},
                status=status.HTTP_403_FORBIDDEN
            )

        if invite.status != "pending":
            return Response(
                {"error": "This invite is no longer pending."},
                status=status.HTTP_400_BAD_REQUEST
            )

        invite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamInviteAcceptView(APIView):
    """
    GET: Get invite details by token.
    POST: Accept invite by token (authenticated user).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, token):
        """Get invite details."""
        invite = get_object_or_404(TeamInvite, token=token)

        if invite.status != "pending":
            return Response(
                {"error": "This invite is no longer valid.", "status": invite.status},
                status=status.HTTP_400_BAD_REQUEST
            )

        if invite.is_expired:
            invite.status = "expired"
            invite.save(update_fields=["status"])
            return Response(
                {"error": "This invite has expired.", "status": "expired"},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            "team_name": invite.team.name,
            "team_slug": invite.team.slug,
            "role": invite.role,
            "invited_by": invite.invited_by.display_name,
            "expires_at": invite.expires_at,
            "email": invite.email,
        })

    def post(self, request, token):
        """Accept the invite."""
        invite = get_object_or_404(TeamInvite, token=token)

        # Validate invite
        if invite.status != "pending":
            return Response(
                {"error": "This invite is no longer valid."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if invite.is_expired:
            invite.status = "expired"
            invite.save(update_fields=["status"])
            return Response(
                {"error": "This invite has expired."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Email must match (for security)
        if invite.email.lower() != request.user.email.lower():
            return Response(
                {"error": "This invite was sent to a different email address."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check not already a member
        if TeamMember.objects.filter(
            team=invite.team, user=request.user
        ).exists():
            return Response(
                {"error": "You are already a member of this team."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check team member limit
        current_count = invite.team.members.count()
        subscription = invite.team.owner.subscription
        if not subscription.can_add_team_member(current_count):
            return Response(
                {"error": "Team member limit reached. Contact the team owner."},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            # Create membership
            TeamMember.objects.create(
                team=invite.team,
                user=request.user,
                role=invite.role,
                invited_by=invite.invited_by
            )

            # Update invite
            invite.status = "accepted"
            invite.accepted_by = request.user
            invite.save(update_fields=["status", "accepted_by"])

        return Response({
            "message": f"You have joined {invite.team.name}.",
            "team": TeamSerializer(invite.team, context={"request": request}).data
        })


class MyTeamsView(generics.ListAPIView):
    """
    GET: Lightweight list for team switcher dropdown.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = MyTeamEntrySerializer
    pagination_class = None
    def get_queryset(self):
        return TeamMember.objects.filter(
            user=self.request.user
        ).select_related("team")
