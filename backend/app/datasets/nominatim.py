"""OpenStreetMap Nominatim place search (spec 5.5).

Usage policy: identify the app, cache, and never exceed one request per second.
"""

from __future__ import annotations

import asyncio
import re
import time

import httpx
from pydantic import BaseModel

from app.config import settings
from app.http import get_json

URL = "https://nominatim.openstreetmap.org/search"
CACHE_TTL_S = 30 * 24 * 3600
MIN_INTERVAL_S = 1.0

COORD_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$")


class Place(BaseModel):
    name: str
    lat: float
    lon: float
    bbox: list[float] | None = None  # south, north, west, east
    source: str  # "coordinates" | "nominatim"


_lock = asyncio.Lock()
_last_call = 0.0


def parse_coords(q: str) -> Place | None:
    m = COORD_RE.match(q)
    if not m:
        return None
    lat, lon = float(m.group(1)), float(m.group(2))
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return Place(name=f"{lat:.4f}, {lon:.4f}", lat=lat, lon=lon, source="coordinates")


def user_agent() -> str:
    contact = settings.nominatim_contact
    return f"BrightSpots/0.1 ({contact})" if contact else "BrightSpots/0.1"


async def search(client: httpx.AsyncClient, q: str) -> list[Place]:
    q = q.strip()
    if coords := parse_coords(q):
        return [coords]
    global _last_call
    async with _lock:  # serialise calls: <= 1 request per second
        wait = MIN_INTERVAL_S - (time.monotonic() - _last_call)
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            body = await get_json(
                client,
                URL,
                {"q": q, "format": "jsonv2", "limit": 5},
                headers={"User-Agent": user_agent()},
                ttl_s=CACHE_TTL_S,
            )
        finally:
            _last_call = time.monotonic()
    return [
        Place(
            name=r["display_name"],
            lat=float(r["lat"]),
            lon=float(r["lon"]),
            bbox=[float(x) for x in r.get("boundingbox", [])] or None,
            source="nominatim",
        )
        for r in body
    ]
