"""
Base frame interface — all frames implement both render_svg() and render_pil().
"""

from abc import ABC, abstractmethod
from PIL import Image, ImageDraw


class BaseFrame(ABC):
    """Abstract base for all QR code frames."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Frame identifier matching FRAME_CHOICES value."""

    @abstractmethod
    def get_layout(self, qr_size: int) -> dict:
        """Return layout dict with keys:
        - canvas_width, canvas_height: total canvas dimensions
        - qr_x, qr_y: where to place the QR image on the canvas
        """

    @abstractmethod
    def render_svg(
        self, qr_svg: str, qr_size: int, fg: str, bg: str, text: str = ""
    ) -> str:
        """Return complete SVG string including frame and embedded QR SVG.

        ``qr_svg`` is the SVG content of just the QR code (no frame).
        """

    @abstractmethod
    def render_pil(
        self, qr_img: Image.Image, qr_size: int, fg: str, bg: str,
        total_size: int, text: str = ""
    ) -> Image.Image:
        """Return PIL Image of the full frame with QR image composited in."""

    # Helpers shared across frames
    @staticmethod
    def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
        h = (hex_color or "#000000").lstrip("#")
        if len(h) != 6:
            return (0, 0, 0)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

    @staticmethod
    def _draw_text(draw: ImageDraw.Draw, text: str, canvas_width: int, y: int,
                   color, center: bool = True):
        from PIL import ImageFont
        try:
            font = ImageFont.truetype("arial.ttf", 20)
        except Exception:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        x = (canvas_width - tw) // 2 if center else 20
        draw.text((x, y), text, fill=color, font=font)

    @staticmethod
    def _svg_text(text: str, x: float, y: float, color: str,
                  size: int = 16, anchor: str = "middle") -> str:
        """Return an SVG <text> element."""
        esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return (
            f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" '
            f'font-family="Arial,Helvetica,sans-serif" text-anchor="{anchor}">'
            f'{esc}</text>'
        )
