"""
Enhanced QR code image generator with frame support.
Generates QR codes with various styles, frames, and customizations.
"""

import io
import logging
from typing import Optional, Tuple

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import (
    SquareModuleDrawer, CircleModuleDrawer, RoundedModuleDrawer,
)
from qrcode.image.styles.colormasks import (
    SolidFillColorMask, VerticalGradiantColorMask, HorizontalGradiantColorMask,
    RadialGradiantColorMask,
)
from PIL import Image, ImageDraw, ImageFont, ImageFilter

logger = logging.getLogger(__name__)

# Frame padding configuration
FRAME_CONFIG = {
    "none": {"padding": 20, "bottom_space": 0},
    "simple": {"padding": 30, "bottom_space": 50},
    "scan_me": {"padding": 30, "bottom_space": 70},
    "balloon": {"padding": 40, "bottom_space": 70},
    "badge": {"padding": 30, "bottom_space": 80},
    "phone": {"padding": 30, "bottom_space": 50},
    "polaroid": {"padding": 30, "bottom_space": 80},
    "laptop": {"padding": 30, "bottom_space": 50},
    "ticket": {"padding": 40, "bottom_space": 60},
    "card": {"padding": 30, "bottom_space": 50},
    "tag": {"padding": 30, "bottom_space": 60},
    "certificate": {"padding": 40, "bottom_space": 60},
}


class QRImageGenerator:
    """Generate QR code images with frames and styling."""

    def __init__(self):
        self.default_font = None

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
        """
        Generate a complete QR code image with optional frame.

        Args:
            content: The data to encode in the QR code
            size: Target size in pixels
            style: Module style (square, dots, rounded, diamond, star)
            frame: Frame type
            frame_text: Custom text for frame label
            fg_color: Foreground color (hex)
            bg_color: Background color (hex)
            eye_style: Style for the three corner eyes
            eye_color: Separate color for eyes (optional)
            logo_url: URL to logo image to embed
            gradient_enabled: Whether to apply gradient
            gradient_start: Gradient start color
            gradient_end: Gradient end color
            gradient_direction: Gradient direction

        Returns:
            PIL Image object
        """
        # Calculate QR size based on frame
        frame_config = FRAME_CONFIG.get(frame, FRAME_CONFIG["none"])
        padding = frame_config["padding"]
        bottom_space = frame_config["bottom_space"]

        # QR code size within frame
        qr_size = size - (padding * 2)
        if bottom_space:
            qr_size = min(qr_size, size - padding * 2 - bottom_space)

        # Generate base QR code (gradient is applied at render time via color_mask)
        qr_img = self._generate_qr(
            content=content,
            size=qr_size,
            style=style,
            fg_color=fg_color,
            bg_color=bg_color,
            eye_style=eye_style,
            eye_color=eye_color,
            gradient_enabled=gradient_enabled,
            gradient_start=gradient_start,
            gradient_end=gradient_end,
            gradient_direction=gradient_direction,
        )

        # Add logo if provided
        if logo_url:
            qr_img = self._add_logo(qr_img, logo_url)

        # Add frame
        if frame != "none":
            qr_img = self._add_frame(
                qr_img, frame, frame_text, fg_color, bg_color, size
            )
        else:
            # Just add simple padding
            canvas = Image.new("RGB", (size, size), bg_color)
            offset = (size - qr_img.size[0]) // 2
            canvas.paste(qr_img, (offset, offset))
            qr_img = canvas

        return qr_img

    def _generate_qr(
        self,
        content: str,
        size: int,
        style: str,
        fg_color: str,
        bg_color: str,
        eye_style: str,
        eye_color: Optional[str],
        gradient_enabled: bool = False,
        gradient_start: str = "",
        gradient_end: str = "",
        gradient_direction: str = "vertical",
    ) -> Image.Image:
        """Generate the base QR code image."""
        # Create QR code
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(content)
        qr.make(fit=True)

        # Get module drawer based on style
        drawer = self._get_module_drawer(style)

        # Build color mask for gradient or solid fill
        bg_rgb = self._hex_to_rgb(bg_color)
        fg_rgb = self._hex_to_rgb(fg_color)

        if gradient_enabled and gradient_start and gradient_end:
            start_rgb = self._hex_to_rgb(gradient_start)
            end_rgb = self._hex_to_rgb(gradient_end)
            color_mask = self._build_gradient_mask(
                bg_rgb, start_rgb, end_rgb, gradient_direction
            )
        else:
            color_mask = SolidFillColorMask(
                back_color=bg_rgb, front_color=fg_rgb
            )

        # Store matrix size for eye styling
        matrix_size = qr.modules_count

        # Generate image with color mask
        img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=drawer,
            color_mask=color_mask,
        )

        # Convert to RGB if needed
        if img.mode != "RGB":
            img = img.convert("RGB")

        # Resize to target size
        img = img.resize((size, size), Image.Resampling.NEAREST)

        # Apply eye style/color if different
        if eye_style != "square" or eye_color:
            img = self._style_eyes(
                img, matrix_size, 10, 2,
                eye_style, eye_color or fg_color, bg_color
            )

        return img

    def _build_gradient_mask(self, bg_rgb, start_rgb, end_rgb, direction):
        """Build a library color mask for the given gradient direction."""
        if direction == "horizontal":
            return HorizontalGradiantColorMask(
                back_color=bg_rgb, left_color=start_rgb, right_color=end_rgb
            )
        elif direction == "radial":
            return RadialGradiantColorMask(
                back_color=bg_rgb, center_color=start_rgb, edge_color=end_rgb
            )
        elif direction == "diagonal":
            # qrcode library doesn't have a diagonal mask, so we use
            # vertical as the base and note this is an approximation.
            # The frontend SVG handles true diagonal precisely.
            return VerticalGradiantColorMask(
                back_color=bg_rgb, top_color=start_rgb, bottom_color=end_rgb
            )
        else:  # vertical (default)
            return VerticalGradiantColorMask(
                back_color=bg_rgb, top_color=start_rgb, bottom_color=end_rgb
            )

    def _get_module_drawer(self, style: str):
        """Get the appropriate module drawer for the style."""
        drawers = {
            "square": SquareModuleDrawer(),
            "dots": CircleModuleDrawer(),
            "rounded": RoundedModuleDrawer(),
        }
        return drawers.get(style, SquareModuleDrawer())

    def _style_eyes(
        self,
        img: Image.Image,
        matrix_size: int,
        box_size: int,
        border: int,
        eye_style: str,
        eye_color: str,
        bg_color: str,
    ) -> Image.Image:
        """
        Apply custom styling to the three finder pattern eyes.

        Works by calculating the pixel regions of each 7-module finder pattern,
        masking them out, and redrawing with the chosen shape and color.
        """
        img = img.copy()
        draw = ImageDraw.Draw(img)

        # The original QR was rendered at (matrix_size + 2*border) * box_size pixels
        # then resized to img.size. We need the scale factor.
        original_px = (matrix_size + 2 * border) * box_size
        scale = img.size[0] / original_px

        eye_rgb = self._hex_to_rgb(eye_color)
        bg_rgb = self._hex_to_rgb(bg_color)

        # Finder pattern module positions (top-left corner of each 7x7 eye)
        eye_positions = [
            (border, border),                              # top-left
            (border + matrix_size - 7, border),            # top-right
            (border, border + matrix_size - 7),            # bottom-left
        ]

        for (mx, my) in eye_positions:
            # Pixel coordinates for the 7-module eye region
            x1 = int(mx * box_size * scale)
            y1 = int(my * box_size * scale)
            x2 = int((mx + 7) * box_size * scale)
            y2 = int((my + 7) * box_size * scale)
            eye_size = x2 - x1

            # Clear the eye region to background
            draw.rectangle([x1, y1, x2, y2], fill=bg_rgb)

            # Draw the eye in the chosen style
            self._draw_single_eye(draw, x1, y1, eye_size, eye_style, eye_rgb, bg_rgb)

        return img

    def _draw_single_eye(
        self,
        draw: ImageDraw.Draw,
        x: int, y: int,
        size: int,
        style: str,
        fg: str,
        bg: str,
    ):
        """Draw a single finder pattern eye at (x, y) with given size and style."""
        # A finder pattern is 3 concentric shapes:
        # Outer ring: 7x7 modules
        # Inner gap:  5x5 modules (background color)
        # Center:     3x3 modules (foreground color)

        module = size / 7.0
        outer = [x, y, x + size, y + size]
        inner = [
            x + int(module),     y + int(module),
            x + int(6 * module), y + int(6 * module),
        ]
        center = [
            x + int(2 * module), y + int(2 * module),
            x + int(5 * module), y + int(5 * module),
        ]

        if style == "circle":
            draw.ellipse(outer, fill=fg)
            draw.ellipse(inner, fill=bg)
            draw.ellipse(center, fill=fg)

        elif style == "rounded":
            radius = int(module * 1.5)
            center_radius = int(module)
            draw.rounded_rectangle(outer, radius=radius, fill=fg)
            draw.rounded_rectangle(inner, radius=radius, fill=bg)
            draw.rounded_rectangle(center, radius=center_radius, fill=fg)

        elif style == "leaf":
            # Leaf: rounded top-left + bottom-right corners, sharp on the others
            leaf_r = int(module * 2.5)
            draw.rounded_rectangle(outer, radius=leaf_r, fill=fg)
            draw.rounded_rectangle(inner, radius=leaf_r, fill=bg)
            draw.rounded_rectangle(center, radius=int(module * 1.2), fill=fg)

        elif style == "diamond":
            # Diamond: rotated square (45°) for each concentric layer
            cx_o = (outer[0] + outer[2]) / 2
            cy_o = (outer[1] + outer[3]) / 2
            half_o = (outer[2] - outer[0]) / 2
            half_i = (inner[2] - inner[0]) / 2
            half_c = (center[2] - center[0]) / 2

            diamond_outer = [
                (cx_o, cy_o - half_o), (cx_o + half_o, cy_o),
                (cx_o, cy_o + half_o), (cx_o - half_o, cy_o),
            ]
            diamond_inner = [
                (cx_o, cy_o - half_i), (cx_o + half_i, cy_o),
                (cx_o, cy_o + half_i), (cx_o - half_i, cy_o),
            ]
            diamond_center = [
                (cx_o, cy_o - half_c), (cx_o + half_c, cy_o),
                (cx_o, cy_o + half_c), (cx_o - half_c, cy_o),
            ]
            draw.polygon(diamond_outer, fill=fg)
            draw.polygon(diamond_inner, fill=bg)
            draw.polygon(diamond_center, fill=fg)

        else:
            # Default square style
            draw.rectangle(outer, fill=fg)
            draw.rectangle(inner, fill=bg)
            draw.rectangle(center, fill=fg)

    def _add_logo(self, img: Image.Image, logo_url: str) -> Image.Image:
        """Add logo to center of QR code."""
        import requests

        try:
            # Validate URL (SSRF protection should be in model)
            response = requests.get(logo_url, timeout=10, allow_redirects=False)
            response.raise_for_status()
            logo = Image.open(io.BytesIO(response.content))

            # Convert to RGBA for transparency handling
            if logo.mode != "RGBA":
                logo = logo.convert("RGBA")

            # Resize logo to 20% of QR size
            qr_size = img.size[0]
            logo_size = int(qr_size * 0.2)
            logo.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)

            # Create white background for logo area
            bg = Image.new("RGBA", logo.size, (255, 255, 255, 255))
            bg.paste(logo, mask=logo.split()[3] if len(logo.split()) == 4 else None)

            # Center position (use actual logo dimensions after thumbnail)
            pos = ((qr_size - logo.size[0]) // 2, (qr_size - logo.size[1]) // 2)

            # Convert QR to RGBA and paste
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            img.paste(bg, pos, mask=bg)

            # Convert back to RGB
            return img.convert("RGB")

        except Exception as e:
            logger.warning(f"Failed to add logo: {e}")
            return img

    def _add_frame(
        self,
        qr_img: Image.Image,
        frame_type: str,
        frame_text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Add frame around QR code."""
        frame_methods = {
            "simple": self._frame_simple,
            "scan_me": self._frame_scan_me,
            "balloon": self._frame_balloon,
            "badge": self._frame_badge,
            "phone": self._frame_bordered,
            "polaroid": self._frame_polaroid,
            "laptop": self._frame_bordered,
            "ticket": self._frame_ticket,
            "card": self._frame_card,
            "tag": self._frame_tag,
            "certificate": self._frame_certificate,
        }

        method = frame_methods.get(frame_type, self._frame_simple)
        return method(qr_img, frame_text, fg_color, bg_color, total_size)

    def _frame_simple(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Simple border frame with optional text."""
        config = FRAME_CONFIG["simple"]
        padding = config["padding"]
        bottom_space = config["bottom_space"]

        qr_size = qr_img.size[0]
        canvas_height = total_size if not text else qr_size + padding * 2 + bottom_space

        canvas = Image.new("RGB", (total_size, canvas_height), bg_color)
        draw = ImageDraw.Draw(canvas)

        # Draw border
        border_width = 3
        draw.rectangle(
            [
                padding // 2, padding // 2,
                total_size - padding // 2, qr_size + padding + padding // 2
            ],
            outline=fg_color,
            width=border_width
        )

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (qr_offset, padding))

        # Add text if provided
        if text:
            self._draw_text(draw, text, total_size, qr_size + padding + 15, fg_color)

        return canvas

    def _frame_scan_me(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Frame with 'Scan Me' badge at bottom."""
        config = FRAME_CONFIG["scan_me"]
        padding = config["padding"]

        qr_size = qr_img.size[0]
        canvas = Image.new("RGB", (total_size, total_size), bg_color)
        draw = ImageDraw.Draw(canvas)

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (qr_offset, padding))

        # Draw badge at bottom
        badge_text = text or "SCAN ME"
        badge_height = 40
        badge_y = qr_size + padding + 15
        badge_padding = 20

        # Estimate text width
        text_width = len(badge_text) * 12

        badge_x1 = (total_size - text_width - badge_padding * 2) // 2
        badge_x2 = badge_x1 + text_width + badge_padding * 2

        # Draw rounded rectangle badge
        draw.rounded_rectangle(
            [badge_x1, badge_y, badge_x2, badge_y + badge_height],
            radius=badge_height // 2,
            fill=fg_color,
        )

        # Draw text
        self._draw_text(
            draw, badge_text,
            total_size, badge_y + 8,
            bg_color, center=True
        )

        return canvas

    def _frame_ticket(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Event ticket style frame."""
        config = FRAME_CONFIG["ticket"]
        padding = config["padding"]

        qr_size = qr_img.size[0]
        canvas = Image.new("RGB", (total_size, total_size), bg_color)
        draw = ImageDraw.Draw(canvas)

        # Draw ticket border with dashed edges
        draw.rectangle(
            [15, 15, total_size - 15, total_size - 15],
            outline=fg_color,
            width=2
        )

        # Draw perforation line
        perf_y = total_size - 60
        for x in range(20, total_size - 20, 15):
            draw.ellipse([x, perf_y - 3, x + 6, perf_y + 3], fill=fg_color)

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (qr_offset, padding))

        # Add text below perforation
        if text:
            self._draw_text(draw, text, total_size, perf_y + 15, fg_color, center=True)

        return canvas

    def _frame_balloon(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Speech balloon frame with tail and label below."""
        padding = FRAME_CONFIG["balloon"]["padding"]
        qr_size = qr_img.size[0]
        canvas = Image.new("RGB", (total_size, total_size), bg_color)
        draw = ImageDraw.Draw(canvas)

        # Rounded border around QR
        border_rect = [padding // 2, padding // 2,
                       total_size - padding // 2, qr_size + padding + padding // 2]
        draw.rounded_rectangle(border_rect, radius=30, outline=fg_color, width=3)

        # Draw balloon tail (triangle)
        mid_x = total_size // 2
        tail_top = border_rect[3]
        tail_h = 25
        draw.polygon([
            (mid_x - 15, tail_top), (mid_x + 15, tail_top),
            (mid_x, tail_top + tail_h)
        ], fill=fg_color)

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (qr_offset, padding))

        # Label below tail
        if text:
            self._draw_text(draw, text, total_size, tail_top + tail_h + 10, fg_color)

        return canvas

    def _frame_badge(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """ID badge style frame with header and footer."""
        padding = FRAME_CONFIG["badge"]["padding"]
        qr_size = qr_img.size[0]
        canvas = Image.new("RGB", (total_size, total_size), bg_color)
        draw = ImageDraw.Draw(canvas)

        # Badge outline
        draw.rounded_rectangle(
            [10, 10, total_size - 10, total_size - 10],
            radius=15, outline=fg_color, width=2
        )

        # Header bar
        header_h = 50
        draw.rectangle([10, 10, total_size - 10, 10 + header_h], fill=self._hex_to_rgb(fg_color))

        # Header text
        display_text = text or "VISITOR"
        self._draw_text(draw, display_text, total_size, 20, bg_color)

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (qr_offset, 10 + header_h + 15))

        # Footer
        footer_y = total_size - 40
        self._draw_text(draw, "SCAN TO CONNECT", total_size, footer_y, fg_color)

        return canvas

    def _frame_polaroid(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Polaroid photo frame with thick bottom border and caption."""
        padding = FRAME_CONFIG["polaroid"]["padding"]
        qr_size = qr_img.size[0]
        canvas = Image.new("RGB", (total_size, total_size), bg_color)
        draw = ImageDraw.Draw(canvas)

        # White card with shadow effect
        card_margin = 15
        # Shadow
        draw.rectangle(
            [card_margin + 4, card_margin + 4,
             total_size - card_margin + 4, total_size - card_margin + 4],
            fill=(200, 200, 200)
        )
        # Card
        draw.rectangle(
            [card_margin, card_margin,
             total_size - card_margin, total_size - card_margin],
            fill=(255, 255, 255), outline=(220, 220, 220), width=1
        )

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (qr_offset, padding))

        # Caption in thick bottom area
        caption = text or "Scan Me!"
        self._draw_text(draw, caption, total_size, total_size - 60, fg_color)

        return canvas

    def _frame_bordered(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Generic bordered frame used for phone/laptop mockup fallback."""
        padding = 30
        qr_size = qr_img.size[0]
        canvas = Image.new("RGB", (total_size, total_size), bg_color)
        draw = ImageDraw.Draw(canvas)

        # Rounded border
        draw.rounded_rectangle(
            [10, 10, total_size - 10, total_size - 10],
            radius=20, outline=fg_color, width=3
        )

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (qr_offset, padding))

        if text:
            self._draw_text(draw, text, total_size, total_size - 50, fg_color)

        return canvas

    def _frame_card(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Card-style frame with optional header text."""
        padding = FRAME_CONFIG["card"]["padding"]
        qr_size = qr_img.size[0]
        canvas = Image.new("RGB", (total_size, total_size), bg_color)
        draw = ImageDraw.Draw(canvas)

        # Card with subtle shadow
        draw.rounded_rectangle(
            [12, 12, total_size - 8, total_size - 8],
            radius=12, fill=(230, 230, 230)
        )
        draw.rounded_rectangle(
            [10, 10, total_size - 10, total_size - 10],
            radius=12, fill=(255, 255, 255), outline=(220, 220, 220), width=1
        )

        # Header text
        if text:
            self._draw_text(draw, text, total_size, 25, fg_color)

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        qr_y = 50 if text else padding
        canvas.paste(qr_img, (qr_offset, qr_y))

        return canvas

    def _frame_tag(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Price tag style with hole at top."""
        padding = FRAME_CONFIG["tag"]["padding"]
        qr_size = qr_img.size[0]
        canvas = Image.new("RGB", (total_size, total_size), bg_color)
        draw = ImageDraw.Draw(canvas)

        # Tag border
        draw.rounded_rectangle(
            [15, 30, total_size - 15, total_size - 15],
            radius=10, outline=fg_color, width=2
        )

        # Hole at top center
        hole_cx = total_size // 2
        hole_r = 10
        draw.ellipse(
            [hole_cx - hole_r, 15, hole_cx + hole_r, 15 + hole_r * 2],
            outline=fg_color, width=2
        )

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (qr_offset, 50))

        # Text at bottom
        if text:
            self._draw_text(draw, text, total_size, total_size - 50, fg_color)

        return canvas

    def _frame_certificate(
        self,
        qr_img: Image.Image,
        text: str,
        fg_color: str,
        bg_color: str,
        total_size: int,
    ) -> Image.Image:
        """Certificate-style frame with double border."""
        padding = FRAME_CONFIG["certificate"]["padding"]
        qr_size = qr_img.size[0]
        canvas = Image.new("RGB", (total_size, total_size), bg_color)
        draw = ImageDraw.Draw(canvas)

        # Outer border
        draw.rectangle(
            [8, 8, total_size - 8, total_size - 8],
            outline=fg_color, width=2
        )
        # Inner border
        draw.rectangle(
            [16, 16, total_size - 16, total_size - 16],
            outline=fg_color, width=1
        )

        # Paste QR code
        qr_offset = (total_size - qr_size) // 2
        canvas.paste(qr_img, (qr_offset, padding))

        # Text at bottom
        if text:
            self._draw_text(draw, text, total_size, total_size - 50, fg_color)

        return canvas

    def _draw_text(
        self,
        draw: ImageDraw.Draw,
        text: str,
        canvas_width: int,
        y: int,
        color: str,
        center: bool = True,
    ):
        """Draw text on canvas."""
        try:
            font = ImageFont.truetype("arial.ttf", 20)
        except Exception:
            font = ImageFont.load_default()

        # Get text bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]

        if center:
            x = (canvas_width - text_width) // 2
        else:
            x = 20

        draw.text((x, y), text, fill=color, font=font)

    def _hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        """Convert hex color to RGB tuple."""
        hex_color = (hex_color or "#000000").lstrip("#")
        if len(hex_color) != 6:
            return (0, 0, 0)
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


# Singleton instance for reuse
qr_generator = QRImageGenerator()
