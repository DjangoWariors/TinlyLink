"""
Device mockup frames: Phone and Laptop.
"""

from PIL import Image, ImageDraw
from .base import BaseFrame


class PhoneFrame(BaseFrame):
    name = "phone"

    def get_layout(self, qr_size):
        return {"canvas_width": qr_size + 60, "canvas_height": qr_size + 80,
                "qr_x": 30, "qr_y": 30}

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            f'<rect x="10" y="10" width="{w - 20}" height="{h - 20}" rx="20" '
            f'fill="none" stroke="{fg}" stroke-width="3"/>',
            # Notch
            f'<rect x="{w / 2 - 30}" y="10" width="60" height="6" rx="3" fill="{fg}"/>',
            f'<g transform="translate(30,30)">{qr_svg}</g>',
        ]
        if text:
            parts.append(self._svg_text(text, w / 2, h - 20, fg, size=14))
        parts.append("</svg>")
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle([10, 10, total_size - 10, total_size - 10], radius=20, outline=fg, width=3)
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, 30))
        if text:
            self._draw_text(draw, text, total_size, total_size - 50, fg)
        return canvas


class LaptopFrame(BaseFrame):
    name = "laptop"

    def get_layout(self, qr_size):
        return {"canvas_width": qr_size + 60, "canvas_height": qr_size + 80,
                "qr_x": 30, "qr_y": 30}

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        base_y = h - 25
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            # Screen
            f'<rect x="10" y="10" width="{w - 20}" height="{h - 35}" rx="8" '
            f'fill="none" stroke="{fg}" stroke-width="3"/>',
            # Base
            f'<path d="M0,{base_y} L{w},{base_y} L{w - 10},{h} L10,{h} Z" '
            f'fill="none" stroke="{fg}" stroke-width="2"/>',
            f'<g transform="translate(30,30)">{qr_svg}</g>',
        ]
        if text:
            parts.append(self._svg_text(text, w / 2, h - 20, fg, size=14))
        parts.append("</svg>")
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle([10, 10, total_size - 10, total_size - 10], radius=20, outline=fg, width=3)
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, 30))
        if text:
            self._draw_text(draw, text, total_size, total_size - 50, fg)
        return canvas
