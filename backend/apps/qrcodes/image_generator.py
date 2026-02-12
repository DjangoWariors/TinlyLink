"""
Backward-compatible facade for QR code image generation.

Delegates to the new ``rendering`` package. Existing code that imports
``QRImageGenerator`` or ``qr_generator`` will continue to work.
"""

import io
from typing import Optional

from PIL import Image


class QRImageGenerator:
    """Thin facade around rendering.render_png()."""

    def generate(
        self,
        content: str,
        size: int = 1024,
        style: str = "square",
        frame: str = "none",
        frame_text: str = "",
        fg_color: str = "#000000",
        bg_color: str = "#FFFFFF",
        eye_style: str = "square",
        eye_color: Optional[str] = None,
        logo_url: Optional[str] = None,
        gradient_enabled: bool = False,
        gradient_start: str = "",
        gradient_end: str = "",
        gradient_direction: str = "vertical",
    ) -> Image.Image:
        """Generate a complete QR code image with optional frame.

        Returns a PIL Image — callers that previously used ``qr_generator.generate()``
        will continue to receive the same type.
        """
        from .rendering.png_renderer import render_png

        png_bytes = render_png(
            content=content,
            size=size,
            style=style,
            frame=frame,
            frame_text=frame_text,
            fg_color=fg_color,
            bg_color=bg_color,
            eye_style=eye_style,
            eye_color=eye_color or "",
            logo_url=logo_url or "",
            gradient_enabled=gradient_enabled,
            gradient_start=gradient_start,
            gradient_end=gradient_end,
            gradient_direction=gradient_direction,
        )
        return Image.open(io.BytesIO(png_bytes))


# Singleton kept for backward compatibility
qr_generator = QRImageGenerator()
