"""
Simple and ScanMe frame implementations.
"""

from PIL import Image, ImageDraw
from .base import BaseFrame


class SimpleFrame(BaseFrame):
    """Simple border frame with optional text below."""

    name = "simple"

    def get_layout(self, qr_size: int) -> dict:
        pad = 30
        bottom = 50
        return {
            "canvas_width": qr_size + pad * 2,
            "canvas_height": qr_size + pad * 2 + bottom,
            "qr_x": pad,
            "qr_y": pad,
        }

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        pad = 30
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            # Border
            f'<rect x="{pad // 2}" y="{pad // 2}" '
            f'width="{w - pad}" height="{qr_size + pad}" '
            f'fill="none" stroke="{fg}" stroke-width="3"/>',
            # QR code
            f'<g transform="translate({pad},{pad})">{qr_svg}</g>',
        ]
        if text:
            parts.append(self._svg_text(text, w / 2, qr_size + pad + 30, fg))
        parts.append("</svg>")
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        lay = self.get_layout(qr_size)
        pad = 30
        canvas_h = total_size if not text else qr_size + pad * 2 + 50
        canvas = Image.new("RGB", (total_size, canvas_h), bg)
        draw = ImageDraw.Draw(canvas)
        draw.rectangle(
            [pad // 2, pad // 2, total_size - pad // 2, qr_size + pad + pad // 2],
            outline=fg, width=3,
        )
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, pad))
        if text:
            self._draw_text(draw, text, total_size, qr_size + pad + 15, fg)
        return canvas


class ScanMeFrame(BaseFrame):
    """Frame with a 'Scan Me' badge at the bottom."""

    name = "scan_me"

    def get_layout(self, qr_size: int) -> dict:
        pad = 30
        bottom = 70
        total = qr_size + pad * 2 + bottom
        return {
            "canvas_width": total,
            "canvas_height": total,
            "qr_x": pad,
            "qr_y": pad,
        }

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        pad = 30
        badge_text = text or "SCAN ME"
        badge_y = qr_size + pad + 15
        badge_h = 36
        tw = len(badge_text) * 10
        badge_w = tw + 40
        bx = (w - badge_w) / 2
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            f'<g transform="translate({pad},{pad})">{qr_svg}</g>',
            # Badge
            f'<rect x="{bx}" y="{badge_y}" width="{badge_w}" height="{badge_h}" '
            f'rx="{badge_h / 2}" fill="{fg}"/>',
            self._svg_text(badge_text, w / 2, badge_y + badge_h * 0.65, bg, size=14),
            "</svg>",
        ]
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        pad = 30
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, pad))

        badge_text = text or "SCAN ME"
        badge_h = 40
        badge_y = qr_size + pad + 15
        tw = len(badge_text) * 12
        bx1 = (total_size - tw - 40) // 2
        bx2 = bx1 + tw + 40
        draw.rounded_rectangle(
            [bx1, badge_y, bx2, badge_y + badge_h],
            radius=badge_h // 2, fill=fg,
        )
        self._draw_text(draw, badge_text, total_size, badge_y + 8, bg)
        return canvas
