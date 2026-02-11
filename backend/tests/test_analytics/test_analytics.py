"""
Tests for analytics app - click tracking and statistics.
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status


# =============================================================================
# ANALYTICS OVERVIEW TESTS
# =============================================================================

@pytest.mark.django_db
class TestAnalyticsOverview:
    """Tests for analytics overview endpoint."""
    
    def test_get_analytics_overview(self, authenticated_client, link, click_event):
        """Test getting analytics overview."""
        url = "/api/v1/analytics/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "total_clicks" in response.data
        assert "total_links" in response.data
    
    def test_analytics_overview_unauthenticated(self, api_client):
        """Test analytics requires authentication."""
        url = "/api/v1/analytics/"
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_analytics_overview_empty(self, authenticated_client):
        """Test analytics with no data."""
        url = "/api/v1/analytics/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_clicks"] == 0


# =============================================================================
# CLICK TRACKING TESTS
# =============================================================================

@pytest.mark.django_db
class TestClickTracking:
    """Tests for click event tracking."""
    
    def test_click_event_creation(self, db, link):
        """Test creating a click event."""
        from apps.analytics.models import ClickEvent
        
        click = ClickEvent.objects.create(
            link=link,
            clicked_at=timezone.now(),
            ip_hash="abc123",
            country_code="US",
            city="New York",
            device_type="desktop",
            browser="Chrome",
            os="Windows",
        )
        
        assert click.id is not None
        assert click.link == link
        assert click.country_code == "US"
    
    def test_click_event_with_geo_data(self, db, link):
        """Test click event with geographic data."""
        from apps.analytics.models import ClickEvent
        
        click = ClickEvent.objects.create(
            link=link,
            clicked_at=timezone.now(),
            ip_hash="xyz789",
            country_code="GB",
            country_name="United Kingdom",
            city="London",
            latitude=51.5074,
            longitude=-0.1278,
            timezone="Europe/London",
        )
        
        assert click.country_name == "United Kingdom"
        assert float(click.latitude) == 51.5074


# =============================================================================
# LINK STATS TESTS
# =============================================================================

@pytest.mark.django_db
class TestLinkStats:
    """Tests for individual link statistics."""
    
    def test_get_link_stats(self, authenticated_client, link, click_event):
        """Test getting statistics for a specific link."""
        url = f"/api/v1/links/{link.id}/stats/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_link_stats_with_period(self, authenticated_client, link):
        """Test link stats with time period filter."""
        url = f"/api/v1/links/{link.id}/stats/?period=7d"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# GEOGRAPHY ANALYTICS TESTS
# =============================================================================

@pytest.mark.django_db
class TestGeographyAnalytics:
    """Tests for geography-based analytics."""
    
    def test_get_geography_stats(self, authenticated_client, link):
        """Test getting geographic statistics."""
        from apps.analytics.models import ClickEvent
        
        # Create clicks from different countries
        for country in [("US", "United States"), ("GB", "United Kingdom"), ("DE", "Germany")]:
            ClickEvent.objects.create(
                link=link,
                clicked_at=timezone.now(),
                ip_hash=f"hash_{country[0]}",
                country_code=country[0],
                country_name=country[1],
            )
        
        url = "/api/v1/analytics/geography/"
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# DEVICE ANALYTICS TESTS
# =============================================================================

@pytest.mark.django_db
class TestDeviceAnalytics:
    """Tests for device-based analytics."""
    
    def test_get_device_stats(self, authenticated_client, link):
        """Test getting device statistics."""
        from apps.analytics.models import ClickEvent
        
        # Create clicks from different devices
        for device in ["desktop", "mobile", "tablet"]:
            ClickEvent.objects.create(
                link=link,
                clicked_at=timezone.now(),
                ip_hash=f"hash_{device}",
                device_type=device,
            )
        
        url = "/api/v1/analytics/devices/"
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# REFERRER ANALYTICS TESTS
# =============================================================================

@pytest.mark.django_db
class TestReferrerAnalytics:
    """Tests for referrer-based analytics."""
    
    def test_get_referrer_stats(self, authenticated_client, link):
        """Test getting referrer statistics."""
        from apps.analytics.models import ClickEvent
        
        # Create clicks from different referrers
        for referer in ["https://google.com", "https://twitter.com", "https://facebook.com"]:
            ClickEvent.objects.create(
                link=link,
                clicked_at=timezone.now(),
                ip_hash=f"hash_{referer}",
                referer=referer,
            )
        
        url = "/api/v1/analytics/referrers/"
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# DAILY STATS TESTS
# =============================================================================

@pytest.mark.django_db
class TestDailyStats:
    """Tests for daily statistics aggregation."""
    
    def test_daily_stats_creation(self, db, link):
        """Test creating daily stats."""
        from apps.analytics.models import DailyStats
        
        stats = DailyStats.objects.create(
            link=link,
            date=timezone.now().date(),
            total_clicks=100,
            unique_clicks=75,
            mobile_clicks=40,
            desktop_clicks=50,
            tablet_clicks=10,
        )
        
        assert stats.total_clicks == 100
        assert stats.unique_clicks == 75
    
    def test_daily_stats_unique_constraint(self, db, link):
        """Test that daily stats are unique per link per day."""
        from apps.analytics.models import DailyStats
        from django.db import IntegrityError
        
        today = timezone.now().date()
        
        DailyStats.objects.create(
            link=link,
            date=today,
            total_clicks=50,
        )
        
        # Attempting to create another stats for same link/date should fail
        with pytest.raises(IntegrityError):
            DailyStats.objects.create(
                link=link,
                date=today,
                total_clicks=100,
            )


# =============================================================================
# ANALYTICS EXPORT TESTS
# =============================================================================

@pytest.mark.django_db
class TestAnalyticsExport:
    """Tests for analytics data export."""
    
    def test_export_analytics_csv(self, authenticated_client, link, click_event):
        """Test exporting analytics as CSV."""
        url = "/api/v1/analytics/export/?format=csv"
        
        response = authenticated_client.get(url)
        
        # Export might be async, so check for 200 or 202
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_202_ACCEPTED]
    
    def test_export_analytics_json(self, authenticated_client, link, click_event):
        """Test exporting analytics as JSON."""
        url = "/api/v1/analytics/export/?format=json"
        
        response = authenticated_client.get(url)
        
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_202_ACCEPTED]
