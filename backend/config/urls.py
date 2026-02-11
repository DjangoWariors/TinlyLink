"""
URL Configuration for TinlyLink
"""

from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.urls import path, include
from apps.public.sitemaps import StaticViewSitemap, BlogPostSitemap
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from apps.public.views import VerifyAPIView
from apps.qrcodes.views import DynamicQRRedirectView
from config.health import HealthCheckView, ReadinessCheckView, LivenessCheckView, MetricsView

urlpatterns = [
    # Health Checks
    path("health/", HealthCheckView.as_view(), name="health"),
    path("ready/", ReadinessCheckView.as_view(), name="ready"),
    path("live/", LivenessCheckView.as_view(), name="live"),
    path("metrics/", MetricsView.as_view(), name="metrics"),
    
    # Admin
    path("admin/", admin.site.urls),
    
    # API v1
    path("api/v1/auth/", include("apps.users.urls.auth")),
    path("api/v1/account/", include("apps.users.urls.account")),
    path("api/v1/links/", include("apps.links.urls")),
    path("api/v1/qr-codes/", include("apps.qrcodes.urls")),
    path("api/v1/analytics/", include("apps.analytics.urls")),
    path("api/v1/campaigns/", include("apps.campaigns.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),
    path("api/v1/teams/", include("apps.teams.urls")),
    path("api/v1/rules/", include("apps.rules.urls")),

    # Public API under v1 (no auth required)
    path("api/v1/verify/", VerifyAPIView.as_view(), name="verify_api_v1"),
    
    # API Documentation
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/", SpectacularRedocView.as_view(url_name="schema"), name="api"),
    #path("api/redoc", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    
    # Public Pages (Landing, Pricing, Blog, etc.)
    path("", include("apps.public.urls")),

    # SEO
    path(
        "sitemap.xml",
        sitemap,
        {"sitemaps": {"static": StaticViewSitemap, "blog": BlogPostSitemap}},
        name="django.contrib.sitemaps.views.sitemap",
    ),
    
    # Dynamic QR redirect
    path("q/<str:short_code>", DynamicQRRedirectView.as_view(), name="dynamic_qr_redirect"),

    # Redirect handler - must be last (catches short codes)
    path("", include("apps.links.urls_redirect")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Admin site customization
admin.site.site_header = "TinlyLink Administration"
admin.site.site_title = "TinlyLink Admin"
admin.site.index_title = "Dashboard"
