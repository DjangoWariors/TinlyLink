"""
Pytest configuration and fixtures for TinlyLink tests.
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.fixture
def api_client():
    """Return an unauthenticated API client."""
    return APIClient()


@pytest.fixture
def user(db):
    """Create a test user."""
    from apps.users.models import User, Subscription
    
    user = User.objects.create_user(
        email="testuser@example.com",
        password="TestPassword123!",
        full_name="Test User",
        is_email_verified=True,
    )
    
    Subscription.objects.create(
        user=user,
        plan="free",
        status="active",
    )
    
    return user


@pytest.fixture
def pro_user(db):
    """Create a Pro subscription user."""
    from apps.users.models import User, Subscription
    
    user = User.objects.create_user(
        email="prouser@example.com",
        password="TestPassword123!",
        full_name="Pro User",
        is_email_verified=True,
    )
    
    Subscription.objects.create(
        user=user,
        plan="pro",
        status="active",
        current_period_start=timezone.now(),
        current_period_end=timezone.now() + timedelta(days=30),
    )
    
    return user


@pytest.fixture
def business_user(db):
    """Create a Business subscription user."""
    from apps.users.models import User, Subscription
    
    user = User.objects.create_user(
        email="businessuser@example.com",
        password="TestPassword123!",
        full_name="Business User",
        is_email_verified=True,
    )
    
    Subscription.objects.create(
        user=user,
        plan="business",
        status="active",
        current_period_start=timezone.now(),
        current_period_end=timezone.now() + timedelta(days=30),
    )
    
    return user


@pytest.fixture
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


@pytest.fixture
def pro_authenticated_client(api_client, pro_user):
    """Return an authenticated API client for Pro user."""
    refresh = RefreshToken.for_user(pro_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


@pytest.fixture
def link(db, user):
    """Create a test link."""
    from apps.links.models import Link
    
    return Link.objects.create(
        user=user,
        original_url="https://example.com/test-page",
        title="Test Link",
    )


@pytest.fixture
def multiple_links(db, user):
    """Create multiple test links."""
    from apps.links.models import Link
    
    links = []
    for i in range(5):
        links.append(Link.objects.create(
            user=user,
            original_url=f"https://example.com/page-{i}",
            title=f"Test Link {i}",
        ))
    return links


@pytest.fixture
def campaign(db, user):
    """Create a test campaign."""
    from apps.campaigns.models import Campaign
    
    return Campaign.objects.create(
        user=user,
        name="Test Campaign",
        description="A test campaign",
        utm_source="test",
        utm_medium="email",
        utm_campaign="test_campaign",
    )


@pytest.fixture
def qr_code(db, user, link):
    """Create a test QR code."""
    from apps.qrcodes.models import QRCode
    
    return QRCode.objects.create(
        user=user,
        link=link,
    )


@pytest.fixture
def click_event(db, link):
    """Create a test click event."""
    from apps.analytics.models import ClickEvent
    
    return ClickEvent.objects.create(
        link=link,
        ip_address="192.168.1.1",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        referer="https://google.com",
        country_code="US",
        city="New York",
        device_type="desktop",
        browser="Chrome",
        os="Windows",
    )


@pytest.fixture
def api_key(db, user):
    """Create a test API key."""
    from apps.users.models import APIKey
    
    api_key, raw_key = APIKey.create_key(
        user=user,
        name="Test API Key",
        scopes=["links:read", "links:write"],
    )
    api_key.raw_key = raw_key  # Attach raw key for testing
    return api_key


@pytest.fixture
def custom_domain(db, pro_user):
    """Create a test custom domain."""
    from apps.links.models import CustomDomain
    
    return CustomDomain.objects.create(
        user=pro_user,
        domain="short.example.com",
        is_verified=True,
        ssl_enabled=True,
    )


@pytest.fixture
def team(db, business_user):
    """Create a test team owned by a business user."""
    from apps.teams.models import Team, TeamMember
    
    team = Team.objects.create(
        name="Test Team",
        slug="test-team"
    )
    TeamMember.objects.create(
        team=team,
        user=business_user,
        role="owner"
    )
    return team


@pytest.fixture
def team_with_members(db, business_user, user, pro_user):
    """Create a test team with multiple members of different roles."""
    from apps.teams.models import Team, TeamMember
    
    team = Team.objects.create(
        name="Multi-Member Team",
        slug="multi-member-team"
    )
    TeamMember.objects.create(team=team, user=business_user, role="owner")
    TeamMember.objects.create(team=team, user=pro_user, role="admin")
    TeamMember.objects.create(team=team, user=user, role="viewer")
    return team


@pytest.fixture
def team_invite(db, team, business_user):
    """Create a test team invite."""
    from apps.teams.models import TeamInvite
    
    return TeamInvite.objects.create(
        team=team,
        email="invited@example.com",
        role="editor",
        invited_by=business_user
    )


# Factory fixtures using factory_boy
@pytest.fixture
def user_factory(db):
    """Factory for creating users."""
    from tests.factories import UserFactory
    return UserFactory


@pytest.fixture
def link_factory(db):
    """Factory for creating links."""
    from tests.factories import LinkFactory
    return LinkFactory


@pytest.fixture
def click_factory(db):
    """Factory for creating click events."""
    from tests.factories import ClickEventFactory
    return ClickEventFactory


# Settings fixtures
@pytest.fixture(autouse=True)
def configure_settings(settings):
    """Configure settings for tests."""
    settings.DEFAULT_SHORT_DOMAIN = "test.lnk.to"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
