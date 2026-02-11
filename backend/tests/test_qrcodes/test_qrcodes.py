"""
Tests for qrcodes app - QR code generation and management.
"""

import pytest
from rest_framework import status


# =============================================================================
# QR CODE CREATION TESTS
# =============================================================================

@pytest.mark.django_db
class TestQRCodeCreation:
    """Tests for creating QR codes."""
    
    def test_create_qr_code_success(self, authenticated_client, link):
        """Test successful QR code creation."""
        url = "/api/v1/qr-codes/"
        data = {
            "link_id": str(link.id),
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert "id" in response.data
    
    def test_create_qr_code_with_customization(self, authenticated_client, link):
        """Test creating QR code with custom colors."""
        url = "/api/v1/qr-codes/"
        data = {
            "link_id": str(link.id),
            "foreground_color": "#FF0000",
            "background_color": "#FFFFFF",
            "size": 512,
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["foreground_color"] == "#FF0000"
    
    def test_create_qr_code_invalid_link(self, authenticated_client):
        """Test creating QR code with non-existent link."""
        import uuid
        url = "/api/v1/qr-codes/"
        data = {
            "link_id": str(uuid.uuid4()),
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_create_qr_code_unauthenticated(self, api_client, link):
        """Test QR code creation requires authentication."""
        url = "/api/v1/qr-codes/"
        data = {"link_id": str(link.id)}
        
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# QR CODE RETRIEVAL TESTS
# =============================================================================

@pytest.mark.django_db
class TestQRCodeRetrieval:
    """Tests for retrieving QR codes."""
    
    def test_list_qr_codes(self, authenticated_client, qr_code):
        """Test listing user's QR codes."""
        url = "/api/v1/qr-codes/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_get_qr_code_detail(self, authenticated_client, qr_code):
        """Test getting a specific QR code."""
        url = f"/api/v1/qr-codes/{qr_code.id}/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(qr_code.id)
    
    def test_get_qr_code_not_found(self, authenticated_client):
        """Test getting non-existent QR code."""
        import uuid
        url = f"/api/v1/qr-codes/{uuid.uuid4()}/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


# =============================================================================
# QR CODE UPDATE TESTS
# =============================================================================

@pytest.mark.django_db
class TestQRCodeUpdate:
    """Tests for updating QR codes."""
    
    def test_update_qr_code_colors(self, authenticated_client, qr_code):
        """Test updating QR code colors."""
        url = f"/api/v1/qr-codes/{qr_code.id}/"
        data = {
            "foreground_color": "#0000FF",
            "background_color": "#FFFF00",
        }
        
        response = authenticated_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["foreground_color"] == "#0000FF"
    
    def test_update_qr_code_size(self, authenticated_client, qr_code):
        """Test updating QR code size."""
        url = f"/api/v1/qr-codes/{qr_code.id}/"
        data = {"size": 1024}
        
        response = authenticated_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# QR CODE DELETION TESTS
# =============================================================================

@pytest.mark.django_db
class TestQRCodeDeletion:
    """Tests for deleting QR codes."""
    
    def test_delete_qr_code(self, authenticated_client, qr_code):
        """Test deleting a QR code."""
        url = f"/api/v1/qr-codes/{qr_code.id}/"
        
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT


# =============================================================================
# QR CODE DOWNLOAD TESTS
# =============================================================================

@pytest.mark.django_db
class TestQRCodeDownload:
    """Tests for downloading QR codes."""
    
    def test_download_qr_code_png(self, authenticated_client, qr_code):
        """Test downloading QR code as PNG."""
        url = f"/api/v1/qr-codes/{qr_code.id}/download/?format=png"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "image/png"
    
    def test_download_qr_code_svg(self, authenticated_client, qr_code):
        """Test downloading QR code as SVG."""
        url = f"/api/v1/qr-codes/{qr_code.id}/download/?format=svg"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "svg" in response["Content-Type"].lower()


# =============================================================================
# QR CODE MODEL TESTS
# =============================================================================

@pytest.mark.django_db
class TestQRCodeModel:
    """Tests for QR code model functionality."""
    
    def test_qr_code_defaults(self, db, user, link):
        """Test QR code default values."""
        from apps.qrcodes.models import QRCode
        
        qr = QRCode.objects.create(user=user, link=link)
        
        assert qr.foreground_color == "#000000"
        assert qr.background_color == "#FFFFFF"
        assert qr.size == 256
        assert qr.error_correction == "M"
    
    def test_qr_code_scan_tracking(self, db, qr_code):
        """Test QR code scan tracking."""
        initial_scans = qr_code.total_scans
        
        qr_code.total_scans += 1
        qr_code.save()
        
        qr_code.refresh_from_db()
        assert qr_code.total_scans == initial_scans + 1
