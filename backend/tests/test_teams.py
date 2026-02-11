"""
Tests for Teams app - CRUD, Invites, and Permissions.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.teams.models import Team, TeamMember, TeamInvite


@pytest.mark.django_db
class TestTeamCRUD:
    """Test team create, read, update, delete operations."""
    
    def test_create_team_requires_business_plan(self, authenticated_client):
        """Free users cannot create teams."""
        url = reverse("teams:team-list")
        response = authenticated_client.post(url, {"name": "New Team"})
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_create_team_business_user(self, api_client, business_user):
        """Business users can create teams."""
        refresh = RefreshToken.for_user(business_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:team-list")
        response = api_client.post(url, {"name": "My Team"})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "My Team"
        assert response.data["slug"] == "my-team"
        
        # Verify owner membership was created
        team = Team.objects.get(id=response.data["id"])
        assert team.members.filter(user=business_user, role="owner").exists()
    
    def test_list_teams(self, api_client, business_user, team):
        """Users can list their teams."""
        refresh = RefreshToken.for_user(business_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:team-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1
    
    def test_retrieve_team_as_member(self, api_client, business_user, team):
        """Team members can retrieve team details."""
        refresh = RefreshToken.for_user(business_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:team-detail", kwargs={"slug": team.slug})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == team.name
    
    def test_update_team_as_owner(self, api_client, business_user, team):
        """Team owners can update team."""
        refresh = RefreshToken.for_user(business_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:team-detail", kwargs={"slug": team.slug})
        response = api_client.patch(url, {"name": "Updated Team Name"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Updated Team Name"
    
    def test_delete_team_as_owner(self, api_client, business_user, team):
        """Team owners can delete teams."""
        refresh = RefreshToken.for_user(business_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:team-detail", kwargs={"slug": team.slug})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Team.objects.filter(id=team.id).exists()


@pytest.mark.django_db
class TestTeamInvites:
    """Test team invite operations."""
    
    def test_create_invite_as_admin(self, api_client, business_user, team):
        """Admins and owners can create invites."""
        refresh = RefreshToken.for_user(business_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:invite-list", kwargs={"team_slug": team.slug})
        response = api_client.post(url, {"email": "newmember@example.com", "role": "editor"})
        assert response.status_code == status.HTTP_201_CREATED
        assert TeamInvite.objects.filter(email="newmember@example.com", team=team).exists()
    
    def test_accept_invite(self, api_client, team_invite, user):
        """Users can accept invites."""
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:accept-invite")
        # Update invite email to match user
        team_invite.email = user.email
        team_invite.save()
        
        response = api_client.post(url, {"token": str(team_invite.token)})
        assert response.status_code == status.HTTP_200_OK
        assert TeamMember.objects.filter(team=team_invite.team, user=user).exists()
    
    def test_cancel_invite(self, api_client, business_user, team, team_invite):
        """Admins can cancel invites."""
        refresh = RefreshToken.for_user(business_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:invite-detail", kwargs={"team_slug": team.slug, "pk": team_invite.id})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestTeamPermissions:
    """Test role-based permissions."""
    
    def test_viewer_cannot_edit_team(self, api_client, user, team_with_members):
        """Viewers cannot update team settings."""
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:team-detail", kwargs={"slug": team_with_members.slug})
        response = api_client.patch(url, {"name": "Hacked Name"})
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_viewer_can_read_team(self, api_client, user, team_with_members):
        """Viewers can read team details."""
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:team-detail", kwargs={"slug": team_with_members.slug})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
    
    def test_admin_can_invite(self, api_client, pro_user, team_with_members):
        """Admins can create invites."""
        refresh = RefreshToken.for_user(pro_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:invite-list", kwargs={"team_slug": team_with_members.slug})
        response = api_client.post(url, {"email": "another@example.com", "role": "viewer"})
        assert response.status_code == status.HTTP_201_CREATED
    
    def test_viewer_cannot_invite(self, api_client, user, team_with_members):
        """Viewers cannot create invites."""
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        
        url = reverse("teams:invite-list", kwargs={"team_slug": team_with_members.slug})
        response = api_client.post(url, {"email": "hacker@example.com", "role": "admin"})
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestTeamResources:
    """Test team-scoped resource access."""
    
    def test_team_scoped_links(self, api_client, business_user, team):
        """Links created in team context belong to team."""
        from apps.links.models import Link
        
        refresh = RefreshToken.for_user(business_user)
        api_client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}",
            HTTP_X_TEAM_SLUG=team.slug
        )
        
        url = reverse("links:link-list")
        response = api_client.post(url, {"original_url": "https://example.com"})
        
        if response.status_code == status.HTTP_201_CREATED:
            link = Link.objects.get(id=response.data["id"])
            assert link.team == team
    
    def test_member_can_view_team_links(self, api_client, user, team_with_members):
        """Team members can view team links."""
        refresh = RefreshToken.for_user(user)
        api_client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}",
            HTTP_X_TEAM_SLUG=team_with_members.slug
        )
        
        url = reverse("links:link-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
