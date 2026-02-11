"""
Redirect views for handling short link redirections.
This is the critical path - must be fast!
"""

import json
from datetime import datetime

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponseRedirect, HttpResponseGone, HttpResponseNotFound
from django.shortcuts import render
from django.utils import timezone
from django.views import View

from apps.users.exceptions import LinkNotFound, LinkExpired, PasswordRequired, InvalidPassword
from apps.rules.engine import RuleEngine, get_rules_for_link
from .models import Link


class RedirectView(View):
    """
    Handle short link redirections.
    Critical path - optimized for speed.
    Supports campaign status checking and A/B testing variants.
    """

    def get(self, request, short_code):
        """Handle GET request for redirection."""
        # Determine domain
        host = request.get_host().lower()

        # Get link from cache or database
        link_data = Link.get_by_short_code(host, short_code)

        if not link_data:
            return self._render_404(request)

        # Check if active
        if not link_data.get("is_active", True):
            return self._render_404(request)

        # Check expiration
        expires_at = link_data.get("expires_at")
        if expires_at:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if timezone.now() > expires_at:
                return self._render_expired(request)

        # Check campaign status
        campaign_check = self._check_campaign(request, link_data)
        if campaign_check:
            return campaign_check

        # Check password protection
        if link_data.get("is_password_protected"):
            return self._render_password_form(request, short_code)

        # Evaluate conditional rules
        rule_result = self._evaluate_rules(request, link_data)
        if rule_result:
            return rule_result

        # Select variant for A/B testing (if any)
        destination, variant_id = self._select_destination(link_data)

        # Track click asynchronously
        self._track_click(request, link_data, variant_id)

        # Check if ads should be shown
        if link_data.get("show_ads", True):
            return self._render_interstitial(request, {**link_data, "destination_url": destination})

        # Redirect immediately for paid users
        return HttpResponseRedirect(destination)
    
    def post(self, request, short_code):
        """Handle POST request (password verification)."""
        host = request.get_host().lower()
        if ":" in host:
            host = host.split(":")[0]

        link_data = Link.get_by_short_code(host, short_code)

        if not link_data:
            return self._render_404(request)

        password = request.POST.get("password", "")

        # Verify password
        try:
            link = Link.objects.get(id=link_data["id"])
            if link.check_password(password):
                # Check campaign status
                campaign_check = self._check_campaign(request, link_data)
                if campaign_check:
                    return campaign_check

                # Evaluate conditional rules
                rule_result = self._evaluate_rules(request, link_data)
                if rule_result:
                    return rule_result

                # Select variant
                destination, variant_id = self._select_destination(link_data)

                # Track click
                self._track_click(request, link_data, variant_id)

                # Check ads
                if link_data.get("show_ads", True):
                    return self._render_interstitial(request, {**link_data, "destination_url": destination})

                return HttpResponseRedirect(destination)
            else:
                return self._render_password_form(request, short_code, error="Invalid password")
        except Link.DoesNotExist:
            return self._render_404(request)

    def _check_campaign(self, request, link_data):
        """
        Check if link's campaign is active.
        Returns a response if campaign is inactive, None otherwise.
        """
        campaign_id = link_data.get("campaign_id")
        if not campaign_id:
            return None

        from apps.campaigns.models import Campaign

        try:
            campaign = Campaign.objects.get(id=campaign_id)
        except Campaign.DoesNotExist:
            return None

        # Check if campaign is currently active
        if not campaign.is_currently_active:
            # Increment clicks even for inactive campaigns (for tracking)
            campaign.increment_clicks()

            # Return fallback or expired message
            if campaign.fallback_url:
                return HttpResponseRedirect(campaign.fallback_url)
            return self._render_campaign_expired(request, link_data, campaign)

        # Increment campaign clicks
        campaign.increment_clicks()

        # Check if this click exhausted the budget
        if campaign.click_budget:
            campaign.refresh_from_db(fields=["clicks_used"])
            if campaign.clicks_used >= campaign.click_budget:
                if campaign.fallback_url:
                    return HttpResponseRedirect(campaign.fallback_url)
                return self._render_campaign_expired(request, link_data, campaign)

        return None

    def _evaluate_rules(self, request, link_data):
        """
        Evaluate conditional rules for the link.
        Returns a response if a rule matches, None otherwise.
        """
        try:
            link = Link.objects.get(id=link_data["id"])
        except Link.DoesNotExist:
            return None

        # Get active rules for this link
        rules = get_rules_for_link(link, active_only=True)
        if not rules.exists():
            return None

        # Build context from request
        context = RuleEngine.build_context(request, link=link)

        # Evaluate rules
        result = RuleEngine.evaluate(rules, context)
        if not result:
            return None

        # Apply the matching action
        original_url = link_data.get("destination_url", link_data.get("original_url"))
        action_result = RuleEngine.apply_action(
            result["action"],
            result["value"],
            original_url
        )

        # Track click with rule info
        self._track_click(request, link_data, variant_id=None, rule_id=result.get("rule_id"))

        # Handle different action types
        if action_result["type"] == "redirect":
            redirect_url = action_result["url"]
            # Check if ads should be shown
            if link_data.get("show_ads", True):
                return self._render_interstitial(request, {**link_data, "destination_url": redirect_url})
            return HttpResponseRedirect(redirect_url)

        elif action_result["type"] == "block":
            from django.http import HttpResponseForbidden
            return HttpResponseForbidden(action_result.get("message", "Access denied"))

        elif action_result["type"] == "content":
            template = action_result.get("template", "links/custom_content.html")
            return render(request, template, action_result.get("data", {}))

        return None

    def _select_destination(self, link_data):
        """
        Select destination URL, considering A/B test variants.
        Returns (destination_url, variant_id or None).
        """
        from apps.campaigns.models import Variant, VariantSelector

        link_id = link_data.get("id")
        default_destination = link_data.get("destination_url", link_data.get("original_url"))

        # Check for active variants
        variants = list(Variant.objects.filter(link_id=link_id, is_active=True))
        if not variants:
            return default_destination, None

        # Select variant using weighted random
        variant = VariantSelector.select(variants)
        if variant:
            # Increment impression counter
            variant.increment_impressions()
            return variant.destination_url, str(variant.id)

        return default_destination, None

    def _track_click(self, request, link_data, variant_id=None, rule_id=None):
        """
        Queue click tracking to Celery.
        This must be async to not slow down redirects.
        """
        from .tasks import track_click

        # Extract click data
        click_data = {
            "link_id": link_data["id"],
            "campaign_id": link_data.get("campaign_id"),
            "variant_id": variant_id,
            "rule_id": rule_id,
            "clicked_at": timezone.now().isoformat(),
            "ip": self._get_client_ip(request),
            "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            "referer": request.META.get("HTTP_REFERER", ""),
        }

        # Queue to Celery (don't wait for result)
        track_click.delay(click_data)
    
    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
    
    def _render_404(self, request):
        """Render 404 page."""
        return render(request, "links/404.html", status=404)
    
    def _render_expired(self, request):
        """Render expired link page."""
        return render(request, "links/expired.html", status=410)

    def _render_campaign_expired(self, request, link_data, campaign):
        """Render campaign expired page."""
        return render(request, "links/expired.html", {
            "message": campaign.expired_message or "This campaign has ended.",
            "campaign_name": campaign.name,
        }, status=410)
    
    def _render_password_form(self, request, short_code, error=None):
        """Render password form."""
        return render(request, "links/password.html", {
            "short_code": short_code,
            "error": error,
        })
    
    def _render_interstitial(self, request, link_data):
        """Render interstitial page with ad."""
        return render(request, "links/interstitial.html", {
            "destination_url": link_data.get("destination_url", link_data.get("original_url")),
            "wait_time": settings.INTERSTITIAL_DURATION,
            "adsense_client": settings.ADSENSE_CLIENT_ID,
            "adsense_slot": settings.ADSENSE_SLOT_ID,
        })


class HealthCheckView(View):
    """
    Health check endpoint for load balancers.
    """
    
    def get(self, request):
        """Return health status."""
        from django.http import JsonResponse
        
        # Check database
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception as e:
            return JsonResponse({"status": "unhealthy", "database": str(e)}, status=503)
        
        # Check cache
        try:
            cache.set("health_check", "ok", timeout=10)
            if cache.get("health_check") != "ok":
                raise Exception("Cache read failed")
        except Exception as e:
            return JsonResponse({"status": "unhealthy", "cache": str(e)}, status=503)
        
        return JsonResponse({"status": "healthy"})
