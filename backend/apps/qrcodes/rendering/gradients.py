"""
Gradient support for QR code rendering.

- PIL: true per-pixel interpolation for all directions including diagonal.
- SVG: native <linearGradient> / <radialGradient>.
"""

from PIL import Image
import math


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert ``#RRGGBB`` to (R, G, B) tuple."""
    h = (hex_color or "#000000").lstrip("#")
    if len(h) != 6:
        return (0, 0, 0)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# ---------------------------------------------------------------------------
# PIL gradient image
# ---------------------------------------------------------------------------

def _lerp_color(c1, c2, t):
    """Linear interpolation between two RGB tuples."""
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def pil_gradient(width: int, height: int, start: str, end: str, direction: str) -> Image.Image:
    """Create a PIL Image filled with a gradient.

    ``direction`` is one of: vertical, horizontal, diagonal, radial.
    """
    s = hex_to_rgb(start)
    e = hex_to_rgb(end)
    img = Image.new("RGB", (width, height))
    pixels = img.load()

    if direction == "horizontal":
        for x in range(width):
            t = x / max(width - 1, 1)
            c = _lerp_color(s, e, t)
            for y in range(height):
                pixels[x, y] = c

    elif direction == "radial":
        cx, cy = width / 2, height / 2
        max_dist = math.hypot(cx, cy)
        for y in range(height):
            for x in range(width):
                d = math.hypot(x - cx, y - cy) / max(max_dist, 1)
                pixels[x, y] = _lerp_color(s, e, min(d, 1.0))

    elif direction == "diagonal":
        max_sum = width + height - 2 if (width + height > 2) else 1
        for y in range(height):
            for x in range(width):
                t = (x + y) / max_sum
                pixels[x, y] = _lerp_color(s, e, t)

    else:  # vertical
        for y in range(height):
            t = y / max(height - 1, 1)
            c = _lerp_color(s, e, t)
            for x in range(width):
                pixels[x, y] = c

    return img


# ---------------------------------------------------------------------------
# SVG gradient definition
# ---------------------------------------------------------------------------

def svg_gradient_def(grad_id: str, start: str, end: str, direction: str) -> str:
    """Return an SVG ``<defs>`` block containing the gradient definition."""
    if direction == "radial":
        return (
            f'<defs><radialGradient id="{grad_id}" cx="50%" cy="50%" r="70%">'
            f'<stop offset="0%" stop-color="{start}"/>'
            f'<stop offset="100%" stop-color="{end}"/>'
            f'</radialGradient></defs>'
        )

    # linear directions
    coords = {
        "horizontal": ('0', '0', '1', '0'),
        "diagonal":   ('0', '0', '1', '1'),
    }
    x1, y1, x2, y2 = coords.get(direction, ('0', '0', '0', '1'))  # vertical default
    return (
        f'<defs><linearGradient id="{grad_id}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'
        f'<stop offset="0%" stop-color="{start}"/>'
        f'<stop offset="100%" stop-color="{end}"/>'
        f'</linearGradient></defs>'
    )
