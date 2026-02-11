"""
Tests for links app - CRUD operations and link management.
"""

import pytest
from django.urls import reverse
from rest_framework import status


# =============================================================================
# LINK CREATION TESTS
# =============================================================================

@pytest.mark.django_db
class TestLinkCreation:
    """Tests for creating links."""
    
    def test_create_link_success(self, authenticated_client, user):
        """Test successful link creation."""
        url = "/api/v1/links/"
        data = {
            "original_url": "https://example.com/test-page",
            "title": "My Test Link",
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert "short_url" in response.data
        assert "short_code" in response.data
        assert response.data["original_url"] == data["original_url"]
        assert response.data["title"] == data["title"]
    
    def test_create_link_with_utm(self, authenticated_client):
        """Test creating link with UTM parameters."""
        url = "/api/v1/links/"
        data = {
            "original_url": "https://example.com/page",
            "utm_source": "newsletter",
            "utm_medium": "email",
            "utm_campaign": "spring_sale",
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["utm_source"] == "newsletter"
        assert response.data["utm_medium"] == "email"
    
    def test_create_link_invalid_url(self, authenticated_client):
        """Test creating link with invalid URL."""
        url = "/api/v1/links/"
        data = {
            "original_url": "not-a-valid-url",
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_create_link_blocked_url(self, authenticated_client):
        """Test creating link with blocked URL pattern."""
        url = "/api/v1/links/"
        data = {
            "original_url": "http://localhost/admin",
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_create_link_custom_slug_free_user(self, authenticated_client):
        """Test that free users cannot use custom slugs."""
        url = "/api/v1/links/"
        data = {
            "original_url": "https://example.com/page",
            "custom_slug": "my-custom-link",
        }
        
        response = authenticated_client.post(url, data)
        
        # Should create link but ignore custom slug
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["short_code"] != "my-custom-link"
    
    def test_create_link_custom_slug_pro_user(self, pro_authenticated_client):
        """Test that pro users can use custom slugs."""
        url = "/api/v1/links/"
        data = {
            "original_url": "https://example.com/page",
            "custom_slug": "my-custom-link",
        }
        
        response = pro_authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["short_code"] == "my-custom-link"


# =============================================================================
# LINK RETRIEVAL TESTS
# =============================================================================

@pytest.mark.django_db
class TestLinkRetrieval:
    """Tests for retrieving links."""
    
    def test_list_links(self, authenticated_client, multiple_links):
        """Test listing user's links."""
        url = "/api/v1/links/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 5
    
    def test_get_link_detail(self, authenticated_client, link):
        """Test getting a specific link."""
        url = f"/api/v1/links/{link.id}/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(link.id)
    
    def test_get_link_not_found(self, authenticated_client):
        """Test getting non-existent link."""
        import uuid
        url = f"/api/v1/links/{uuid.uuid4()}/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_get_other_user_link(self, authenticated_client, pro_user):
        """Test that users cannot access other users' links."""
        from apps.links.models import Link
        
        # Create link for another user
        other_link = Link.objects.create(
            user=pro_user,
            original_url="https://example.com/other",
        )
        
        url = f"/api/v1/links/{other_link.id}/"
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_list_links_search(self, authenticated_client, multiple_links):
        """Test searching links."""
        url = "/api/v1/links/?search=page-1"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1


# =============================================================================
# LINK UPDATE TESTS
# =============================================================================

@pytest.mark.django_db
class TestLinkUpdate:
    """Tests for updating links."""
    
    def test_update_link_title(self, authenticated_client, link):
        """Test updating link title."""
        url = f"/api/v1/links/{link.id}/"
        data = {"title": "Updated Title"}
        
        response = authenticated_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == "Updated Title"
    
    def test_update_link_deactivate(self, authenticated_client, link):
        """Test deactivating a link."""
        url = f"/api/v1/links/{link.id}/"
        data = {"is_active": False}
        
        response = authenticated_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_active"] is False


# =============================================================================
# LINK DELETION TESTS
# =============================================================================

@pytest.mark.django_db
class TestLinkDeletion:
    """Tests for deleting links."""
    
    def test_delete_link(self, authenticated_client, link):
        """Test deleting a link."""
        url = f"/api/v1/links/{link.id}/"
        
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
    
    def test_delete_other_user_link(self, authenticated_client, pro_user):
        """Test that users cannot delete other users' links."""
        from apps.links.models import Link
        
        other_link = Link.objects.create(
            user=pro_user,
            original_url="https://example.com/other",
        )
        
        url = f"/api/v1/links/{other_link.id}/"
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


# =============================================================================
# LINK STATS TESTS
# =============================================================================

@pytest.mark.django_db
class TestLinkStats:
    """Tests for link statistics."""
    
    def test_get_link_stats(self, authenticated_client, link, click_event):
        """Test getting link statistics."""
        url = f"/api/v1/links/{link.id}/stats/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "total_clicks" in response.data


# =============================================================================
# BULK OPERATIONS TESTS
# =============================================================================

@pytest.mark.django_db
class TestBulkOperations:
    """Tests for bulk link operations."""
    
    def test_bulk_create_links(self, authenticated_client):
        """Test bulk creating links."""
        url = "/api/v1/links/bulk/"
        data = {
            "urls": [
                "https://example.com/page1",
                "https://example.com/page2",
                "https://example.com/page3",
            ]
        }
        
        response = authenticated_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert len(response.data["links"]) == 3
    
    def test_bulk_create_with_invalid_urls(self, authenticated_client):
        """Test bulk create with some invalid URLs."""
        url = "/api/v1/links/bulk/"
        data = {
            "urls": [
                "https://example.com/valid",
                "not-valid",
                "http://localhost/blocked",
            ]
        }
        
        response = authenticated_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert len(response.data["links"]) == 1
        assert len(response.data["errors"]) == 2


# =============================================================================
# EXPORT/IMPORT TESTS
# =============================================================================

@pytest.mark.django_db
class TestLinksExport:
    """Tests for links export."""
    
    def test_export_links_csv(self, authenticated_client, multiple_links):
        """Test exporting links as CSV."""
        url = "/api/v1/links/export/?format=csv"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/csv"
        assert "attachment" in response["Content-Disposition"]
    
    def test_export_links_json(self, authenticated_client, multiple_links):
        """Test exporting links as JSON."""
        url = "/api/v1/links/export/?format=json"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/json"


# =============================================================================
# CUSTOM DOMAIN TESTS
# =============================================================================

@pytest.mark.django_db
class TestCustomDomains:
    """Tests for custom domain management."""
    
    def test_list_domains(self, pro_authenticated_client, custom_domain):
        """Test listing custom domains."""
        url = "/api/v1/links/domains/"
        
        response = pro_authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_create_domain_free_user(self, authenticated_client):
        """Test that free users cannot create custom domains."""
        url = "/api/v1/links/domains/"
        data = {"domain": "short.example.com"}
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
