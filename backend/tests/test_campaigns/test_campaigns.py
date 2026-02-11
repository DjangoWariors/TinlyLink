"""
Tests for campaigns app - campaign management and UTM tracking.
"""

import pytest
from rest_framework import status


# =============================================================================
# CAMPAIGN CRUD TESTS
# =============================================================================

@pytest.mark.django_db
class TestCampaignCreation:
    """Tests for creating campaigns."""
    
    def test_create_campaign_success(self, authenticated_client):
        """Test successful campaign creation."""
        url = "/api/v1/campaigns/"
        data = {
            "name": "Summer Sale 2024",
            "description": "Annual summer promotion",
            "utm_source": "newsletter",
            "utm_medium": "email",
            "utm_campaign": "summer_sale_2024",
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Summer Sale 2024"
        assert response.data["utm_source"] == "newsletter"
    
    def test_create_campaign_minimal(self, authenticated_client):
        """Test creating campaign with minimal data."""
        url = "/api/v1/campaigns/"
        data = {"name": "Quick Campaign"}
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
    
    def test_create_campaign_unauthenticated(self, api_client):
        """Test campaign creation requires authentication."""
        url = "/api/v1/campaigns/"
        data = {"name": "Test Campaign"}
        
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestCampaignRetrieval:
    """Tests for retrieving campaigns."""
    
    def test_list_campaigns(self, authenticated_client, campaign):
        """Test listing user's campaigns."""
        url = "/api/v1/campaigns/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1
    
    def test_get_campaign_detail(self, authenticated_client, campaign):
        """Test getting a specific campaign."""
        url = f"/api/v1/campaigns/{campaign.id}/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(campaign.id)
    
    def test_get_campaign_not_found(self, authenticated_client):
        """Test getting non-existent campaign."""
        import uuid
        url = f"/api/v1/campaigns/{uuid.uuid4()}/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestCampaignUpdate:
    """Tests for updating campaigns."""
    
    def test_update_campaign(self, authenticated_client, campaign):
        """Test updating a campaign."""
        url = f"/api/v1/campaigns/{campaign.id}/"
        data = {"name": "Updated Campaign Name"}
        
        response = authenticated_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Updated Campaign Name"
    
    def test_deactivate_campaign(self, authenticated_client, campaign):
        """Test deactivating a campaign."""
        url = f"/api/v1/campaigns/{campaign.id}/"
        data = {"is_active": False}
        
        response = authenticated_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_active"] is False


@pytest.mark.django_db
class TestCampaignDeletion:
    """Tests for deleting campaigns."""
    
    def test_delete_campaign(self, authenticated_client, campaign):
        """Test deleting a campaign."""
        url = f"/api/v1/campaigns/{campaign.id}/"
        
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT


# =============================================================================
# CAMPAIGN STATS TESTS
# =============================================================================

@pytest.mark.django_db
class TestCampaignStats:
    """Tests for campaign statistics."""
    
    def test_get_campaign_stats(self, authenticated_client, campaign, link):
        """Test getting campaign statistics."""
        # Associate link with campaign
        link.campaign = campaign
        link.save()
        
        url = f"/api/v1/campaigns/{campaign.id}/stats/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# CAMPAIGN LINKS TESTS
# =============================================================================

@pytest.mark.django_db
class TestCampaignLinks:
    """Tests for links within campaigns."""
    
    def test_create_link_with_campaign(self, authenticated_client, campaign):
        """Test creating a link associated with a campaign."""
        url = "/api/v1/links/"
        data = {
            "original_url": "https://example.com/sale",
            "campaign_id": str(campaign.id),
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        # UTM params should be inherited from campaign
    
    def test_list_campaign_links(self, authenticated_client, campaign, link):
        """Test listing links in a campaign."""
        link.campaign = campaign
        link.save()
        
        url = f"/api/v1/links/?campaign={campaign.id}"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1
