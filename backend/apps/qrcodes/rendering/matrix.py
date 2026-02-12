"""
QR matrix generation using the qrcode library.
Shared by PNG and SVG renderers.
"""

import qrcode


def make_matrix(content: str) -> list[list[bool]]:
    """Generate QR code module matrix.

    Returns a 2-D list of booleans (True = dark module).
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=1,
        border=0,
    )
    qr.add_data(content)
    qr.make(fit=True)
    return qr.modules


def modules_count(content: str) -> int:
    """Return the number of modules per side for the given content."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=1,
        border=0,
    )
    qr.add_data(content)
    qr.make(fit=True)
    return qr.modules_count
