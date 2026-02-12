"""
PDF renderer — renders QR code as PDF using reportlab.
"""

import io
import logging

logger = logging.getLogger(__name__)


def render_pdf(
    content: str,
    style: str = "square",
    frame: str = "none",
    frame_text: str = "",
    fg_color: str = "#000000",
    bg_color: str = "#FFFFFF",
    eye_style: str = "square",
    eye_color: str = "",
    logo_url: str = "",
    gradient_enabled: bool = False,
    gradient_start: str = "",
    gradient_end: str = "",
    gradient_direction: str = "vertical",
    size: int = 800,
) -> bytes:
    """Public API: generate PDF bytes containing the QR code."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader

    from .png_renderer import render_png

    # Generate a high-res PNG for embedding
    png_bytes = render_png(
        content=content, size=size, style=style,
        frame=frame, frame_text=frame_text,
        fg_color=fg_color, bg_color=bg_color,
        eye_style=eye_style, eye_color=eye_color,
        logo_url=logo_url,
        gradient_enabled=gradient_enabled, gradient_start=gradient_start,
        gradient_end=gradient_end, gradient_direction=gradient_direction,
    )

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    width, height = A4
    qr_size = 150 * mm
    x = (width - qr_size) / 2
    y = (height - qr_size) / 2

    img = ImageReader(io.BytesIO(png_bytes))
    c.drawImage(img, x, y, width=qr_size, height=qr_size)

    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, y - 20, content[:100])

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.getvalue()
