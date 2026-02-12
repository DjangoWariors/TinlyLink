"""
Eye (finder pattern) rendering for QR codes.

Provides both SVG elements and PIL drawing for the three 7×7 finder patterns.
"""

from PIL import ImageDraw


# Finder pattern positions (top-left corner of each 7×7 eye in module coords)
def eye_positions(n: int):
    """Return the three eye positions given n = modules_count."""
    return [
        (0, 0),          # top-left
        (n - 7, 0),      # top-right
        (0, n - 7),      # bottom-left
    ]


# ---------------------------------------------------------------------------
# SVG rendering
# ---------------------------------------------------------------------------

def svg_eye(style: str, x: float, y: float, size: float, fg: str, bg: str) -> str:
    """Return SVG elements for one finder eye at (x, y) with given size.

    The eye is always 7 modules wide; ``size`` is the pixel size for 7 modules.
    """
    m = size / 7.0
    # Concentric rectangles: outer 7×7, inner 5×5 (gap), center 3×3
    ox, oy = x, y
    ix, iy = x + m, y + m
    cx, cy = x + 2 * m, y + 2 * m
    ow, oh = size, size
    iw, ih = 5 * m, 5 * m
    cw, ch = 3 * m, 3 * m

    if style == "circle":
        r_o, r_i, r_c = size / 2, iw / 2, cw / 2
        center_x, center_y = x + size / 2, y + size / 2
        return (
            f'<circle cx="{center_x}" cy="{center_y}" r="{r_o}" fill="{fg}"/>'
            f'<circle cx="{center_x}" cy="{center_y}" r="{r_i}" fill="{bg}"/>'
            f'<circle cx="{center_x}" cy="{center_y}" r="{r_c}" fill="{fg}"/>'
        )

    elif style == "rounded":
        r1, r2 = m * 1.5, m
        return (
            f'<rect x="{ox}" y="{oy}" width="{ow}" height="{oh}" rx="{r1}" fill="{fg}"/>'
            f'<rect x="{ix}" y="{iy}" width="{iw}" height="{ih}" rx="{r1}" fill="{bg}"/>'
            f'<rect x="{cx}" y="{cy}" width="{cw}" height="{ch}" rx="{r2}" fill="{fg}"/>'
        )

    elif style == "leaf":
        r1, r2 = m * 2.5, m * 1.2
        return (
            f'<rect x="{ox}" y="{oy}" width="{ow}" height="{oh}" rx="{r1}" fill="{fg}"/>'
            f'<rect x="{ix}" y="{iy}" width="{iw}" height="{ih}" rx="{r1}" fill="{bg}"/>'
            f'<rect x="{cx}" y="{cy}" width="{cw}" height="{ch}" rx="{r2}" fill="{fg}"/>'
        )

    elif style == "diamond":
        half_o = size / 2
        half_i = iw / 2
        half_c = cw / 2
        cx_d = x + half_o
        cy_d = y + half_o
        def diamond_path(h):
            return f"M{cx_d},{cy_d - h} L{cx_d + h},{cy_d} L{cx_d},{cy_d + h} L{cx_d - h},{cy_d}Z"
        return (
            f'<path d="{diamond_path(half_o)}" fill="{fg}"/>'
            f'<path d="{diamond_path(half_i)}" fill="{bg}"/>'
            f'<path d="{diamond_path(half_c)}" fill="{fg}"/>'
        )

    else:  # square (default)
        return (
            f'<rect x="{ox}" y="{oy}" width="{ow}" height="{oh}" fill="{fg}"/>'
            f'<rect x="{ix}" y="{iy}" width="{iw}" height="{ih}" fill="{bg}"/>'
            f'<rect x="{cx}" y="{cy}" width="{cw}" height="{ch}" fill="{fg}"/>'
        )


# ---------------------------------------------------------------------------
# PIL rendering
# ---------------------------------------------------------------------------

def pil_eye(draw: ImageDraw.Draw, style: str, x: int, y: int, size: int, fg, bg):
    """Draw one finder eye on a PIL ImageDraw at (x, y) with given size."""
    m = size / 7.0
    outer = [x, y, x + size, y + size]
    inner = [x + int(m), y + int(m), x + int(6 * m), y + int(6 * m)]
    center = [x + int(2 * m), y + int(2 * m), x + int(5 * m), y + int(5 * m)]

    if style == "circle":
        draw.ellipse(outer, fill=fg)
        draw.ellipse(inner, fill=bg)
        draw.ellipse(center, fill=fg)

    elif style == "rounded":
        r1, r2 = int(m * 1.5), int(m)
        draw.rounded_rectangle(outer, radius=r1, fill=fg)
        draw.rounded_rectangle(inner, radius=r1, fill=bg)
        draw.rounded_rectangle(center, radius=r2, fill=fg)

    elif style == "leaf":
        r1, r2 = int(m * 2.5), int(m * 1.2)
        draw.rounded_rectangle(outer, radius=r1, fill=fg)
        draw.rounded_rectangle(inner, radius=r1, fill=bg)
        draw.rounded_rectangle(center, radius=r2, fill=fg)

    elif style == "diamond":
        cx_d = (outer[0] + outer[2]) / 2
        cy_d = (outer[1] + outer[3]) / 2
        half_o = (outer[2] - outer[0]) / 2
        half_i = (inner[2] - inner[0]) / 2
        half_c = (center[2] - center[0]) / 2
        for half, color in [(half_o, fg), (half_i, bg), (half_c, fg)]:
            draw.polygon([
                (cx_d, cy_d - half), (cx_d + half, cy_d),
                (cx_d, cy_d + half), (cx_d - half, cy_d),
            ], fill=color)

    else:  # square
        draw.rectangle(outer, fill=fg)
        draw.rectangle(inner, fill=bg)
        draw.rectangle(center, fill=fg)
