"""
URL configuration for teams app.
"""

from django.urls import path

from .views import (
    TeamListCreateView,
    TeamDetailView,
    TeamMemberListView,
    TeamMemberDetailView,
    TeamInviteListCreateView,
    TeamInviteRevokeView,
    TeamInviteAcceptView,
    MyTeamsView,
)


urlpatterns = [
    # Teams CRUD
    path("", TeamListCreateView.as_view(), name="team_list_create"),
    path("<uuid:pk>/", TeamDetailView.as_view(), name="team_detail"),

    # Members
    path("<uuid:pk>/members/", TeamMemberListView.as_view(), name="team_members"),
    path(
        "<uuid:pk>/members/<uuid:member_pk>/",
        TeamMemberDetailView.as_view(),
        name="team_member_detail"
    ),

    # Invites
    path("<uuid:pk>/invites/", TeamInviteListCreateView.as_view(), name="team_invites"),
    path(
        "<uuid:pk>/invites/<uuid:invite_pk>/revoke/",
        TeamInviteRevokeView.as_view(),
        name="team_invite_revoke"
    ),
    path("invites/accept/<str:token>/", TeamInviteAcceptView.as_view(), name="team_invite_accept"),

    # Team switcher
    path("my-teams/", MyTeamsView.as_view(), name="my_teams"),
]
