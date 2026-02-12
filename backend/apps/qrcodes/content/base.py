"""
Base content encoder interface.
"""

from abc import ABC, abstractmethod
from rest_framework import serializers


class BaseContentEncoder(ABC):
    """Abstract content encoder for a QR type."""

    @property
    @abstractmethod
    def qr_type(self) -> str:
        """The QR type identifier (matches TYPE_CHOICES)."""

    @property
    @abstractmethod
    def schema(self) -> type[serializers.Serializer]:
        """DRF Serializer class for validating content_data."""

    @abstractmethod
    def encode(self, data: dict, **kwargs) -> str:
        """Encode validated data into the QR content string."""

    def validate(self, data: dict) -> dict:
        """Validate and normalize content_data. Returns validated dict."""
        from ..schemas import _sanitize_decimals
        ser = self.schema(data=data)
        ser.is_valid(raise_exception=True)
        return _sanitize_decimals(ser.validated_data)
