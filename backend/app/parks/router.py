"""Park planner endpoints. Data: data/parks/*.json from scripts/prepare_parks.py."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.parks.city import CityNormals, city_normals
from app.parks.daily import curves
from app.parks.scoring import Prefs, Scored, score_park

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "parks"

router = APIRouter(prefix="/api/parks", tags=["parks"])


class Park(BaseModel):
    id: str
    code: str | None
    name: str
    short: str
    states: list[str]
    lat: float
    lon: float
    visitors_2025: int | None


class Horizon(BaseModel):
    score: float | None
    low: float | None
    high: float | None
    factors: dict[str, float | None]
    values: dict[str, float | None]
    notes: list[str]


class ParkPlan(BaseModel):
    park: Park
    this_year: Horizon
    next_year: Horizon
    y2050: Horizon


class Plan(BaseModel):
    month: int
    this_year: int
    next_year: int
    scenario: str
    parks: list[ParkPlan]


@lru_cache(maxsize=1)
def load() -> tuple[list[Park], dict[str, dict]]:
    parks_f, climate_f = DATA_DIR / "parks.json", DATA_DIR / "park_climate.json"
    if not (parks_f.exists() and climate_f.exists()):
        raise FileNotFoundError("data/parks/ missing; run scripts/prepare_parks.py")
    parks = [Park(**p) for p in json.loads(parks_f.read_text())]
    climate = json.loads(climate_f.read_text())
    return [p for p in parks if p.id in climate], climate


def _h(s: Scored) -> Horizon:
    return Horizon(**s.__dict__)


@router.get("")
def list_parks() -> list[Park]:
    try:
        return load()[0]
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e


@router.get("/plan")
def plan(
    month: Annotated[int, Query(ge=1, le=12)],
    t_lo: Annotated[
        float, Query(ge=-40, le=50, description="ideal daytime high, low end, C")
    ],
    t_hi: Annotated[float, Query(ge=-40, le=50)],
    rh_max: Annotated[float | None, Query(ge=0, le=100)] = None,
    dew_max: Annotated[
        float | None, Query(ge=-40, le=40, description="max dew point, C")
    ] = None,
    rain_max: Annotated[
        float | None, Query(ge=0, le=1000, description="mm/month")
    ] = None,
    avoid_bugs: bool = False,
    stars: bool = False,
    snowmelt: bool = False,
    scenario: Literal["ssp245", "ssp585"] = "ssp245",
) -> Plan:
    if t_hi < t_lo:
        raise HTTPException(422, "t_hi must be >= t_lo")
    try:
        parks, climate = load()
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e
    prefs = Prefs(
        month,
        t_lo,
        t_hi,
        rh_max,
        rain_max,
        avoid_bugs,
        stars,
        snowmelt,
        dew_max=dew_max,
    )
    out = []
    for p in parks:
        s = score_park(climate[p.id], prefs, scenario)
        out.append(
            ParkPlan(
                park=p,
                this_year=_h(s["this_year"]),
                next_year=_h(s["next_year"]),
                y2050=_h(s["y2050"]),
            )
        )
    first = climate[parks[0].id]
    return Plan(
        month=month,
        this_year=first["this_year"],
        next_year=first["next_year"],
        scenario=scenario,
        parks=out,
    )


class DailyCurves(BaseModel):
    """365-day curves (Feb 29 dropped) per horizon: tmax C, rh %, precip mm/day,
    cloud %. this_year has None for days not yet measured; y2050 is None without
    a projection for the park's cell."""

    park_id: str
    year: int
    through: str
    scenario: str
    normal: dict[str, list[float | None]]
    this_year: dict[str, list[float | None]]
    next_year: dict[str, list[float | None]]
    y2050: dict[str, list[float | None] | None]


@router.get("/{park_id}/daily")
def daily(
    park_id: str, scenario: Literal["ssp245", "ssp585"] = "ssp245"
) -> DailyCurves:
    try:
        _, climate = load()
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e
    path = DATA_DIR / "daily" / f"{park_id}.json"
    if park_id not in climate or not path.exists():
        raise HTTPException(404, f"no daily data for park {park_id!r}")
    d = json.loads(path.read_text())
    c = curves(d, climate[park_id], scenario)
    return DailyCurves(
        park_id=park_id, year=d["year"], through=d["through"], scenario=scenario, **c
    )


@router.get("/city-normals")
async def city(
    request: Request,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
) -> CityNormals:
    """1991-2020 monthly normals at a place (NASA POWER), for "favourite city"."""
    try:
        return await city_normals(request.app.state.http, lat, lon)
    except httpx.HTTPError as e:
        raise HTTPException(
            502, f"NASA POWER request failed: {type(e).__name__}"
        ) from e
