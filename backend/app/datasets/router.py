"""Dashboard dataset endpoints. Each dataset registers itself in DATASETS."""

import asyncio
import re
from datetime import date
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from app.datasets import bundled, noaa_gsom, nominatim, ornl, power

router = APIRouter(prefix="/api", tags=["datasets"])

GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"

DATASETS: list[dict[str, Any]] = [
    {
        "id": "power",
        "name": "NASA POWER",
        "gives": "Rain, air temperature, root-zone soil wetness (monthly, ~50 km)",
        "source": "NASA LaRC POWER",
        "url": "https://power.larc.nasa.gov/",
        "access": "live",
        "variables": power.VARIABLES,
    },
    {
        "id": "modis",
        "name": "NASA ORNL DAAC MODIS/VIIRS",
        "gives": "Greenness (NDVI), surface heat (LST), land cover (250 m–1 km)",
        "source": "ORNL DAAC MODIS/VIIRS Subsets",
        "url": "https://modis.ornl.gov/",
        "access": "live",
        "products": {
            k: {"name": p.name, "unit": p.unit, "first_year": p.first_year}
            for k, p in ornl.PRODUCTS.items()
        },
    },
    {
        "id": "grace",
        "name": "GRACE / GRACE-FO mascons",
        "gives": "Regional water storage anomaly (monthly, ~300 km)",
        "source": "CSR RL06.3 mascons",
        "url": "https://www2.csr.utexas.edu/grace/RL0603_mascons.html",
        "access": "bundled",
    },
    {
        "id": "koppen",
        "name": "Köppen-Geiger climate maps",
        "gives": "Climate class 1991–2020 and 2041–2070 (SSP2-4.5), 0.5°",
        "source": "Beck et al. 2023, Scientific Data 10, 724",
        "url": "https://doi.org/10.1038/s41597-023-02549-6",
        "access": "bundled",
    },
    {
        "id": "raindiv",
        "name": "Rainfall vs pre-2000 trend",
        "gives": "World map: post-2000 rainfall compared with the 1951–1999 linear trend extended forward",
        "source": "GPCC Full Data v2025 via NOAA PSL",
        "url": "https://psl.noaa.gov/data/gridded/data.gpcc.html",
        "access": "bundled",
        "resolutions": {
            "1": "1° · post-2000 = 2000–2018 (file gap after 2018)",
            "2.5": "2.5° · post-2000 = 2000–2025",
        },
    },
    {
        "id": "gibs",
        "name": "NASA GIBS imagery",
        "gives": "Satellite imagery tiles (loaded directly by the browser)",
        "source": "NASA GIBS",
        "url": "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api",
        "access": "browser",
        "layers": {
            "base": {
                "tiles": f"{GIBS_BASE}/BlueMarble_ShadedRelief_Bathymetry/default/default/GoogleMapsCompatible_Level8/{{z}}/{{y}}/{{x}}.jpeg",
                "maxzoom": 8,
            },
            "truecolor": {
                "tiles": f"{GIBS_BASE}/MODIS_Terra_CorrectedReflectance_TrueColor/default/{{time}}/GoogleMapsCompatible_Level9/{{z}}/{{y}}/{{x}}.jpg",
                "maxzoom": 9,
                "first_date": "2000-02-24",
            },
        },
    },
    {
        "id": "gsom",
        "name": "NOAA Global Summary of the Month",
        "gives": "Station temperature, precipitation, degree days (monthly)",
        "source": "NOAA NCEI",
        "url": "https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc:C00946",
        "access": "live",
        "variables": noaa_gsom.VARIABLES,
    },
]

STATION_RE = re.compile(r"^[A-Z0-9]{11}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

Lat = Annotated[float, Query(ge=-90, le=90)]
Lon = Annotated[float, Query(ge=-180, le=180)]


def _client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http


def _upstream(name: str, e: Exception) -> HTTPException:
    return HTTPException(502, f"{name} request failed: {type(e).__name__} {e}".strip())


@router.get("/datasets")
def list_datasets() -> list[dict[str, Any]]:
    return DATASETS


# ---------- Nominatim (spec 6.1: /api/geocode) ----------


@router.get("/geocode")
async def geocode(
    request: Request, q: Annotated[str, Query(min_length=1, max_length=200)]
) -> list[nominatim.Place]:
    try:
        return await nominatim.search(_client(request), q)
    except httpx.HTTPError as e:
        raise _upstream("Nominatim", e) from e


# ---------- NASA POWER ----------


@router.get("/datasets/power/monthly")
async def power_monthly(
    request: Request,
    lat: Lat,
    lon: Lon,
    start: Annotated[int, Query(ge=1981)] = 2000,
    end: int | None = None,
) -> power.PowerResult:
    end = end or power.last_complete_year()
    if end < start:
        raise HTTPException(422, "end must be >= start")
    try:
        return await power.get_monthly(_client(request), lat, lon, start, end)
    except httpx.HTTPError as e:
        raise _upstream("NASA POWER", e) from e


# ---------- ORNL MODIS/VIIRS ----------


@router.get("/datasets/modis/series")
async def modis_series(
    request: Request,
    lat: Lat,
    lon: Lon,
    product: str = "MOD13Q1",
    start: Annotated[int, Query(ge=2000)] = 2020,
    end: int | None = None,
) -> ornl.ProductSeries:
    if product not in ornl.PRODUCTS:
        raise HTTPException(422, f"product must be one of {list(ornl.PRODUCTS)}")
    end = end or date.today().year
    if end < start or end - start > 25:
        raise HTTPException(422, "need start <= end and at most 25 years")
    result = await ornl.get_series(
        _client(request), request.app.state.ornl_sem, product, lat, lon, start, end
    )
    if result.requests and result.failed_requests == result.requests:
        raise HTTPException(
            502, "ORNL DAAC: every request failed (service may be down)"
        )
    return result


@router.get("/datasets/modis/landcover")
async def modis_landcover(request: Request, lat: Lat, lon: Lon) -> ornl.LandCover:
    try:
        return await ornl.get_landcover(
            _client(request), request.app.state.ornl_sem, lat, lon
        )
    except httpx.HTTPError as e:
        raise _upstream("ORNL DAAC", e) from e


# ---------- Bundled files ----------


@router.get("/datasets/grace/series")
async def grace_series(lat: Lat, lon: Lon) -> bundled.GraceResult:
    try:
        return await asyncio.to_thread(bundled.grace_series, lat, lon)
    except bundled.MissingDataFile as e:
        raise HTTPException(503, str(e)) from e


@router.get("/datasets/koppen/lookup")
async def koppen_lookup(lat: Lat, lon: Lon) -> bundled.KoppenResult:
    try:
        return await asyncio.to_thread(bundled.koppen_lookup, lat, lon)
    except bundled.MissingDataFile as e:
        raise HTTPException(503, str(e)) from e


@router.get("/datasets/raindiv/grid")
async def raindiv_grid(
    res: Annotated[str, Query(pattern=r"^(1|2\.5)$")] = "1",
) -> bundled.RainDivGrid:
    try:
        return await asyncio.to_thread(bundled.raindiv_grid, res)
    except bundled.MissingDataFile as e:
        raise HTTPException(503, str(e)) from e


@router.get("/datasets/raindiv/point")
async def raindiv_point(
    lat: Lat, lon: Lon, res: Annotated[str, Query(pattern=r"^(1|2\.5)$")] = "1"
) -> bundled.RainDivPoint:
    try:
        return await asyncio.to_thread(bundled.raindiv_point, res, lat, lon)
    except bundled.MissingDataFile as e:
        raise HTTPException(503, str(e)) from e


# ---------- NOAA GSOM ----------


@router.get("/datasets/gsom/stations")
async def gsom_stations(
    request: Request,
    lat: Lat,
    lon: Lon,
    radius_km: Annotated[float, Query(gt=0, le=300)] = 50,
) -> list[noaa_gsom.Station]:
    try:
        return await noaa_gsom.find_stations(_client(request), lat, lon, radius_km)
    except httpx.HTTPError as e:
        raise _upstream("NOAA search", e) from e


@router.get("/datasets/gsom/series")
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
        raise _upstream("NOAA data", e) from e
