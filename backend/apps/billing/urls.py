"""
URL configuration for billing app.
"""

from django.urls import path

from .views import (
    BillingOverviewView, CreateCheckoutSessionView,
    CreatePortalSessionView, StripeWebhookView
)

urlpatterns = [
    path("", BillingOverviewView.as_view(), name="billing_overview"),
    path("checkout/", CreateCheckoutSessionView.as_view(), name="checkout"),
    path("portal/", CreatePortalSessionView.as_view(), name="portal"),
    path("webhook/", StripeWebhookView.as_view(), name="stripe_webhook"),
]
