import hashlib

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.views.generic import TemplateView, FormView, RedirectView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .forms import ContactForm
from .tasks import send_contact_email


class SEOViewMixin:
    """Mixin that passes SEO context variables to templates."""
    page_title = "TinlyLink - URL Shortener & QR Code Generator"
    page_description = "Shorten links, generate QR codes, and track analytics."
    page_og_image = "/static/images/og-image.png"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["page_title"] = self.page_title
        context["page_description"] = self.page_description
        context["page_og_image"] = self.page_og_image
        return context


class LandingView(SEOViewMixin, TemplateView):
    template_name = "public/landing.html"
    page_title = "TinlyLink - URL Shortener & QR Code Generator"
    page_description = "Shorten links, generate QR codes, and track performance with powerful analytics. The complete link management platform for modern marketers."


class PricingView(SEOViewMixin, TemplateView):
    template_name = "public/pricing.html"
    page_title = "Pricing - TinlyLink"
    page_description = "Flexible pricing plans for everyone. From free personal use to enterprise-grade link management solutions."

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        from apps.billing.models import Plan

        cached = cache.get("pricing_page_plans")
        if cached is None:
            plans = list(
                Plan.objects.filter(is_enabled=True)
                .order_by("sort_order", "monthly_price")
                .values(
                    "slug", "name", "description", "is_coming_soon", "is_popular",
                    "badge_text", "cta_text", "features_json", "monthly_price",
                    "yearly_price",
                    "links_per_month", "qr_codes_per_month", "api_calls_per_month",
                    "custom_domains", "analytics_retention_days", "team_members",
                    "custom_slugs", "password_protection", "priority_support", "sso",
                )
            )
            # Pre-compute display prices for the template
            for p in plans:
                p["monthly_display"] = p["monthly_price"] / 100
                p["yearly_display"] = p["yearly_price"] / 100
                p["yearly_monthly_display"] = round(p["yearly_price"] / 100 / 12, 2) if p["yearly_price"] else 0
            cached = plans
            cache.set("pricing_page_plans", cached, timeout=300)

        context["plans"] = cached
        return context


class FeaturesView(SEOViewMixin, TemplateView):
    template_name = "public/features.html"
    page_title = "Features - TinlyLink"
    page_description = "Explore our powerful features: Custom URL shortening, QR code generation, detailed analytics, custom domains, and more."


class BlogView(SEOViewMixin, TemplateView):
    template_name = "public/blog.html"
    page_title = "Blog - Marketing Tips & Updates"
    page_description = "Latest insights, updates, and guides on link management, QR codes, and digital marketing strategies."


class AboutView(SEOViewMixin, TemplateView):
    template_name = "public/about.html"
    page_title = "About - TinlyLink"
    page_description = "Learn about TinlyLink's mission to simplify link management for marketers, developers, and businesses worldwide."


class UseCasesView(SEOViewMixin, TemplateView):
    template_name = "public/use-cases.html"
    page_title = "Use Cases - TinlyLink"
    page_description = "Discover how marketers, developers, and businesses use TinlyLink for campaign tracking, API integration, and branded short links."


class TermsView(SEOViewMixin, TemplateView):
    template_name = "public/terms.html"
    page_title = "Terms of Service - TinlyLink"
    page_description = "Terms of Service for TinlyLink. Read about acceptable use, billing, data ownership, and your rights when using our URL shortener and QR code generator."


class PrivacyView(SEOViewMixin, TemplateView):
    template_name = "public/privacy.html"
    page_title = "Privacy Policy - TinlyLink"
    page_description = "Privacy Policy for TinlyLink. Learn what data we collect, how we use it, and how we protect your information."


class ContactView(SEOViewMixin, FormView):
    template_name = "public/contact.html"
    form_class = ContactForm
    page_title = "Contact Us - TinlyLink"
    page_description = "Get in touch with the TinlyLink team. We're here to help with questions about our URL shortener, QR code generator, billing, partnerships, and more."

    def form_valid(self, form):
        # Simple IP-based rate limit: 3 submissions per hour
        ip = self.request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or self.request.META.get("REMOTE_ADDR")
        cache_key = f"contact_rate:{ip}"
        submissions = cache.get(cache_key, 0)
        if submissions >= 3:
            form.add_error(None, "You have sent too many messages. Please try again later.")
            return self.form_invalid(form)

        cache.set(cache_key, submissions + 1, 3600)

        send_contact_email.delay(
            name=form.cleaned_data["name"],
            email=form.cleaned_data["email"],
            subject=form.cleaned_data["subject"],
            message=form.cleaned_data["message"],
        )
        context = self.get_context_data(form=ContactForm(), success=True)
        return self.render_to_response(context)


class BlogPostView(SEOViewMixin, TemplateView):
    """Generic view for individual blog posts. Template and SEO metadata are set via url config."""
    pass


class RedirectToFrontendView(RedirectView):
    """
    Redirects to the frontend application (React).
    Useful for development or when Django is the entry point.
    """
    def get_redirect_url(self, *args, **kwargs):
        # Preserve the path
        path = self.request.path.lstrip("/")
        return f"{settings.FRONTEND_URL}/{path}"


# =============================================================================
# PRODUCT VERIFICATION
# =============================================================================

class VerificationRateThrottle(AnonRateThrottle):
    """Rate limit for verification API: 60 requests per hour."""
    rate = "60/hour"


class VerifyAPIView(APIView):
    """
    Public API for verifying serialized QR codes.
    No authentication required - rate limited.
    """
    permission_classes = []
    throttle_classes = [VerificationRateThrottle]

    def post(self, request):
        """
        Verify a serial number and record the scan.

        Request body:
        - serial: The serial number to verify (required)
        - location: Optional location data {lat, lng, city, country}

        Returns verification status and product info.
        """
        from apps.qrcodes.models import SerialCode
        from apps.qrcodes.tasks import track_qr_scan
        from apps.links.tasks import parse_user_agent, get_geo_from_ip

        serial = request.data.get("serial", "").strip().upper()
        location_data = request.data.get("location", {})

        if not serial:
            return Response({
                "valid": False,
                "status": "error",
                "message": "Serial number is required.",
            }, status=400)

        # Look up serial code
        try:
            serial_code = SerialCode.objects.select_related(
                "qr_code", "batch"
            ).get(serial_number=serial)
        except SerialCode.DoesNotExist:
            return Response({
                "valid": False,
                "status": "invalid",
                "message": "This product code is not recognized. It may be counterfeit.",
                "serial": serial,
            })

        # Check status
        if serial_code.status == "blocked":
            return Response({
                "valid": False,
                "status": "blocked",
                "message": "This product has been flagged as potentially counterfeit.",
                "serial": serial,
            })

        if serial_code.status == "recalled":
            return Response({
                "valid": False,
                "status": "recalled",
                "message": "This product has been recalled. Please contact the manufacturer.",
                "serial": serial,
                "recall_info": serial_code.metadata.get("recall_info"),
            })

        if serial_code.status == "expired":
            return Response({
                "valid": False,
                "status": "expired",
                "message": "This product has expired.",
                "serial": serial,
                "expiry_date": str(serial_code.batch.expiry_date) if serial_code.batch.expiry_date else None,
            })

        # Get IP and user agent for tracking
        ip = self._get_client_ip(request)
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()
        user_agent = request.META.get("HTTP_USER_AGENT", "")

        # Parse geo data if not provided
        if not location_data:
            location_data = get_geo_from_ip(ip)

        # Parse device data
        device_data = parse_user_agent(user_agent)

        # Record the scan
        is_first, suspicion_score = serial_code.record_scan(
            ip_hash=ip_hash,
            location_data=location_data,
            device_data=device_data
        )

        # Track scan event asynchronously
        track_qr_scan.delay({
            "qr_id": str(serial_code.qr_code_id),
            "scanned_at": timezone.now().isoformat(),
            "ip": ip,
            "user_agent": user_agent,
            "referer": request.META.get("HTTP_REFERER", ""),
            "is_verification": True,
            "serial_number": serial,
        })

        # Prepare response
        product_info = serial_code.product_info

        # Determine message based on status
        if serial_code.status == "active":
            if is_first:
                message = "✓ This product is authentic. This is the first time it has been verified."
            else:
                message = "✓ This product is authentic."
        elif serial_code.status == "suspicious":
            message = "⚠ This product requires additional verification. Unusual scan patterns detected."
        else:
            message = "Product verified."

        response_data = {
            "valid": True,
            "status": serial_code.status,
            "message": message,
            "serial": serial,
            "is_first_scan": is_first,
            "product": {
                "name": product_info.get("name"),
                "sku": product_info.get("sku"),
                "category": product_info.get("category"),
                "manufacture_date": str(product_info.get("manufacture_date")) if product_info.get("manufacture_date") else None,
                "expiry_date": str(product_info.get("expiry_date")) if product_info.get("expiry_date") else None,
            },
            "scan_info": {
                "total_scans": serial_code.total_scans,
                "first_scan_date": serial_code.first_scanned_at.isoformat() if serial_code.first_scanned_at else None,
                "first_scan_location": serial_code.first_scan_location if not is_first else None,
            },
        }

        # Add warning for suspicious codes
        if serial_code.status == "suspicious":
            response_data["warning"] = {
                "score": serial_code.suspicion_score,
                "reasons": serial_code.suspicion_reasons,
            }

        return Response(response_data)

    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")


class VerifyPageView(SEOViewMixin, TemplateView):
    """
    Public verification page for QR code scans.
    Displays verification result with product info.
    """
    template_name = "public/verify.html"
    page_title = "Product Verification - TinlyLink"
    page_description = "Verify product authenticity by scanning the QR code or entering the serial number."

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        serial = self.kwargs.get("serial", "").strip().upper()
        context["serial"] = serial

        if serial:
            # Look up and verify the serial
            from apps.qrcodes.models import SerialCode
            from apps.links.tasks import parse_user_agent, get_geo_from_ip

            try:
                serial_code = SerialCode.objects.select_related(
                    "qr_code", "batch"
                ).get(serial_number=serial)

                # Get IP and user agent for tracking
                ip = self._get_client_ip(self.request)
                ip_hash = hashlib.sha256(ip.encode()).hexdigest()
                user_agent = self.request.META.get("HTTP_USER_AGENT", "")

                # Parse geo and device data
                location_data = get_geo_from_ip(ip)
                device_data = parse_user_agent(user_agent)

                # Record the scan
                is_first, suspicion_score = serial_code.record_scan(
                    ip_hash=ip_hash,
                    location_data=location_data,
                    device_data=device_data
                )

                # Track scan event asynchronously
                from apps.qrcodes.tasks import track_qr_scan
                track_qr_scan.delay({
                    "qr_id": str(serial_code.qr_code_id),
                    "scanned_at": timezone.now().isoformat(),
                    "ip": ip,
                    "user_agent": user_agent,
                    "referer": self.request.META.get("HTTP_REFERER", ""),
                    "is_verification": True,
                    "serial_number": serial,
                })

                context["found"] = True
                context["valid"] = serial_code.status == "active"
                context["status"] = serial_code.status
                context["is_first_scan"] = is_first
                context["product"] = serial_code.product_info
                context["scan_count"] = serial_code.total_scans
                context["first_scan_date"] = serial_code.first_scanned_at
                context["first_scan_location"] = serial_code.first_scan_location
                context["suspicion_score"] = serial_code.suspicion_score
                context["suspicion_reasons"] = serial_code.suspicion_reasons

                # Status-specific messages
                if serial_code.status == "blocked":
                    context["status_message"] = "This product has been flagged as potentially counterfeit."
                elif serial_code.status == "recalled":
                    context["status_message"] = "This product has been recalled. Please contact the manufacturer."
                    context["recall_info"] = serial_code.metadata.get("recall_info")
                elif serial_code.status == "expired":
                    context["status_message"] = "This product has expired."
                elif serial_code.status == "suspicious":
                    context["status_message"] = "This product requires additional verification."
                else:
                    if is_first:
                        context["status_message"] = "This product is authentic. This is the first verification."
                    else:
                        context["status_message"] = "This product is authentic."

            except SerialCode.DoesNotExist:
                context["found"] = False
                context["valid"] = False
                context["status_message"] = "This product code is not recognized. It may be counterfeit."

        return context

    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
