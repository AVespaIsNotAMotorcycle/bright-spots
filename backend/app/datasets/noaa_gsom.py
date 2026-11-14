"""NOAA NCEI Global Summary of the Month (GSOM) client.

Uses NCEI's token-free services:
- Search:  https://www.ncei.noaa.gov/access/services/search/v1/data
- Data:    https://www.ncei.noaa.gov/access/services/data/v1
"""

from __future__ import annotations

import math
import time
from typing import Any

import httpx
from pydantic import BaseModel

SEARCH_URL = "https://www.ncei.noaa.gov/access/services/search/v1/data"
DATA_URL = "https://www.ncei.noaa.gov/access/services/data/v1"
DATASET = "global-summary-of-the-month"
CACHE_TTL_S = 6 * 3600

# Curated subset of GSOM variables shown in the dashboard (units = metric).
VARIABLES: dict[str, dict[str, str]] = {
    "TAVG": {"name": "Average temperature", "unit": "°C", "group": "temperature"},
    "TMAX": {"name": "Average max temperature", "unit": "°C", "group": "temperature"},
    "TMIN": {"name": "Average min temperature", "unit": "°C", "group": "temperature"},
    "EMXT": {"name": "Extreme max temperature", "unit": "°C", "group": "temperature"},
    "EMNT": {"name": "Extreme min temperature", "unit": "°C", "group": "temperature"},
    "PRCP": {"name": "Precipitation", "unit": "mm", "group": "precipitation"},
    "SNOW": {"name": "Snowfall", "unit": "mm", "group": "precipitation"},
    "DP01": {"name": "Days with ≥0.25 mm rain", "unit": "days", "group": "days"},
    "DX90": {"name": "Days with max >32.2 °C", "unit": "days", "group": "days"},
    "DT32": {"name": "Days with min <0 °C", "unit": "days", "group": "days"},
    "HTDD": {"name": "Heating degree days", "unit": "°C·day", "group": "degree-days"},
    "CLDD": {"name": "Cooling degree days", "unit": "°C·day", "group": "degree-days"},
    "AWND": {"name": "Average wind speed", "unit": "m/s", "group": "wind"},
}


class Station(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    distance_km: float
    start_date: str
    end_date: str
    variables: list[str]


class SeriesPoint(BaseModel):
    date: str  # YYYY-MM
    values: dict[str, float | None]


class Series(BaseModel):
    station: str
    variables: list[str]
    points: list[SeriesPoint]


_cache: dict[str, tuple[float, Any]] = {}


async def _get_json(client: httpx.AsyncClient, url: str, params: dict[str, Any]) -> Any:
    key = url + "?" + "&".join(f"{k}={params[k]}" for k in sorted(params))
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
        return hit[1]
    resp = await client.get(url, params=params)
    resp.raise_for_status()
    body = resp.json()
    _cache[key] = (time.monotonic(), body)
    return body


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def bbox(lat: float, lon: float, radius_km: float) -> str:
    """NCEI bbox order is north,west,south,east."""
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.01))
    n, s = min(lat + dlat, 90.0), max(lat - dlat, -90.0)
    w, e = max(lon - dlon, -180.0), min(lon + dlon, 180.0)
    return f"{n:.4f},{w:.4f},{s:.4f},{e:.4f}"


def parse_stations(body: dict[str, Any], lat: float, lon: float) -> list[Station]:
    out: list[Station] = []
    for r in body.get("results", []):
        stations = r.get("stations") or []
        centroid = r.get("centroid") or (r.get("location") or {}).get("coordinates")
        if not stations or not centroid:
            continue
        s_lon, s_lat = float(centroid[0]), float(centroid[1])
        st = stations[0]
        out.append(
            Station(
                id=st["id"],
                name=st.get("name", st["id"]),
                lat=s_lat,
                lon=s_lon,
                distance_km=round(haversine_km(lat, lon, s_lat, s_lon), 1),
                start_date=(r.get("startDate") or "")[:10],
                end_date=(r.get("endDate") or "")[:10],
                variables=[
                    d["id"] for d in r.get("dataTypes", []) if d.get("id") in VARIABLES
                ],
            )
        )
    out.sort(key=lambda s: s.distance_km)
    return out


async def find_stations(
    client: httpx.AsyncClient,
    lat: float,
    lon: float,
    radius_km: float = 50,
    limit: int = 25,
) -> list[Station]:
    body = await _get_json(
        client,
        SEARCH_URL,
        {"dataset": DATASET, "bbox": bbox(lat, lon, radius_km), "limit": 100},
    )
    stations = [s for s in parse_stations(body, lat, lon) if s.distance_km <= radius_km]
    return stations[:limit]


def parse_series(
    rows: list[dict[str, Any]], station: str, variables: list[str]
) -> Series:
    points: list[SeriesPoint] = []
    for row in rows:
        values: dict[str, float | None] = {}
        for v in variables:
            raw = row.get(v)
            try:
                values[v] = float(raw) if raw not in (None, "") else None
            except ValueError:
                values[v] = None
        points.append(SeriesPoint(date=row["DATE"], values=values))
    points.sort(key=lambda p: p.date)
    return Series(station=station, variables=variables, points=points)


async def get_series(
    client: httpx.AsyncClient, station: str, variables: list[str], start: str, end: str
) -> Series:
    rows = await _get_json(
        client,
        DATA_URL,
        {
            "dataset": DATASET,
            "stations": station,
            "dataTypes": ",".join(variables),
            "startDate": start,
            "endDate": end,
            "format": "json",
            "units": "metric",
        },
    )
    return parse_series(rows or [], station, variables)
