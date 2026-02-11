"""
Team context middleware.
Resolves the active team from X-Team-Slug header.
"""


class TeamContextMiddleware:
    """
    Resolves the active team from the X-Team-Slug header
    and attaches it to request.team and request.team_membership.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.team = None
        request.team_membership = None

        # Only process for authenticated users
        if hasattr(request, 'user') and request.user.is_authenticated:
            team_slug = request.headers.get('X-Team-Slug')
            if team_slug:
                from apps.teams.models import Team, TeamMember
                try:
                    team = Team.objects.get(slug=team_slug)
                    membership = TeamMember.objects.get(team=team, user=request.user)
                    request.team = team
                    request.team_membership = membership
                except (Team.DoesNotExist, TeamMember.DoesNotExist):
                    pass  # No team context — solo mode

        return self.get_response(request)
