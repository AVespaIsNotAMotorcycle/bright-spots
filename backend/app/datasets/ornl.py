"""NASA ORNL DAAC MODIS/VIIRS subset API (spec 5.1): greenness, surface heat, land cover.

Requests are chunked by date window so each holds at most 10 composites, which
avoids the separate (and often slow) /dates call.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

import httpx
from pydantic import BaseModel

from app.http import get_json

BASE = "https://modis.ornl.gov/rst/api/v1"
HEADERS = {"Accept": "application/json"}
MAX_DATES_PER_REQUEST = 10


@dataclass(frozen=True)
class Product:
    id: str
    name: str
    band: str
    unit: str
    period_days: int
    first_year: int
    scale: float
    offset: float
    fill: int | None
    qa_band: str | None
    keep: Callable[[int | None, int], bool]


def _reliable(qa: int | None, _v: int) -> bool:
    return qa in (0, 1)


def _lst_ok(qa: int | None, v: int) -> bool:
    # QC_Day bits 0-1: 0 = good, 1 = other quality, 2/3 = not produced.
    return v != 0 and qa is not None and (qa & 0b11) in (0, 1)


PRODUCTS: dict[str, Product] = {
    "MOD13Q1": Product(
        "MOD13Q1", "Greenness (NDVI), MODIS 250 m", "250m_16_days_NDVI", "NDVI",
        16, 2000, 0.0001, 0.0, -3000, "250m_16_days_pixel_reliability", _reliable,
    ),
    "VNP13A1": Product(
        "VNP13A1", "Greenness (NDVI), VIIRS 500 m", "500_m_16_days_NDVI", "NDVI",
        16, 2012, 0.0001, 0.0, -3000, "500_m_16_days_pixel_reliability", _reliable,
    ),
    "MOD11A2": Product(
        "MOD11A2", "Surface heat (day LST), MODIS 1 km", "LST_Day_1km", "°C",
        8, 2000, 0.02, -273.15, 0, "QC_Day", _lst_ok,
    ),
}  # fmt: skip

# IGBP classes for MCD12Q1 LC_Type1.
IGBP: dict[int, str] = {
    1: "Evergreen needleleaf forest", 2: "Evergreen broadleaf forest",
    3: "Deciduous needleleaf forest", 4: "Deciduous broadleaf forest",
    5: "Mixed forest", 6: "Closed shrubland", 7: "Open shrubland",
    8: "Woody savanna", 9: "Savanna", 10: "Grassland", 11: "Permanent wetland",
    12: "Cropland", 13: "Urban and built-up", 14: "Cropland/natural mosaic",
    15: "Permanent snow and ice", 16: "Barren", 17: "Water",
}  # fmt: skip


class Obs(BaseModel):
    date: str
    value: float | None
    kept: bool


class ProductSeries(BaseModel):
    product: str
    unit: str
    lat: float
    lon: float
    requests: int
    failed_requests: int
    observations: list[Obs]


class LandCoverYear(BaseModel):
    year: int
    code: int
    name: str


class LandCover(BaseModel):
    lat: float
    lon: float
    first: LandCoverYear | None
    latest: LandCoverYear | None
    changed: bool | None


def modis_date(d: date) -> str:
    return f"A{d.year}{d.timetuple().tm_yday:03d}"


def date_windows(
    start_year: int, end_year: int, period_days: int
) -> list[tuple[str, str]]:
    """Per-year DOY windows each spanning at most MAX_DATES_PER_REQUEST composites.

    Composites start at DOY 1 every `period_days` days within each year, so a window
    of period*10 days starting on a composite boundary holds at most 10.
    """
    span = period_days * MAX_DATES_PER_REQUEST
    out = []
    for y in range(start_year, end_year + 1):
        jan1, dec31 = date(y, 1, 1), date(y, 12, 31)
        s = jan1
        while s <= dec31:
            e = min(s + timedelta(days=span - 1), dec31)
            out.append((modis_date(s), modis_date(e)))
            s = e + timedelta(days=1)
    return out


def _subset_params(lat: float, lon: float, start: str, end: str) -> dict[str, Any]:
    return {
        "latitude": round(lat, 5),
        "longitude": round(lon, 5),
        "startDate": start,
        "endDate": end,
        "kmAboveBelow": 0,
        "kmLeftRight": 0,
    }


def parse_subset(body: dict[str, Any], p: Product) -> list[Obs]:
    by_date: dict[str, dict[str, int]] = {}
    for row in body.get("subset", []):
        if row.get("band") in (p.band, p.qa_band) and row.get("data"):
            by_date.setdefault(row["calendar_date"], {})[row["band"]] = int(
                row["data"][0]
            )
    out = []
    for d in sorted(by_date):
        bands = by_date[d]
        if p.band not in bands:
            continue
        raw = bands[p.band]
        qa = bands.get(p.qa_band) if p.qa_band else None
        if p.fill is not None and raw == p.fill:
            out.append(Obs(date=d, value=None, kept=False))
            continue
        kept = p.keep(qa, raw)
        out.append(Obs(date=d, value=round(raw * p.scale + p.offset, 4), kept=kept))
    return out


async def get_series(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    product: str,
    lat: float,
    lon: float,
    start_year: int,
    end_year: int,
) -> ProductSeries:
    p = PRODUCTS[product]
    windows = date_windows(max(start_year, p.first_year), end_year, p.period_days)

    async def fetch(w: tuple[str, str]) -> list[Obs] | None:
        async with sem:
            try:
                body = await get_json(
                    client,
                    f"{BASE}/{p.id}/subset",
                    _subset_params(lat, lon, *w),
                    HEADERS,
                )
            except httpx.HTTPError:
                return None
        return parse_subset(body, p)

    results = await asyncio.gather(*(fetch(w) for w in windows))
    obs = sorted((o for r in results if r for o in r), key=lambda o: o.date)
    return ProductSeries(
        product=p.id,
        unit=p.unit,
        lat=lat,
        lon=lon,
        requests=len(windows),
        failed_requests=sum(r is None for r in results),
        observations=obs,
    )


def parse_landcover(body: dict[str, Any]) -> list[LandCoverYear]:
    out = []
    for row in body.get("subset", []):
        if row.get("band") == "LC_Type1" and row.get("data"):
            code = int(row["data"][0])
            if code in IGBP:
                year = int(row["calendar_date"][:4])
                out.append(LandCoverYear(year=year, code=code, name=IGBP[code]))
    return sorted(out, key=lambda r: r.year)


async def get_landcover(
    client: httpx.AsyncClient, sem: asyncio.Semaphore, lat: float, lon: float
) -> LandCover:
    """First year (2001) and latest available year: two requests."""
    this_year = date.today().year

    async def fetch(y0: int, y1: int) -> list[LandCoverYear]:
        async with sem:
            body = await get_json(
                client,
                f"{BASE}/MCD12Q1/subset",
                _subset_params(lat, lon, f"A{y0}001", f"A{y1}001"),
                HEADERS,
            )
        return parse_landcover(body)

    first_rows, latest_rows = await asyncio.gather(
        fetch(2001, 2001), fetch(this_year - 5, this_year)
    )
    first = first_rows[0] if first_rows else None
    latest = latest_rows[-1] if latest_rows else None
    return LandCover(
        lat=lat,
        lon=lon,
        first=first,
        latest=latest,
        changed=None if not (first and latest) else first.code != latest.code,
    )
