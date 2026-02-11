"""
URL configuration for analytics API.
"""

from django.urls import path

from .views import (
    AnalyticsOverviewView, AnalyticsClicksView, AnalyticsGeographyView,
    AnalyticsDevicesView, AnalyticsReferrersView, AnalyticsExportView,
    AnalyticsRealtimeView, AnalyticsCompareView, AnalyticsTopLinksView,
    # Phase 1: Unified Analytics
    UnifiedAnalyticsView, LinkAnalyticsView, QRCodeAnalyticsView,
    CampaignAnalyticsView, TopQRCodesView,
)

urlpatterns = [
    # Legacy endpoints (kept for backwards compatibility)
    path("overview/", AnalyticsOverviewView.as_view(), name="analytics_overview"),
    path("clicks/", AnalyticsClicksView.as_view(), name="analytics_clicks"),
    path("geography/", AnalyticsGeographyView.as_view(), name="analytics_geography"),
    path("devices/", AnalyticsDevicesView.as_view(), name="analytics_devices"),
    path("referrers/", AnalyticsReferrersView.as_view(), name="analytics_referrers"),
    path("export/", AnalyticsExportView.as_view(), name="analytics_export"),
    path("realtime/", AnalyticsRealtimeView.as_view(), name="analytics_realtime"),
    path("compare/", AnalyticsCompareView.as_view(), name="analytics_compare"),
    path("top-links/", AnalyticsTopLinksView.as_view(), name="analytics_top_links"),

    # Phase 1: Unified Analytics API
    path("unified/", UnifiedAnalyticsView.as_view(), name="analytics_unified"),
    path("links/<uuid:link_id>/", LinkAnalyticsView.as_view(), name="analytics_link"),
    path("qr-codes/<uuid:qr_id>/", QRCodeAnalyticsView.as_view(), name="analytics_qr"),
    path("campaigns/<uuid:campaign_id>/", CampaignAnalyticsView.as_view(), name="analytics_campaign"),
    path("top-qr-codes/", TopQRCodesView.as_view(), name="analytics_top_qr_codes"),
]
