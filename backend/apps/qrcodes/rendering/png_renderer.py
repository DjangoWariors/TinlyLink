"""
PNG renderer — generates PIL images with frames, eyes, gradients, and logo.
"""

import io
import logging
from typing import Optional

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import (
    SquareModuleDrawer, CircleModuleDrawer, RoundedModuleDrawer,
)
from qrcode.image.styles.colormasks import (
    SolidFillColorMask, VerticalGradiantColorMask, HorizontalGradiantColorMask,
    RadialGradiantColorMask,
)
from PIL import Image, ImageDraw

from .eyes import eye_positions, pil_eye
from .gradients import hex_to_rgb, pil_gradient
from .logo import fetch_logo, paste_logo_on_image
from .frames import get_frame

logger = logging.getLogger(__name__)

_MODULE_DRAWERS = {
    "square": SquareModuleDrawer,
    "dots": CircleModuleDrawer,
    "rounded": RoundedModuleDrawer,
}

# Frame config kept for backward compat with the old direct-call path
_FRAME_CONFIG = {
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


def _generate_base_qr(
    content: str,
    qr_size: int,
    style: str,
    fg_color: str,
    bg_color: str,
    eye_style: str,
    eye_color: str,
    gradient_enabled: bool,
    gradient_start: str,
    gradient_end: str,
    gradient_direction: str,
) -> Image.Image:
    """Generate the raw QR code PIL image (no frame)."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(content)
    qr.make(fit=True)

    drawer_cls = _MODULE_DRAWERS.get(style, SquareModuleDrawer)
    bg_rgb = hex_to_rgb(bg_color)
    fg_rgb = hex_to_rgb(fg_color)

    if gradient_enabled and gradient_start and gradient_end:
        start_rgb = hex_to_rgb(gradient_start)
        end_rgb = hex_to_rgb(gradient_end)
        if gradient_direction == "horizontal":
            color_mask = HorizontalGradiantColorMask(back_color=bg_rgb, left_color=start_rgb, right_color=end_rgb)
        elif gradient_direction == "radial":
            color_mask = RadialGradiantColorMask(back_color=bg_rgb, center_color=start_rgb, edge_color=end_rgb)
        elif gradient_direction == "diagonal":
            # True diagonal: render solid then apply gradient mask
            color_mask = VerticalGradiantColorMask(back_color=bg_rgb, top_color=start_rgb, bottom_color=end_rgb)
        else:
            color_mask = VerticalGradiantColorMask(back_color=bg_rgb, top_color=start_rgb, bottom_color=end_rgb)
    else:
        color_mask = SolidFillColorMask(back_color=bg_rgb, front_color=fg_rgb)

    matrix_size = qr.modules_count

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=drawer_cls(),
        color_mask=color_mask,
    )

    if img.mode != "RGB":
        img = img.convert("RGB")
    img = img.resize((qr_size, qr_size), Image.Resampling.NEAREST)

    # Apply diagonal gradient post-hoc if requested
    if gradient_enabled and gradient_direction == "diagonal" and gradient_start and gradient_end:
        grad_img = pil_gradient(qr_size, qr_size, gradient_start, gradient_end, "diagonal")
        # Use the QR modules as a mask: wherever pixel != bg, replace with gradient color
        px_qr = img.load()
        px_grad = grad_img.load()
        for y in range(qr_size):
            for x in range(qr_size):
                if px_qr[x, y] != bg_rgb:
                    px_qr[x, y] = px_grad[x, y]

    # Custom eyes
    if eye_style != "square" or eye_color:
        img = _apply_eyes(img, matrix_size, 10, 2, eye_style, eye_color or fg_color, bg_color)

    return img


def _apply_eyes(img, matrix_size, box_size, border, eye_style, eye_color, bg_color):
    """Redraw finder pattern eyes with custom style/color."""
    img = img.copy()
    draw = ImageDraw.Draw(img)
    original_px = (matrix_size + 2 * border) * box_size
    scale = img.size[0] / original_px
    fg_rgb = hex_to_rgb(eye_color)
    bg_rgb = hex_to_rgb(bg_color)

    for mx, my in eye_positions(matrix_size):
        mx += border
        my += border
        x1 = int(mx * box_size * scale)
        y1 = int(my * box_size * scale)
        x2 = int((mx + 7) * box_size * scale)
        y2 = int((my + 7) * box_size * scale)
        eye_size = x2 - x1
        draw.rectangle([x1, y1, x2, y2], fill=bg_rgb)
        pil_eye(draw, eye_style, x1, y1, eye_size, fg_rgb, bg_rgb)

    return img


def render_png(
    content: str,
    size: int = 400,
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
) -> bytes:
    """Public API: generate QR code PNG bytes with full styling."""
    frame_cfg = _FRAME_CONFIG.get(frame, _FRAME_CONFIG["none"])
    padding = frame_cfg["padding"]
    bottom_space = frame_cfg["bottom_space"]

    qr_size = size - padding * 2
    if bottom_space:
        qr_size = min(qr_size, size - padding * 2 - bottom_space)

    qr_img = _generate_base_qr(
        content=content, qr_size=qr_size, style=style,
        fg_color=fg_color, bg_color=bg_color,
        eye_style=eye_style, eye_color=eye_color,
        gradient_enabled=gradient_enabled, gradient_start=gradient_start,
        gradient_end=gradient_end, gradient_direction=gradient_direction,
    )

    # Logo
    if logo_url:
        logo = fetch_logo(logo_url)
        if logo:
            qr_img = paste_logo_on_image(qr_img, logo)

    # Frame
    frame_obj = get_frame(frame)
    if frame_obj:
        final = frame_obj.render_pil(qr_img, qr_size, fg_color, bg_color, size, frame_text)
    else:
        # No frame — just center with padding
        canvas = Image.new("RGB", (size, size), bg_color)
        offset = (size - qr_img.size[0]) // 2
        canvas.paste(qr_img, (offset, offset))
        final = canvas

    buf = io.BytesIO()
    final.save(buf, format="PNG", quality=95)
    return buf.getvalue()
