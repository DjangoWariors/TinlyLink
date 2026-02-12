"""
Content engine registry.

Public API:
    encode_content(qr_type, data, qr=None) -> str
    validate_content_data(qr_type, data) -> dict
"""

from .base import BaseContentEncoder
from .basic import (
    VCardEncoder, WiFiEncoder, EmailEncoder, SMSEncoder,
    CalendarEncoder, LocationEncoder,
)
from .payment import UPIEncoder, PixEncoder
from .business import ProductEncoder, MenuEncoder, DocumentEncoder, PDFEncoder
from .multi import MultiURLEncoder, AppStoreEncoder, SocialEncoder
from .enterprise import SerialEncoder

_ENCODERS: dict[str, BaseContentEncoder] = {}


def _register(enc: BaseContentEncoder):
    _ENCODERS[enc.qr_type] = enc


_register(VCardEncoder())
_register(WiFiEncoder())
_register(EmailEncoder())
_register(SMSEncoder())
_register(CalendarEncoder())
_register(LocationEncoder())
_register(UPIEncoder())
_register(PixEncoder())
_register(ProductEncoder())
_register(MenuEncoder())
_register(DocumentEncoder())
_register(PDFEncoder())
_register(MultiURLEncoder())
_register(AppStoreEncoder())
_register(SocialEncoder())
_register(SerialEncoder())


def encode_content(qr_type: str, data: dict, **kwargs) -> str:
    """Encode content_data into a QR content string.

    ``kwargs`` may include ``qr`` (the QRCode model instance) for
    types that need access to dynamic short_code.
    """
    encoder = _ENCODERS.get(qr_type)
    if encoder is None:
        # Types without encoders (link, text, phone) handled elsewhere
        return ""
    return encoder.encode(data, **kwargs)


def validate_content_data(qr_type: str, data: dict) -> dict:
    """Validate content_data against the appropriate encoder's schema.

    Returns validated (and sanitized) data, or raises ValidationError.
    """
    encoder = _ENCODERS.get(qr_type)
    if encoder is None:
        return data  # pass-through for types without schema
    return encoder.validate(data)


__all__ = ["encode_content", "validate_content_data"]
