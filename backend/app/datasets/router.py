"""Dashboard dataset endpoints. Each dataset registers itself in DATASETS."""

import re
from typing import Annotated

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from app.datasets import noaa_gsom

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

DATASETS = [
    {
        "id": "gsom",
        "name": "NOAA Global Summary of the Month",
        "source": "NOAA NCEI",
        "url": "https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc:C00946",
        "kind": "station-monthly",
        "variables": noaa_gsom.VARIABLES,
    },
]

STATION_RE = re.compile(r"^[A-Z0-9]{11}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http


@router.get("")
def list_datasets() -> list[dict]:
    return DATASETS


@router.get("/gsom/stations")
async def gsom_stations(
    request: Request,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
    radius_km: Annotated[float, Query(gt=0, le=300)] = 50,
) -> list[noaa_gsom.Station]:
    try:
        return await noaa_gsom.find_stations(_client(request), lat, lon, radius_km)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"NOAA search failed: {e}") from e


@router.get("/gsom/series")
async def gsom_series(
    request: Request,
    station: str,
    start: str = "1991-01-01",
    end: str = "2025-12-31",
    variables: str = "TAVG,TMAX,TMIN,PRCP",
) -> noaa_gsom.Series:
    if not STATION_RE.match(station):
        raise HTTPException(422, "station must be an 11-character GHCN id")
    if not (DATE_RE.match(start) and DATE_RE.match(end)):
        raise HTTPException(422, "start/end must be YYYY-MM-DD")
    vars_ = [v for v in variables.split(",") if v]
    bad = [v for v in vars_ if v not in noaa_gsom.VARIABLES]
    if bad or not vars_:
        raise HTTPException(422, f"unknown variables: {bad}")
    try:
        return await noaa_gsom.get_series(_client(request), station, vars_, start, end)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"NOAA data request failed: {e}") from e
