"""
URL configuration for biolinks app.
"""

from django.urls import path

from .views import (
    BioPageListCreateView, BioPageDetailView, BioPageCheckSlugView,
    BioLinkListCreateView, BioLinkDetailView, BioLinkReorderView,
    LandingPageListCreateView, LandingPageDetailView,
    LandingPagePublishView, LandingPageDuplicateView,
    LandingPageTemplateListView,
    FormSubmissionListView, FormSubmissionExportView,
)

# Bio pages: /api/v1/bio/
bio_urlpatterns = [
    path("", BioPageListCreateView.as_view(), name="bio_page_list_create"),
    path("check-slug/", BioPageCheckSlugView.as_view(), name="bio_check_slug"),
    path("<uuid:pk>/", BioPageDetailView.as_view(), name="bio_page_detail"),
    path("<uuid:bio_page_id>/links/", BioLinkListCreateView.as_view(), name="bio_link_list_create"),
    path("<uuid:bio_page_id>/links/reorder/", BioLinkReorderView.as_view(), name="bio_link_reorder"),
    path("links/<uuid:pk>/", BioLinkDetailView.as_view(), name="bio_link_detail"),
]

# Landing pages: /api/v1/pages/
pages_urlpatterns = [
    path("", LandingPageListCreateView.as_view(), name="landing_page_list_create"),
    path("templates/", LandingPageTemplateListView.as_view(), name="landing_page_templates"),
    path("<uuid:pk>/", LandingPageDetailView.as_view(), name="landing_page_detail"),
    path("<uuid:pk>/publish/", LandingPagePublishView.as_view(), name="landing_page_publish"),
    path("<uuid:pk>/duplicate/", LandingPageDuplicateView.as_view(), name="landing_page_duplicate"),
    path("<uuid:pk>/submissions/", FormSubmissionListView.as_view(), name="landing_page_submissions"),
    path("<uuid:pk>/submissions/export/", FormSubmissionExportView.as_view(), name="landing_page_submissions_export"),
]
