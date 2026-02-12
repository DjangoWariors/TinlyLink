"""
Multi-destination content encoders: multi_url, app_store, social.

These types encode a redirect URL to a link-tree style landing page.
"""

from django.conf import settings

from ..schemas import MultiURLSchema, AppStoreLinksSchema, SocialHubSchema
from .base import BaseContentEncoder


class _LandingPageEncoder(BaseContentEncoder):
    """Base for types that redirect to a multi-link landing page."""

    def encode(self, data, **kwargs):
        qr = kwargs.get("qr")
        if qr and qr.is_dynamic and qr.short_code:
            return f"{settings.DEFAULT_SHORT_DOMAIN}/q/{qr.short_code}"
        return data.get("fallback_url", "")


class MultiURLEncoder(_LandingPageEncoder):
    qr_type = "multi_url"
    schema = MultiURLSchema


class AppStoreEncoder(_LandingPageEncoder):
    qr_type = "app_store"
    schema = AppStoreLinksSchema


class SocialEncoder(_LandingPageEncoder):
    qr_type = "social"
    schema = SocialHubSchema
