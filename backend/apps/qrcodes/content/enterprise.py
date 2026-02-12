"""
Enterprise content encoders: serial.
"""

from django.conf import settings

from ..schemas import SerializedProductSchema
from .base import BaseContentEncoder


class SerialEncoder(BaseContentEncoder):
    qr_type = "serial"
    schema = SerializedProductSchema

    def encode(self, data, **kwargs):
        qr = kwargs.get("qr")
        if qr and qr.is_dynamic and qr.short_code:
            return f"{settings.DEFAULT_SHORT_DOMAIN}/verify/{qr.short_code}"
        serial_number = data.get("serial_number", "")
        return f"{settings.DEFAULT_SHORT_DOMAIN}/verify/{serial_number}"
