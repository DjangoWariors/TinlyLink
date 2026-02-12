"""
Basic content encoders: vcard, wifi, email, sms, phone, text, calendar, location.
"""

from urllib.parse import quote

from ..schemas import (
    VCardSchema, WiFiSchema, EmailSchema, SMSSchema,
    CalendarEventSchema, LocationSchema,
)
from .base import BaseContentEncoder


class VCardEncoder(BaseContentEncoder):
    qr_type = "vcard"
    schema = VCardSchema

    @staticmethod
    def _esc(value):
        if not value:
            return value
        value = value.replace("\\", "\\\\")
        value = value.replace(",", "\\,")
        value = value.replace(";", "\\;")
        value = value.replace("\n", "\\n")
        return value

    def encode(self, data, **kwargs):
        esc = self._esc
        lines = ["BEGIN:VCARD", "VERSION:3.0"]
        if data.get("name"):
            lines.append(f"FN:{esc(data['name'])}")
            parts = data["name"].split(" ", 1)
            last = esc(parts[1]) if len(parts) == 2 else ""
            first = esc(parts[0])
            lines.append(f"N:{last};{first};;;")
        if data.get("organization"):
            lines.append(f"ORG:{esc(data['organization'])}")
        if data.get("title"):
            lines.append(f"TITLE:{esc(data['title'])}")
        if data.get("phone"):
            lines.append(f"TEL;TYPE=CELL:{data['phone']}")
        if data.get("email"):
            lines.append(f"EMAIL:{data['email']}")
        if data.get("website"):
            lines.append(f"URL:{data['website']}")
        if data.get("address"):
            lines.append(f"ADR:;;{esc(data['address'])};;;;")
        lines.append("END:VCARD")
        return "\n".join(lines)


class WiFiEncoder(BaseContentEncoder):
    qr_type = "wifi"
    schema = WiFiSchema

    @staticmethod
    def _esc(value):
        if not value:
            return value
        for ch in ("\\", ";", ",", '"', ":"):
            value = value.replace(ch, f"\\{ch}")
        return value

    def encode(self, data, **kwargs):
        auth = data.get("auth", "WPA")
        ssid = self._esc(data.get("ssid", ""))
        password = self._esc(data.get("password", ""))
        hidden = "true" if data.get("hidden") else "false"
        return f"WIFI:T:{auth};S:{ssid};P:{password};H:{hidden};;"


class EmailEncoder(BaseContentEncoder):
    qr_type = "email"
    schema = EmailSchema

    def encode(self, data, **kwargs):
        email = data.get("email", "")
        subject = data.get("subject", "")
        body = data.get("body", "")
        mailto = f"mailto:{email}"
        params = []
        if subject:
            params.append(f"subject={quote(subject, safe='')}")
        if body:
            params.append(f"body={quote(body, safe='')}")
        if params:
            mailto += "?" + "&".join(params)
        return mailto


class SMSEncoder(BaseContentEncoder):
    qr_type = "sms"
    schema = SMSSchema

    def encode(self, data, **kwargs):
        phone = data.get("phone", "")
        message = data.get("message", "")
        if message:
            return f"SMSTO:{phone}:{message}"
        return f"SMSTO:{phone}"


class CalendarEncoder(BaseContentEncoder):
    qr_type = "calendar"
    schema = CalendarEventSchema

    @staticmethod
    def _ical_dt(value):
        from datetime import datetime as _dt
        if isinstance(value, str):
            clean = value.rstrip("Z").replace("+00:00", "")
            try:
                dt = _dt.fromisoformat(clean)
            except (ValueError, TypeError):
                return value
        else:
            dt = value
        return dt.strftime("%Y%m%dT%H%M%SZ")

    def encode(self, data, **kwargs):
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//TinlyLink//QR//EN",
            "BEGIN:VEVENT",
        ]
        if data.get("title"):
            lines.append(f"SUMMARY:{data['title']}")
        if data.get("start"):
            lines.append(f"DTSTART:{self._ical_dt(data['start'])}")
        if data.get("end"):
            lines.append(f"DTEND:{self._ical_dt(data['end'])}")
        if data.get("location"):
            lines.append(f"LOCATION:{data['location']}")
        if data.get("description"):
            lines.append(f"DESCRIPTION:{data['description']}")
        lines.append("END:VEVENT")
        lines.append("END:VCALENDAR")
        return "\r\n".join(lines)


class LocationEncoder(BaseContentEncoder):
    qr_type = "location"
    schema = LocationSchema

    def encode(self, data, **kwargs):
        lat = data.get("latitude", 0)
        lng = data.get("longitude", 0)
        name = data.get("name", "")
        if name:
            return f"geo:{lat},{lng}?q={name}"
        return f"geo:{lat},{lng}"
