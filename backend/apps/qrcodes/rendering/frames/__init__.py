"""
Frame registry — get_frame(name) returns a BaseFrame subclass instance.
"""

from .base import BaseFrame
from .simple import SimpleFrame, ScanMeFrame
from .decorative import (
    BalloonFrame, BadgeFrame, PolaroidFrame, TicketFrame,
    CardFrame, TagFrame, CertificateFrame,
)
from .mockup import PhoneFrame, LaptopFrame

_REGISTRY: dict[str, BaseFrame] = {}


def _register(frame: BaseFrame):
    _REGISTRY[frame.name] = frame


# Register all built-in frames
_register(SimpleFrame())
_register(ScanMeFrame())
_register(BalloonFrame())
_register(BadgeFrame())
_register(PolaroidFrame())
_register(TicketFrame())
_register(CardFrame())
_register(TagFrame())
_register(CertificateFrame())
_register(PhoneFrame())
_register(LaptopFrame())


def get_frame(name: str) -> BaseFrame | None:
    """Look up a frame by name. Returns None for 'none' or unknown frames."""
    if name == "none":
        return None
    return _REGISTRY.get(name)


__all__ = ["get_frame", "BaseFrame"]
