"""
Business/product content encoders: product, menu, document, pdf.

These types use dynamic redirect URLs — the QR encodes a short URL
pointing to a landing page, not inline content.
"""

from django.conf import settings

from ..schemas import ProductInfoSchema, MenuSchema, DocumentSchema, PDFDocumentSchema
from .base import BaseContentEncoder


class _DynamicRedirectEncoder(BaseContentEncoder):
    """Base for types that encode a redirect URL, not inline data."""

    def encode(self, data, **kwargs):
        qr = kwargs.get("qr")
        if qr and qr.is_dynamic and qr.short_code:
            return f"{settings.DEFAULT_SHORT_DOMAIN}/q/{qr.short_code}"
        return data.get("url", "") or data.get("file_url", "") or data.get("pdf_url", "")


class ProductEncoder(_DynamicRedirectEncoder):
    qr_type = "product"
    schema = ProductInfoSchema


class MenuEncoder(_DynamicRedirectEncoder):
    qr_type = "menu"
    schema = MenuSchema

    def encode(self, data, **kwargs):
        qr = kwargs.get("qr")
        if qr and qr.is_dynamic and qr.short_code:
            return f"{settings.DEFAULT_SHORT_DOMAIN}/q/{qr.short_code}"
        return data.get("menu_url", "")


class DocumentEncoder(_DynamicRedirectEncoder):
    qr_type = "document"
    schema = DocumentSchema


class PDFEncoder(_DynamicRedirectEncoder):
    qr_type = "pdf"
    schema = PDFDocumentSchema
