"""Step 11: night-light glow around each park, for the stargazing score.

For every park, asks NASA GIBS (Global Imagery Browse Services, no login) for a small
WMS image of the VIIRS Black Marble night-lights layer over a box about 0.5 degrees wide
around the park centre, and takes the mean brightness of its pixels (0 = black, 1 = white).
More artificial light at night means a brighter box and a worse sky for stars.

This is an estimate from a rendered image, not a calibrated sky-brightness measurement.

Writes backend/data/parks/night_lights.json
  {"_meta": {...source, citation...}, "<park id>": {"glow": 0..1, "layer", "date", "bbox"}}

Run from backend/:  .venv/bin/python scripts/step11_night_lights.py
"""

from __future__ import annotations

import json
import struct
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
PARKS = BACKEND / "data/parks/parks.json"
OUT = BACKEND / "data/parks/night_lights.json"
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
LAYER = "VIIRS_CityLights_2012"  # city lights on a dark background; VIIRS_Black_Marble adds a bright snow/terrain tint
DATE = "2012-01-01"  # the only date this layer offers
HALF = 0.25  # degrees; box is 0.5 x 0.5 degrees
SIZE = 64  # pixels per side
UA = {"User-Agent": "Canopy/1.0 (NASA Space Apps 2026)"}


def decode_png(data: bytes) -> list[float]:
    """Luminance (0..1) of every pixel of an 8-bit, non-interlaced PNG (gray, RGB, gray+alpha or RGBA)."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    pos, idat, w, h, depth, ctype, interlace = 8, b"", 0, 0, 0, 0, 0
    while pos < len(data):
        n, kind = struct.unpack(">I4s", data[pos : pos + 8])
        body = data[pos + 8 : pos + 8 + n]
        pos += 12 + n
        if kind == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            idat += body
    ch = {0: 1, 2: 3, 4: 2, 6: 4}.get(ctype)
    if depth != 8 or interlace or ch is None:
        raise ValueError("unsupported PNG layout")
    raw, stride, prev = zlib.decompress(idat), w * ch, bytearray(w * ch)
    out: list[float] = []
    for y in range(h):
        f = raw[y * (stride + 1)]
        row = bytearray(raw[y * (stride + 1) + 1 : (y + 1) * (stride + 1)])
        for i in range(stride):
            a = row[i - ch] if i >= ch else 0
            b = prev[i]
            c = prev[i - ch] if i >= ch else 0
            if f == 1:
                row[i] = (row[i] + a) & 255
            elif f == 2:
                row[i] = (row[i] + b) & 255
            elif f == 3:
                row[i] = (row[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                row[i] = (row[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        prev = row
        for x in range(w):
            px = row[x * ch : x * ch + ch]
            lum = px[0] if ch < 3 else 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]
            out.append(lum / 255)
    return out


def get(url: str) -> bytes:
    for attempt in (0, 1):  # one retry
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError):
            if attempt:
                raise
            time.sleep(5)
    raise RuntimeError("unreachable")


def glow(lat: float, lon: float) -> tuple[float, list[float]]:
    bbox = [round(lon - HALF, 3), round(lat - HALF, 3), round(lon + HALF, 3), round(lat + HALF, 3)]
    q = {
        "SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap", "LAYERS": LAYER, "STYLES": "",
        "SRS": "EPSG:4326", "BBOX": ",".join(map(str, bbox)), "WIDTH": SIZE, "HEIGHT": SIZE,
        "FORMAT": "image/png", "TIME": DATE,
    }  # fmt: skip
    px = decode_png(get(WMS + "?" + urllib.parse.urlencode(q)))
    return round(sum(px) / len(px), 4), bbox


def main() -> None:
    parks = json.loads(PARKS.read_text())
    out: dict[str, dict] = {
        "_meta": {
            "source": "NASA GIBS WMS, VIIRS Black Marble city lights 2012 (Suomi NPP VIIRS), no login",
            "url": WMS,
            "layer": LAYER,
            "date": DATE,
            "method": f"mean brightness (0-1) of a {SIZE}x{SIZE} px image over a 0.5 degree box around the park centre",
            "citation": "NASA Worldview / GIBS, VIIRS Black Marble; Roman et al. 2018, Remote Sensing of Environment 210",
        }
    }
    for p in parks:
        g, bbox = glow(p["lat"], p["lon"])
        out[p["id"]] = {"glow": g, "layer": LAYER, "date": DATE, "bbox": bbox}
        print(p["id"], g)
        time.sleep(0.5)
    OUT.write_text(json.dumps(out, indent=1))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
