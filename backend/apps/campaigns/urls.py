"""
URL configuration for campaigns app.
"""

from django.urls import path

from .views import (
    CampaignListCreateView, CampaignDetailView,
    CampaignLinksView, CampaignStatsView,
    CampaignCompareView, CampaignTemplatesView,
    CampaignActivateView, CampaignPauseView, CampaignDuplicateView,
    LinkVariantListCreateView, VariantDetailView,
    VariantSetWinnerView, VariantStatsView,
    QRCodeVariantListCreateView,
)

urlpatterns = [
    # Campaign CRUD
    path("", CampaignListCreateView.as_view(), name="campaign_list_create"),
    path("compare/", CampaignCompareView.as_view(), name="campaign_compare"),
    path("templates/", CampaignTemplatesView.as_view(), name="campaign_templates"),
    path("<uuid:pk>/", CampaignDetailView.as_view(), name="campaign_detail"),
    path("<uuid:pk>/links/", CampaignLinksView.as_view(), name="campaign_links"),
    path("<uuid:pk>/stats/", CampaignStatsView.as_view(), name="campaign_stats"),

    # Campaign actions
    path("<uuid:pk>/activate/", CampaignActivateView.as_view(), name="campaign_activate"),
    path("<uuid:pk>/pause/", CampaignPauseView.as_view(), name="campaign_pause"),
    path("<uuid:pk>/duplicate/", CampaignDuplicateView.as_view(), name="campaign_duplicate"),

    # Variant endpoints for links
    path("links/<uuid:link_id>/variants/", LinkVariantListCreateView.as_view(), name="link_variants"),
    path("links/<uuid:link_id>/variants/stats/", VariantStatsView.as_view(), name="link_variant_stats"),

    # Variant endpoints for QR codes
    path("qr-codes/<uuid:qr_id>/variants/", QRCodeVariantListCreateView.as_view(), name="qr_variants"),

    # Variant detail
    path("variants/<uuid:pk>/", VariantDetailView.as_view(), name="variant_detail"),
    path("variants/<uuid:pk>/set-winner/", VariantSetWinnerView.as_view(), name="variant_set_winner"),
]
