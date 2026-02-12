"""
Payment content encoders: UPI and Pix (EMV 6.3).
"""

from ..schemas import UPIPaymentSchema, PixPaymentSchema
from .base import BaseContentEncoder


class UPIEncoder(BaseContentEncoder):
    qr_type = "upi"
    schema = UPIPaymentSchema

    def encode(self, data, **kwargs):
        pa = data.get("pa", "")
        pn = data.get("pn", "")
        am = data.get("am", "")
        cu = data.get("cu", "INR")
        tn = data.get("tn", "")
        params = [f"pa={pa}", f"pn={pn}"]
        if am:
            params.append(f"am={am}")
        params.append(f"cu={cu}")
        if tn:
            params.append(f"tn={tn}")
        return f"upi://pay?{'&'.join(params)}"


class PixEncoder(BaseContentEncoder):
    """Pix EMV QR Code (BCB / EMV 6.3 compliant)."""
    qr_type = "pix"
    schema = PixPaymentSchema

    @staticmethod
    def _emv_tlv(tag, value):
        return f"{tag}{len(value):02d}{value}"

    @staticmethod
    def _crc16_ccitt(payload):
        crc = 0xFFFF
        for byte in payload.encode("ascii"):
            crc ^= byte << 8
            for _ in range(8):
                if crc & 0x8000:
                    crc = (crc << 1) ^ 0x1021
                else:
                    crc <<= 1
                crc &= 0xFFFF
        return f"{crc:04X}"

    def encode(self, data, **kwargs):
        key = data.get("key", "")
        name = data.get("name", "")[:25]
        city = data.get("city", "")[:15]
        amount = data.get("amount")
        txid = data.get("txid", "***")

        gui = self._emv_tlv("00", "br.gov.bcb.pix")
        mai_key = self._emv_tlv("01", key)
        mai = self._emv_tlv("26", gui + mai_key)

        payload = ""
        payload += self._emv_tlv("00", "01")
        payload += mai
        payload += self._emv_tlv("52", "0000")
        payload += self._emv_tlv("53", "986")
        if amount:
            payload += self._emv_tlv("54", f"{float(amount):.2f}")
        payload += self._emv_tlv("58", "BR")
        payload += self._emv_tlv("59", name)
        payload += self._emv_tlv("60", city)

        add_data = self._emv_tlv("05", txid)
        payload += self._emv_tlv("62", add_data)

        payload += "6304"
        crc = self._crc16_ccitt(payload)
        payload += crc

        return payload
