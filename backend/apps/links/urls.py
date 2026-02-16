"""
URL configuration for links API.
"""

from django.urls import path

from .views import (
    LinkListCreateView, LinkDetailView, LinkStatsView,
    LinkDuplicateView, BulkCreateLinksView, PublicLinkCreateView,
    CustomDomainListCreateView, CustomDomainDetailView, CustomDomainVerifyView,
    BulkDeleteLinksView, BulkMoveLinksView, BulkExportLinksView,
    CheckSlugAvailabilityView,
    PixelListCreateView, PixelDetailView,
)
from .views_import_export import (
    LinksExportView, LinksImportView, LinksImportTemplateView
)

urlpatterns = [
    # Links
    path("", LinkListCreateView.as_view(), name="link_list_create"),
    path("public/", PublicLinkCreateView.as_view(), name="public_link_create"),
    path("bulk/", BulkCreateLinksView.as_view(), name="bulk_create_links"),
    path("export/", LinksExportView.as_view(), name="links_export"),
    path("import/", LinksImportView.as_view(), name="links_import"),
    path("import/template/", LinksImportTemplateView.as_view(), name="links_import_template"),
    
    # Bulk Operations
    path("bulk/delete/", BulkDeleteLinksView.as_view(), name="bulk_delete_links"),
    path("bulk/move/", BulkMoveLinksView.as_view(), name="bulk_move_links"),
    path("bulk/export/", BulkExportLinksView.as_view(), name="bulk_export_links"),
    
    path("check-slug/", CheckSlugAvailabilityView.as_view(), name="check_slug"),
    path("<uuid:pk>/", LinkDetailView.as_view(), name="link_detail"),
    path("<uuid:pk>/stats/", LinkStatsView.as_view(), name="link_stats"),
    path("<uuid:pk>/duplicate/", LinkDuplicateView.as_view(), name="link_duplicate"),
    
    # Custom Domains
    path("domains/", CustomDomainListCreateView.as_view(), name="domain_list_create"),
    path("domains/<uuid:pk>/", CustomDomainDetailView.as_view(), name="domain_detail"),
    path("domains/<uuid:pk>/verify/", CustomDomainVerifyView.as_view(), name="domain_verify"),

    # Retargeting Pixels
    path("pixels/", PixelListCreateView.as_view(), name="pixel_list_create"),
    path("pixels/<uuid:pk>/", PixelDetailView.as_view(), name="pixel_detail"),
]
