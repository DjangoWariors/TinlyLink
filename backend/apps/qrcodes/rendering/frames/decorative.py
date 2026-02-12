"""
Decorative frame implementations: Balloon, Badge, Polaroid, Ticket, Card, Tag, Certificate.
"""

from PIL import Image, ImageDraw
from .base import BaseFrame


class BalloonFrame(BaseFrame):
    name = "balloon"

    def get_layout(self, qr_size):
        pad = 40
        return {"canvas_width": qr_size + pad * 2, "canvas_height": qr_size + pad * 2 + 70,
                "qr_x": pad, "qr_y": pad}

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        pad = 40
        br = qr_size + pad + pad // 2
        mid = w / 2
        tail_h = 25
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            f'<rect x="{pad // 2}" y="{pad // 2}" width="{w - pad}" height="{qr_size + pad}" '
            f'rx="30" fill="none" stroke="{fg}" stroke-width="3"/>',
            f'<polygon points="{mid - 15},{br} {mid + 15},{br} {mid},{br + tail_h}" fill="{fg}"/>',
            f'<g transform="translate({pad},{pad})">{qr_svg}</g>',
        ]
        if text:
            parts.append(self._svg_text(text, w / 2, br + tail_h + 20, fg))
        parts.append("</svg>")
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        pad = 40
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        br_rect = [pad // 2, pad // 2, total_size - pad // 2, qr_size + pad + pad // 2]
        draw.rounded_rectangle(br_rect, radius=30, outline=fg, width=3)
        mid = total_size // 2
        tail_top = br_rect[3]
        draw.polygon([(mid - 15, tail_top), (mid + 15, tail_top), (mid, tail_top + 25)], fill=fg)
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, pad))
        if text:
            self._draw_text(draw, text, total_size, tail_top + 35, fg)
        return canvas


class BadgeFrame(BaseFrame):
    name = "badge"

    def get_layout(self, qr_size):
        return {"canvas_width": qr_size + 60, "canvas_height": qr_size + 140,
                "qr_x": 30, "qr_y": 75}

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        header_h = 50
        display = text or "VISITOR"
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            f'<rect x="10" y="10" width="{w - 20}" height="{h - 20}" rx="15" '
            f'fill="none" stroke="{fg}" stroke-width="2"/>',
            f'<rect x="10" y="10" width="{w - 20}" height="{header_h}" rx="15" fill="{fg}"/>',
            f'<rect x="10" y="{10 + header_h - 15}" width="{w - 20}" height="15" fill="{fg}"/>',
            self._svg_text(display, w / 2, 42, bg, size=18),
            f'<g transform="translate(30,{10 + header_h + 15})">{qr_svg}</g>',
            self._svg_text("SCAN TO CONNECT", w / 2, h - 20, fg, size=12),
            "</svg>",
        ]
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle([10, 10, total_size - 10, total_size - 10], radius=15, outline=fg, width=2)
        header_h = 50
        draw.rectangle([10, 10, total_size - 10, 10 + header_h], fill=self._hex_to_rgb(fg))
        self._draw_text(draw, text or "VISITOR", total_size, 20, bg)
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, 10 + header_h + 15))
        self._draw_text(draw, "SCAN TO CONNECT", total_size, total_size - 40, fg)
        return canvas


class PolaroidFrame(BaseFrame):
    name = "polaroid"

    def get_layout(self, qr_size):
        return {"canvas_width": qr_size + 60, "canvas_height": qr_size + 110,
                "qr_x": 30, "qr_y": 30}

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        caption = text or "Scan Me!"
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            # Shadow
            f'<rect x="19" y="19" width="{w - 30}" height="{h - 30}" rx="2" fill="#C8C8C8"/>',
            # Card
            f'<rect x="15" y="15" width="{w - 30}" height="{h - 30}" rx="2" fill="white" '
            f'stroke="#DCDCDC" stroke-width="1"/>',
            f'<g transform="translate(30,30)">{qr_svg}</g>',
            self._svg_text(caption, w / 2, h - 30, fg, size=16),
            "</svg>",
        ]
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        m = 15
        draw.rectangle([m + 4, m + 4, total_size - m + 4, total_size - m + 4], fill=(200, 200, 200))
        draw.rectangle([m, m, total_size - m, total_size - m], fill=(255, 255, 255), outline=(220, 220, 220), width=1)
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, 30))
        self._draw_text(draw, text or "Scan Me!", total_size, total_size - 60, fg)
        return canvas


class TicketFrame(BaseFrame):
    name = "ticket"

    def get_layout(self, qr_size):
        return {"canvas_width": qr_size + 80, "canvas_height": qr_size + 120,
                "qr_x": 40, "qr_y": 40}

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        perf_y = h - 60
        dots = "".join(
            f'<circle cx="{x}" cy="{perf_y}" r="3" fill="{fg}"/>'
            for x in range(20, int(w) - 20, 15)
        )
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            f'<rect x="15" y="15" width="{w - 30}" height="{h - 30}" '
            f'fill="none" stroke="{fg}" stroke-width="2"/>',
            dots,
            f'<g transform="translate(40,40)">{qr_svg}</g>',
        ]
        if text:
            parts.append(self._svg_text(text, w / 2, perf_y + 30, fg, size=14))
        parts.append("</svg>")
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([15, 15, total_size - 15, total_size - 15], outline=fg, width=2)
        perf_y = total_size - 60
        for x in range(20, total_size - 20, 15):
            draw.ellipse([x, perf_y - 3, x + 6, perf_y + 3], fill=fg)
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, 40))
        if text:
            self._draw_text(draw, text, total_size, perf_y + 15, fg)
        return canvas


class CardFrame(BaseFrame):
    name = "card"

    def get_layout(self, qr_size):
        return {"canvas_width": qr_size + 60, "canvas_height": qr_size + 80,
                "qr_x": 30, "qr_y": 50}

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            f'<rect x="12" y="12" width="{w - 20}" height="{h - 20}" rx="12" fill="#E6E6E6"/>',
            f'<rect x="10" y="10" width="{w - 20}" height="{h - 20}" rx="12" fill="white" '
            f'stroke="#DCDCDC" stroke-width="1"/>',
        ]
        qr_y = 50 if text else 30
        if text:
            parts.append(self._svg_text(text, w / 2, 35, fg, size=16))
        parts.append(f'<g transform="translate(30,{qr_y})">{qr_svg}</g>')
        parts.append("</svg>")
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle([12, 12, total_size - 8, total_size - 8], radius=12, fill=(230, 230, 230))
        draw.rounded_rectangle([10, 10, total_size - 10, total_size - 10], radius=12, fill=(255, 255, 255), outline=(220, 220, 220), width=1)
        if text:
            self._draw_text(draw, text, total_size, 25, fg)
        offset = (total_size - qr_size) // 2
        qr_y = 50 if text else 30
        canvas.paste(qr_img, (offset, qr_y))
        return canvas


class TagFrame(BaseFrame):
    name = "tag"

    def get_layout(self, qr_size):
        return {"canvas_width": qr_size + 60, "canvas_height": qr_size + 100,
                "qr_x": 30, "qr_y": 50}

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        hole_cx = w / 2
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            f'<rect x="15" y="30" width="{w - 30}" height="{h - 45}" rx="10" '
            f'fill="none" stroke="{fg}" stroke-width="2"/>',
            f'<circle cx="{hole_cx}" cy="25" r="10" fill="none" stroke="{fg}" stroke-width="2"/>',
            f'<g transform="translate(30,50)">{qr_svg}</g>',
        ]
        if text:
            parts.append(self._svg_text(text, w / 2, h - 25, fg, size=14))
        parts.append("</svg>")
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle([15, 30, total_size - 15, total_size - 15], radius=10, outline=fg, width=2)
        cx = total_size // 2
        r = 10
        draw.ellipse([cx - r, 15, cx + r, 15 + r * 2], outline=fg, width=2)
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, 50))
        if text:
            self._draw_text(draw, text, total_size, total_size - 50, fg)
        return canvas


class CertificateFrame(BaseFrame):
    name = "certificate"

    def get_layout(self, qr_size):
        return {"canvas_width": qr_size + 80, "canvas_height": qr_size + 100,
                "qr_x": 40, "qr_y": 40}

    def render_svg(self, qr_svg, qr_size, fg, bg, text=""):
        lay = self.get_layout(qr_size)
        w, h = lay["canvas_width"], lay["canvas_height"]
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
            f'<rect width="{w}" height="{h}" fill="{bg}"/>',
            f'<rect x="8" y="8" width="{w - 16}" height="{h - 16}" fill="none" stroke="{fg}" stroke-width="2"/>',
            f'<rect x="16" y="16" width="{w - 32}" height="{h - 32}" fill="none" stroke="{fg}" stroke-width="1"/>',
            f'<g transform="translate(40,40)">{qr_svg}</g>',
        ]
        if text:
            parts.append(self._svg_text(text, w / 2, h - 25, fg, size=14))
        parts.append("</svg>")
        return "".join(parts)

    def render_pil(self, qr_img, qr_size, fg, bg, total_size, text=""):
        canvas = Image.new("RGB", (total_size, total_size), bg)
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([8, 8, total_size - 8, total_size - 8], outline=fg, width=2)
        draw.rectangle([16, 16, total_size - 16, total_size - 16], outline=fg, width=1)
        offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (offset, 40))
        if text:
            self._draw_text(draw, text, total_size, total_size - 50, fg)
        return canvas
