"""
Logo fetching with SSRF protection and simple caching by URL hash.
"""

import hashlib
import io
import logging

from django.core.cache import cache
from PIL import Image

logger = logging.getLogger(__name__)

_CACHE_TTL = 600  # 10 minutes
_MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _validate_url(url: str):
    """Validate logo URL to prevent SSRF attacks."""
    import ipaddress
    import socket
    from urllib.parse import urlparse
    from django.core.exceptions import ValidationError

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValidationError("Only HTTP and HTTPS URLs are allowed for logos.")

    hostname = parsed.hostname
    if not hostname:
        raise ValidationError("Invalid logo URL.")

    try:
        addrinfo = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise ValidationError("Could not resolve logo URL hostname.")

    for _family, _type, _proto, _canonname, sockaddr in addrinfo:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
            raise ValidationError("Logo URL must not point to a private or internal address.")


def _cache_key(url: str) -> str:
    return f"logo:{hashlib.sha256(url.encode()).hexdigest()[:24]}"


def fetch_logo(url: str) -> Image.Image | None:
    """Download and return a logo as a PIL Image, with caching and SSRF protection.

    Returns None on any failure (logged as warning).
    """
    if not url:
        return None

    # Check cache first
    key = _cache_key(url)
    cached = cache.get(key)
    if cached is not None:
        try:
            return Image.open(io.BytesIO(cached))
        except Exception:
            cache.delete(key)

    try:
        _validate_url(url)
    except Exception as exc:
        logger.warning("Logo URL validation failed: %s", exc)
        return None

    try:
        import requests
        resp = requests.get(url, timeout=10, allow_redirects=False, stream=True)
        resp.raise_for_status()

        content_length = resp.headers.get("Content-Length")
        if content_length and int(content_length) > _MAX_FILE_SIZE:
            logger.warning("Logo file exceeds size limit: %s", url)
            return None

        chunks = []
        downloaded = 0
        for chunk in resp.iter_content(chunk_size=8192):
            downloaded += len(chunk)
            if downloaded > _MAX_FILE_SIZE:
                logger.warning("Logo download exceeded size limit: %s", url)
                return None
            chunks.append(chunk)

        raw = b"".join(chunks)
        cache.set(key, raw, timeout=_CACHE_TTL)
        return Image.open(io.BytesIO(raw))

    except Exception as exc:
        logger.warning("Failed to fetch logo %s: %s", url, exc)
        return None


def paste_logo_on_image(qr_img: Image.Image, logo: Image.Image, ratio: float = 0.2) -> Image.Image:
    """Paste a logo at the center of a QR image (with white background)."""
    qr_size = qr_img.size[0]
    max_dim = int(qr_size * ratio)
    logo = logo.copy()

    if logo.mode != "RGBA":
        logo = logo.convert("RGBA")

    logo.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    bg = Image.new("RGBA", logo.size, (255, 255, 255, 255))
    bg.paste(logo, mask=logo.split()[3] if len(logo.split()) == 4 else None)

    pos = ((qr_size - logo.size[0]) // 2, (qr_size - logo.size[1]) // 2)

    if qr_img.mode != "RGBA":
        qr_img = qr_img.convert("RGBA")
    qr_img.paste(bg, pos, mask=bg)

    return qr_img.convert("RGB")
