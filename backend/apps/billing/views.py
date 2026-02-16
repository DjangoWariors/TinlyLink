"""
Billing views for TinlyLink.
Stripe integration for subscriptions.
"""

import stripe
import logging
from datetime import datetime, timezone as dt_tz

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema

from django.db import models as db_models
from apps.users.models import Subscription
from .models import Plan

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class BillingOverviewView(APIView):
    """
    Get billing overview including subscription and invoices.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Billing"])
    def get(self, request):
        user = request.user
        subscription = getattr(user, "subscription", None)
        
        response_data = {
            "subscription": {
                "plan": subscription.plan if subscription else "free",
                "status": subscription.status if subscription else "active",
                "current_period_end": subscription.current_period_end if subscription else None,
                "cancel_at_period_end": subscription.cancel_at_period_end if subscription else False,
            },
            "invoices": [],
            "payment_method": None,
        }
        
        # Get Stripe data if customer exists
        if subscription and subscription.stripe_customer_id:
            try:
                # Get invoices
                invoices = stripe.Invoice.list(
                    customer=subscription.stripe_customer_id,
                    limit=10,
                )
                
                response_data["invoices"] = [
                    {
                        "id": inv.id,
                        "amount": inv.amount_paid / 100,
                        "currency": inv.currency.upper(),
                        "status": inv.status,
                        "date": datetime.fromtimestamp(inv.created, tz=dt_tz.utc),
                        "pdf_url": inv.invoice_pdf,
                    }
                    for inv in invoices.data
                ]
                
                # Get payment method
                customer = stripe.Customer.retrieve(
                    subscription.stripe_customer_id,
                    expand=["default_source"]
                )
                
                if customer.default_source:
                    pm = customer.default_source
                    response_data["payment_method"] = {
                        "type": pm.brand if hasattr(pm, "brand") else "card",
                        "last4": pm.last4 if hasattr(pm, "last4") else "****",
                        "exp_month": pm.exp_month if hasattr(pm, "exp_month") else None,
                        "exp_year": pm.exp_year if hasattr(pm, "exp_year") else None,
                    }
                    
            except stripe.error.StripeError as e:
                logger.error(f"Stripe error: {e}")
        
        return Response(response_data)


class CreateCheckoutSessionView(APIView):
    """
    Create Stripe Checkout session for subscription.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Billing"])
    def post(self, request):
        plan_slug = request.data.get("plan")

        # Validate plan exists and is subscribable
        plan_obj = Plan.objects.filter(
            slug=plan_slug, is_enabled=True, is_coming_soon=False
        ).exclude(slug="free").first()

        if not plan_obj:
            return Response(
                {"error": "Invalid plan"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        subscription = getattr(user, "subscription", None)

        # Get or create Stripe customer
        if subscription and subscription.stripe_customer_id:
            customer_id = subscription.stripe_customer_id
        else:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.full_name,
                metadata={"user_id": str(user.id)},
            )
            customer_id = customer.id

            if subscription:
                subscription.stripe_customer_id = customer_id
                subscription.save(update_fields=["stripe_customer_id"])

        # Get price ID from Plan model, fallback to settings
        price_id = plan_obj.stripe_monthly_price_id
        if not price_id:
            price_id = settings.STRIPE_PRODUCTS.get(plan_slug, {}).get("price_id")

        if not price_id:
            return Response(
                {"error": "Plan not configured"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create checkout session
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                mode="subscription",
                line_items=[{
                    "price": price_id,
                    "quantity": 1,
                }],
                success_url=f"{settings.FRONTEND_URL}/dashboard/settings/billing?success=true",
                cancel_url=f"{settings.FRONTEND_URL}/dashboard/settings/billing?canceled=true",
                metadata={
                    "user_id": str(user.id),
                    "plan": plan_slug,
                },
            )
            
            return Response({"checkout_url": session.url})
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating checkout: {e}")
            return Response(
                {"error": "Failed to create checkout session"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CreatePortalSessionView(APIView):
    """
    Create Stripe Customer Portal session for managing subscription.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Billing"])
    def post(self, request):
        user = request.user
        subscription = getattr(user, "subscription", None)
        
        if not subscription or not subscription.stripe_customer_id:
            return Response(
                {"error": "No billing account found"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            session = stripe.billing_portal.Session.create(
                customer=subscription.stripe_customer_id,
                return_url=f"{settings.FRONTEND_URL}/dashboard/settings/billing",
            )
            
            return Response({"portal_url": session.url})
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating portal: {e}")
            return Response(
                {"error": "Failed to create portal session"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class StripeWebhookView(APIView):
    """
    Handle Stripe webhooks.
    """
    permission_classes = [AllowAny]
    
    @csrf_exempt
    def post(self, request):
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
        
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            logger.error(f"Invalid webhook payload: {e}")
            return HttpResponse(status=400)
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            return HttpResponse(status=400)
        
        # Handle the event
        event_type = event["type"]
        data = event["data"]["object"]
        
        logger.info(f"Received Stripe webhook: {event_type}")
        
        try:
            if event_type == "checkout.session.completed":
                self._handle_checkout_completed(data)

            elif event_type == "customer.subscription.created":
                self._handle_subscription_created(data)

            elif event_type == "customer.subscription.updated":
                self._handle_subscription_updated(data)

            elif event_type == "customer.subscription.deleted":
                self._handle_subscription_deleted(data)

            elif event_type == "invoice.payment_failed":
                self._handle_payment_failed(data)

            elif event_type == "invoice.payment_succeeded":
                self._handle_payment_succeeded(data)

        except Subscription.DoesNotExist:
            # Could be a race condition (webhook arrived before DB commit).
            # Return 500 so Stripe retries — the subscription may exist on
            # the next attempt.
            logger.warning(f"Subscription not found while handling {event_type}, will retry")
            return HttpResponse(status=500)
        except Exception as e:
            logger.exception(f"Error handling webhook {event_type}: {e}")
            return HttpResponse(status=500)

        return HttpResponse(status=200)
    
    def _handle_checkout_completed(self, session):
        """Handle successful checkout."""
        user_id = session.get("metadata", {}).get("user_id")
        plan = session.get("metadata", {}).get("plan")
        subscription_id = session.get("subscription")
        customer_id = session.get("customer")

        if not user_id or not plan:
            logger.error("Missing user_id or plan in checkout metadata")
            return

        with transaction.atomic():
            subscription = Subscription.objects.select_for_update().get(user_id=user_id)
            subscription.plan = plan
            subscription.status = "active"
            subscription.stripe_customer_id = customer_id
            subscription.stripe_subscription_id = subscription_id
            subscription.save()

        logger.info(f"User {user_id} upgraded to {plan}")
    
    def _handle_subscription_created(self, sub):
        """Handle subscription creation."""
        customer_id = sub.get("customer")

        with transaction.atomic():
            subscription = Subscription.objects.select_for_update().get(
                stripe_customer_id=customer_id
            )
            subscription.stripe_subscription_id = sub.get("id")
            subscription.status = sub.get("status")
            subscription.current_period_start = datetime.fromtimestamp(
                sub.get("current_period_start"), tz=dt_tz.utc
            )
            subscription.current_period_end = datetime.fromtimestamp(
                sub.get("current_period_end"), tz=dt_tz.utc
            )
            subscription.save()
    
    def _handle_subscription_updated(self, sub):
        """Handle subscription update."""
        subscription_id = sub.get("id")

        with transaction.atomic():
            subscription = Subscription.objects.select_for_update().get(
                stripe_subscription_id=subscription_id
            )
            old_plan = subscription.plan
            subscription.status = sub.get("status")
            subscription.cancel_at_period_end = sub.get("cancel_at_period_end", False)
            subscription.current_period_start = datetime.fromtimestamp(
                sub.get("current_period_start"), tz=dt_tz.utc
            )
            subscription.current_period_end = datetime.fromtimestamp(
                sub.get("current_period_end"), tz=dt_tz.utc
            )

            # Update plan from price
            items = sub.get("items", {}).get("data", [])
            if items:
                price_id = items[0].get("price", {}).get("id")
                plan_obj = Plan.objects.filter(
                    db_models.Q(stripe_monthly_price_id=price_id)
                    | db_models.Q(stripe_yearly_price_id=price_id)
                ).first()
                if plan_obj:
                    subscription.plan = plan_obj.slug
                else:
                    # Fallback to hardcoded settings
                    for plan_key, plan_config in settings.STRIPE_PRODUCTS.items():
                        if plan_config.get("price_id") == price_id:
                            subscription.plan = plan_key
                            break

            subscription.save()

        # HIGH-01: If user downgraded, check if usage exceeds new plan limits
        new_plan = subscription.plan
        if old_plan != new_plan:
            new_limits = Plan.get_limits(new_plan)
            from apps.users.models import UsageTracking
            usage = UsageTracking.get_current_period(subscription.user)

            links_limit = new_limits.get("links_per_month", 50)
            qr_limit = new_limits.get("qr_codes_per_month", 10)

            if usage.links_created > links_limit or usage.qr_codes_created > qr_limit:
                from apps.users.tasks import send_usage_warning_email
                resource = "links" if usage.links_created > links_limit else "QR codes"
                percent = max(
                    int(usage.links_created / links_limit * 100) if links_limit else 0,
                    int(usage.qr_codes_created / qr_limit * 100) if qr_limit else 0,
                )
                send_usage_warning_email.delay(
                    str(subscription.user_id), resource, percent
                )

        logger.info(f"Subscription {subscription_id} updated")
    
    def _handle_subscription_deleted(self, sub):
        """Handle subscription cancellation."""
        subscription_id = sub.get("id")

        with transaction.atomic():
            subscription = Subscription.objects.select_for_update().get(
                stripe_subscription_id=subscription_id
            )
            subscription.plan = "free"
            subscription.status = "canceled"
            subscription.stripe_subscription_id = ""
            subscription.save()

        logger.info(f"Subscription {subscription_id} canceled")
    
    def _handle_payment_failed(self, invoice):
        """Handle failed payment."""
        customer_id = invoice.get("customer")

        with transaction.atomic():
            subscription = Subscription.objects.select_for_update().get(
                stripe_customer_id=customer_id
            )
            subscription.status = "past_due"
            subscription.save(update_fields=["status"])

        # Send notification email (outside transaction)
        from apps.users.tasks import send_payment_failed_email
        send_payment_failed_email.delay(str(subscription.user_id))

        logger.info(f"Payment failed for customer {customer_id}")
    
    def _handle_payment_succeeded(self, invoice):
        """Handle successful payment."""
        customer_id = invoice.get("customer")

        with transaction.atomic():
            subscription = Subscription.objects.select_for_update().get(
                stripe_customer_id=customer_id
            )
            if subscription.status == "past_due":
                subscription.status = "active"
                subscription.save(update_fields=["status"])

        logger.info(f"Payment succeeded for customer {customer_id}")


class PlansListView(APIView):
    """Public endpoint: list all enabled plans (including coming_soon)."""
    permission_classes = [AllowAny]

    @extend_schema(tags=["Billing"])
    def get(self, request):
        from django.core.cache import cache

        cached = cache.get("plans_list")
        if cached:
            return Response(cached)

        plans = Plan.objects.filter(is_enabled=True).order_by(
            "sort_order", "monthly_price"
        )
        data = [
            {
                "slug": p.slug,
                "name": p.name,
                "description": p.description,
                "is_coming_soon": p.is_coming_soon,
                "is_popular": p.is_popular,
                "badge_text": p.badge_text,
                "cta_text": p.cta_text,
                "features": p.features_json,
                "monthly_price": p.monthly_price,
                "yearly_price": p.yearly_price,
                "limits": p.to_limits_dict(),
            }
            for p in plans
        ]

        cache.set("plans_list", data, timeout=300)
        return Response(data)
