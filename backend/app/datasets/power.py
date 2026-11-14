"""NASA POWER monthly point API (spec 5.2): rain, air temperature, root-zone wetness."""

from __future__ import annotations

import calendar
from datetime import date
from typing import Any

import httpx
from pydantic import BaseModel

from app.http import get_json

URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
PARAMS = ("PRECTOTCORR", "T2M", "GWETROOT")
MISSING = -999

VARIABLES: dict[str, dict[str, str]] = {
    "RAIN": {"name": "Rainfall", "unit": "mm/month", "group": "rain"},
    "T2M": {"name": "Air temperature (2 m)", "unit": "°C", "group": "temperature"},
    "GWETROOT": {"name": "Root-zone soil wetness", "unit": "0–1", "group": "soil"},
}


class MonthPoint(BaseModel):
    date: str  # YYYY-MM
    values: dict[str, float | None]


class YearPoint(BaseModel):
    year: int
    rain_mm: float | None
    t2m_c: float | None
    gwetroot: float | None


class PowerResult(BaseModel):
    lat: float
    lon: float
    elevation_m: float | None
    variables: list[str]
    monthly: list[MonthPoint]
    yearly: list[YearPoint]


def last_complete_year(today: date | None = None) -> int:
    return (today or date.today()).year - 1


def _complete(rows: list[dict[str, float | None]], k: str) -> list[float] | None:
    """Values for a full 12-month year, else None."""
    vals = [v for r in rows if (v := r.get(k)) is not None]
    return vals if len(vals) == 12 else None


def parse(body: dict[str, Any], lat: float, lon: float) -> PowerResult:
    param = body["properties"]["parameter"]
    coords = body.get("geometry", {}).get("coordinates", [])
    months: dict[str, dict[str, float | None]] = {}
    for p in PARAMS:
        for key, raw in param.get(p, {}).items():
            if key.endswith("13"):  # annual value; we compute our own
                continue
            y, m = int(key[:4]), int(key[4:])
            v = None if raw is None or raw <= MISSING else float(raw)
            out_key = "RAIN" if p == "PRECTOTCORR" else p
            if p == "PRECTOTCORR" and v is not None:
                v = round(v * calendar.monthrange(y, m)[1], 1)  # mm/day -> mm/month
            months.setdefault(f"{y:04d}-{m:02d}", {})[out_key] = v

    monthly = [MonthPoint(date=d, values=months[d]) for d in sorted(months)]

    yearly: list[YearPoint] = []
    years = sorted({int(d[:4]) for d in months})
    for y in years:
        rows = [months[d] for d in months if d.startswith(f"{y:04d}-")]

        rain, t2m, gw = (_complete(rows, k) for k in ("RAIN", "T2M", "GWETROOT"))
        yearly.append(
            YearPoint(
                year=y,
                rain_mm=round(sum(rain), 1) if rain else None,
                t2m_c=round(sum(t2m) / 12, 2) if t2m else None,
                gwetroot=round(sum(gw) / 12, 3) if gw else None,
            )
        )

    return PowerResult(
        lat=lat,
        lon=lon,
        elevation_m=float(coords[2]) if len(coords) > 2 else None,
        variables=list(VARIABLES),
        monthly=monthly,
        yearly=yearly,
    )


async def get_monthly(
    client: httpx.AsyncClient,
    lat: float,
    lon: float,
    start: int = 2000,
    end: int | None = None,
) -> PowerResult:
    body = await get_json(
        client,
        URL,
        {
            "parameters": ",".join(PARAMS),
            "community": "AG",
            "longitude": round(lon, 4),
            "latitude": round(lat, 4),
            "start": start,
            "end": end or last_complete_year(),
            "format": "JSON",
        },
    )
    return parse(body, lat, lon)
