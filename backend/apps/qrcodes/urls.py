"""
URL configuration for QR codes API.
"""

from django.urls import path

from .views import (
    QRCodeListCreateView, QRCodeDetailView, QRCodeDownloadView,
    QRCodePreviewView, QRCodeBatchDownloadView, QRCodeFramedDownloadView,
    # Serial Batch views
    SerialBatchListCreateView, SerialBatchDetailView, SerialBatchProgressView,
    SerialBatchStartView, SerialBatchCancelView, SerialBatchDownloadView,
    SerialBatchStatsView,
    # Serial Code views
    SerialCodeListView, SerialCodeDetailView, SerialCodeUpdateStatusView,
    SerialCodeLookupView,
)

urlpatterns = [
    # QR Codes
    path("", QRCodeListCreateView.as_view(), name="qr_list_create"),
    path("preview/", QRCodePreviewView.as_view(), name="qr_preview"),
    path("batch/download/", QRCodeBatchDownloadView.as_view(), name="qr_batch_download"),
    path("<uuid:pk>/", QRCodeDetailView.as_view(), name="qr_detail"),
    path("<uuid:pk>/download/", QRCodeDownloadView.as_view(), name="qr_download"),
    path("<uuid:pk>/framed/", QRCodeFramedDownloadView.as_view(), name="qr_framed_download"),

    # Serial Batches
    path("serial-batches/", SerialBatchListCreateView.as_view(), name="serial_batch_list_create"),
    path("serial-batches/<uuid:pk>/", SerialBatchDetailView.as_view(), name="serial_batch_detail"),
    path("serial-batches/<uuid:pk>/progress/", SerialBatchProgressView.as_view(), name="serial_batch_progress"),
    path("serial-batches/<uuid:pk>/start/", SerialBatchStartView.as_view(), name="serial_batch_start"),
    path("serial-batches/<uuid:pk>/cancel/", SerialBatchCancelView.as_view(), name="serial_batch_cancel"),
    path("serial-batches/<uuid:pk>/download/", SerialBatchDownloadView.as_view(), name="serial_batch_download"),
    path("serial-batches/<uuid:pk>/stats/", SerialBatchStatsView.as_view(), name="serial_batch_stats"),
    path("serial-batches/<uuid:batch_id>/codes/", SerialCodeListView.as_view(), name="serial_code_list"),

    # Serial Codes
    path("serial-codes/lookup/", SerialCodeLookupView.as_view(), name="serial_code_lookup"),
    path("serial-codes/<str:serial>/", SerialCodeDetailView.as_view(), name="serial_code_detail"),
    path("serial-codes/<uuid:pk>/status/", SerialCodeUpdateStatusView.as_view(), name="serial_code_update_status"),
]
