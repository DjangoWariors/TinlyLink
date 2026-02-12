"""
SVG renderer — generates full SVG with frames, eyes, gradients.
"""

from .matrix import make_matrix
from .eyes import eye_positions, svg_eye
from .gradients import svg_gradient_def
from .frames import get_frame


def _module_path(matrix, style, module_size):
    """Build SVG path/elements for QR modules, excluding the three 7×7 finder patterns."""
    n = len(matrix)
    parts = []

    # Build set of finder pattern positions to skip
    eye_cells = set()
    for ex, ey in eye_positions(n):
        for dy in range(7):
            for dx in range(7):
                eye_cells.add((ex + dx, ey + dy))

    if style == "dots":
        r = module_size / 2
        for row in range(n):
            for col in range(n):
                if matrix[row][col] and (col, row) not in eye_cells:
                    cx = col * module_size + r
                    cy = row * module_size + r
                    parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r * 0.85}"/>')

    elif style == "rounded":
        r = module_size * 0.35
        for row in range(n):
            for col in range(n):
                if matrix[row][col] and (col, row) not in eye_cells:
                    x = col * module_size
                    y = row * module_size
                    parts.append(
                        f'<rect x="{x}" y="{y}" width="{module_size}" '
                        f'height="{module_size}" rx="{r}"/>'
                    )

    else:  # square
        for row in range(n):
            for col in range(n):
                if matrix[row][col] and (col, row) not in eye_cells:
                    x = col * module_size
                    y = row * module_size
                    parts.append(
                        f'<rect x="{x}" y="{y}" width="{module_size}" '
                        f'height="{module_size}"/>'
                    )

    return "\n".join(parts)


def _render_qr_svg(
    content: str,
    qr_size: float,
    style: str,
    fg_color: str,
    bg_color: str,
    eye_style: str,
    eye_color: str,
    gradient_enabled: bool,
    gradient_start: str,
    gradient_end: str,
    gradient_direction: str,
) -> str:
    """Generate the inner QR SVG content (no wrapping <svg> element)."""
    matrix = make_matrix(content)
    n = len(matrix)
    module_size = qr_size / n

    defs = ""
    fill = fg_color
    if gradient_enabled and gradient_start and gradient_end:
        defs = svg_gradient_def("qrgrad", gradient_start, gradient_end, gradient_direction)
        fill = "url(#qrgrad)"

    # Background
    parts = [defs] if defs else []
    parts.append(f'<rect width="{qr_size}" height="{qr_size}" fill="{bg_color}"/>')

    # Modules
    parts.append(f'<g fill="{fill}">')
    parts.append(_module_path(matrix, style, module_size))
    parts.append("</g>")

    # Eyes
    actual_eye_color = eye_color or fg_color
    for ex, ey in eye_positions(n):
        x = ex * module_size
        y = ey * module_size
        size = 7 * module_size
        parts.append(svg_eye(eye_style, x, y, size, actual_eye_color, bg_color))

    return "\n".join(parts)


def render_svg(
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
    size: int = 400,
) -> str:
    """Public API: generate QR code SVG string with full styling.

    Note: logo embedding in SVG is best-effort (base64-encoded if available).
    """
    frame_obj = get_frame(frame)

    # Determine QR size within frame
    if frame_obj:
        lay = frame_obj.get_layout(size)
        qr_size = size  # frames handle their own sizing
    else:
        qr_size = size

    qr_inner = _render_qr_svg(
        content=content, qr_size=qr_size, style=style,
        fg_color=fg_color, bg_color=bg_color,
        eye_style=eye_style, eye_color=eye_color,
        gradient_enabled=gradient_enabled, gradient_start=gradient_start,
        gradient_end=gradient_end, gradient_direction=gradient_direction,
    )

    # Embed logo if provided
    if logo_url:
        qr_inner = _embed_logo_svg(qr_inner, logo_url, qr_size)

    if frame_obj:
        return frame_obj.render_svg(qr_inner, qr_size, fg_color, bg_color, frame_text)

    # No frame — simple wrapper
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {qr_size} {qr_size}" '
        f'width="{qr_size}" height="{qr_size}">{qr_inner}</svg>'
    )


def _embed_logo_svg(qr_svg: str, logo_url: str, qr_size: float) -> str:
    """Attempt to embed logo as base64 <image> in the SVG."""
    import base64
    from .logo import fetch_logo

    logo = fetch_logo(logo_url)
    if logo is None:
        return qr_svg

    import io
    # Convert logo to PNG bytes for embedding
    if logo.mode != "RGBA":
        logo = logo.convert("RGBA")

    max_dim = int(qr_size * 0.2)
    logo.thumbnail((max_dim, max_dim))

    buf = io.BytesIO()
    logo.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    lw, lh = logo.size
    x = (qr_size - lw) / 2
    y = (qr_size - lh) / 2

    # White background behind logo
    pad = 4
    logo_embed = (
        f'<rect x="{x - pad}" y="{y - pad}" width="{lw + pad * 2}" '
        f'height="{lh + pad * 2}" fill="white" rx="4"/>'
        f'<image x="{x}" y="{y}" width="{lw}" height="{lh}" '
        f'href="data:image/png;base64,{b64}"/>'
    )

    return qr_svg + logo_embed
