"""
Tests for billing app - Stripe integration and subscription management.
"""

import json
import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework import status


# =============================================================================
# BILLING OVERVIEW TESTS
# =============================================================================

@pytest.mark.django_db
class TestBillingOverview:
    """Tests for billing overview."""
    
    def test_get_billing_overview(self, authenticated_client, user):
        """Test getting billing overview."""
        url = "/api/v1/billing/"
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "subscription" in response.data
        assert response.data["subscription"]["plan"] == "free"
    
    def test_get_billing_overview_unauthenticated(self, api_client):
        """Test billing overview requires authentication."""
        url = "/api/v1/billing/"
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# CHECKOUT SESSION TESTS
# =============================================================================

@pytest.mark.django_db
class TestCheckoutSession:
    """Tests for creating checkout sessions."""
    
    @patch('stripe.Customer.create')
    @patch('stripe.checkout.Session.create')
    def test_create_checkout_session(self, mock_session, mock_customer, authenticated_client):
        """Test creating a checkout session."""
        mock_customer.return_value = MagicMock(id='cus_test123')
        mock_session.return_value = MagicMock(url='https://checkout.stripe.com/test')
        
        url = "/api/v1/billing/checkout/"
        data = {"plan": "pro"}
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_200_OK
        assert "checkout_url" in response.data
    
    def test_create_checkout_invalid_plan(self, authenticated_client):
        """Test checkout with invalid plan."""
        url = "/api/v1/billing/checkout/"
        data = {"plan": "invalid"}
        
        response = authenticated_client.post(url, data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# =============================================================================
# WEBHOOK TESTS
# =============================================================================

@pytest.mark.django_db
class TestStripeWebhook:
    """Tests for Stripe webhook handling."""
    
    @patch('stripe.Webhook.construct_event')
    def test_webhook_checkout_completed(self, mock_construct, api_client, user):
        """Test handling checkout.session.completed webhook."""
        from apps.users.models import Subscription
        
        # Create subscription for user
        Subscription.objects.create(user=user, plan="free")
        
        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "metadata": {
                        "user_id": str(user.id),
                        "plan": "pro",
                    },
                    "customer": "cus_test123",
                    "subscription": "sub_test123",
                }
            }
        }
        
        url = "/api/v1/billing/webhook/"
        
        response = api_client.post(
            url,
            data="{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="test_signature"
        )
        
        assert response.status_code == status.HTTP_200_OK
    
    @patch('stripe.Webhook.construct_event')
    def test_webhook_invalid_signature(self, mock_construct, api_client):
        """Test webhook with invalid signature."""
        import stripe
        mock_construct.side_effect = stripe.error.SignatureVerificationError(
            "Invalid signature", "sig"
        )
        
        url = "/api/v1/billing/webhook/"
        
        response = api_client.post(
            url,
            data="{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="invalid_signature"
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# =============================================================================
# CUSTOMER PORTAL TESTS
# =============================================================================

@pytest.mark.django_db
class TestCustomerPortal:
    """Tests for Stripe Customer Portal."""
    
    def test_portal_no_billing_account(self, authenticated_client, user):
        """Test portal session when user has no billing account."""
        url = "/api/v1/billing/portal/"
        
        response = authenticated_client.post(url)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    @patch('stripe.billing_portal.Session.create')
    def test_portal_with_billing_account(self, mock_portal, pro_authenticated_client, pro_user):
        """Test creating portal session."""
        from apps.users.models import Subscription
        
        # Update subscription with Stripe ID
        sub = Subscription.objects.get(user=pro_user)
        sub.stripe_customer_id = "cus_test123"
        sub.save()
        
        mock_portal.return_value = MagicMock(url='https://billing.stripe.com/test')
        
        url = "/api/v1/billing/portal/"
        
        response = pro_authenticated_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert "portal_url" in response.data
