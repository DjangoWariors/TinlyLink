"""
Tests for users app - authentication and account management.
"""

import pytest
from django.urls import reverse
from rest_framework import status


# =============================================================================
# REGISTRATION TESTS
# =============================================================================

@pytest.mark.django_db
class TestRegistration:
    """Tests for user registration."""
    
    def test_register_success(self, api_client):
        """Test successful registration."""
        url = "/api/v1/auth/register/"
        data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "full_name": "New User",
        }
        
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert "access_token" in response.data
        assert "refresh_token" in response.data
        assert response.data["user"]["email"] == "newuser@example.com"
    
    def test_register_invalid_email(self, api_client):
        """Test registration with invalid email."""
        url = "/api/v1/auth/register/"
        data = {
            "email": "invalid-email",
            "password": "SecurePassword123!",
            "full_name": "New User",
        }
        
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_register_weak_password(self, api_client):
        """Test registration with weak password."""
        url = "/api/v1/auth/register/"
        data = {
            "email": "newuser@example.com",
            "password": "123",
            "full_name": "New User",
        }
        
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_register_duplicate_email(self, api_client, user):
        """Test registration with existing email."""
        url = "/api/v1/auth/register/"
        data = {
            "email": user.email,
            "password": "SecurePassword123!",
            "full_name": "New User",
        }
        
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# =============================================================================
# LOGIN TESTS
# =============================================================================

@pytest.mark.django_db
class TestLogin:
    """Tests for user login."""
    
    def test_login_success(self, api_client, user):
        """Test successful login."""
        url = "/api/v1/auth/login/"
        data = {
            "email": user.email,
            "password": "TestPassword123!",
        }
        
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.data
        assert "refresh_token" in response.data
    
    def test_login_wrong_password(self, api_client, user):
        """Test login with wrong password."""
        url = "/api/v1/auth/login/"
        data = {
            "email": user.email,
            "password": "WrongPassword123!",
        }
        
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_nonexistent_user(self, api_client):
        """Test login with non-existent user."""
        url = "/api/v1/auth/login/"
        data = {
            "email": "nonexistent@example.com",
            "password": "TestPassword123!",
        }
        
        response = api_client.post(url, data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# TOKEN TESTS
# =============================================================================

@pytest.mark.django_db
class TestTokenRefresh:
    """Tests for token refresh."""
    
    def test_refresh_token_success(self, api_client, user):
        """Test successful token refresh."""
        # First login
        login_url = "/api/v1/auth/login/"
        login_data = {"email": user.email, "password": "TestPassword123!"}
        login_response = api_client.post(login_url, login_data)
        
        refresh_token = login_response.data["refresh_token"]
        
        # Refresh token
        refresh_url = "/api/v1/auth/refresh/"
        response = api_client.post(refresh_url, {"refresh_token": refresh_token})
        
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.data
    
    def test_refresh_token_invalid(self, api_client):
        """Test refresh with invalid token."""
        url = "/api/v1/auth/refresh/"
        response = api_client.post(url, {"refresh_token": "invalid-token"})
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# PROFILE TESTS
# =============================================================================

@pytest.mark.django_db
class TestProfile:
    """Tests for user profile management."""
    
    def test_get_profile(self, authenticated_client, user):
        """Test getting user profile."""
        url = "/api/v1/auth/me/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email
        assert "subscription" in response.data
    
    def test_update_profile(self, authenticated_client, user):
        """Test updating user profile."""
        url = "/api/v1/account/profile/"
        data = {"full_name": "Updated Name"}
        
        response = authenticated_client.patch(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["full_name"] == "Updated Name"
    
    def test_change_password(self, authenticated_client, user):
        """Test changing password."""
        url = "/api/v1/account/password/"
        data = {
            "current_password": "TestPassword123!",
            "new_password": "NewSecurePassword456!",
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_change_password_wrong_current(self, authenticated_client, user):
        """Test changing password with wrong current password."""
        url = "/api/v1/account/password/"
        data = {
            "current_password": "WrongPassword!",
            "new_password": "NewSecurePassword456!",
        }
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# =============================================================================
# API KEY TESTS
# =============================================================================

@pytest.mark.django_db
class TestAPIKeys:
    """Tests for API key management."""
    
    def test_list_api_keys(self, authenticated_client, api_key):
        """Test listing API keys."""
        url = "/api/v1/account/api-keys/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1
    
    def test_create_api_key(self, pro_authenticated_client):
        """Test creating an API key."""
        url = "/api/v1/account/api-keys/"
        data = {
            "name": "New API Key",
            "scopes": ["links:read"],
        }
        
        response = pro_authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_201_CREATED
        assert "key" in response.data
        assert response.data["api_key"]["name"] == "New API Key"
    
    def test_delete_api_key(self, authenticated_client, api_key):
        """Test deleting an API key."""
        url = f"/api/v1/account/api-keys/{api_key.id}/"
        
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT


# =============================================================================
# LOGOUT TESTS
# =============================================================================

@pytest.mark.django_db
class TestLogout:
    """Tests for user logout."""
    
    def test_logout_success(self, api_client, user):
        """Test successful logout."""
        # First login
        login_url = "/api/v1/auth/login/"
        login_data = {"email": user.email, "password": "TestPassword123!"}
        login_response = api_client.post(login_url, login_data)
        
        access_token = login_response.data["access_token"]
        refresh_token = login_response.data["refresh_token"]
        
        # Logout
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        logout_url = "/api/v1/auth/logout/"
        response = api_client.post(logout_url, {"refresh_token": refresh_token})
        
        assert response.status_code == status.HTTP_200_OK
