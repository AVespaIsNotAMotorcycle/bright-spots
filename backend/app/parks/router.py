"""Park planner endpoints. Data: data/parks/*.json from scripts/prepare_parks.py."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.parks.bestdays import best_days
from app.parks.city import CityNormals, city_normals
from app.parks.daily import curves
from app.parks.scoring import Prefs, Scored, score_park
from app.parks.trip import AVOIDS, WANTS, TripPrefs, parse_chips, plan_trip

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


def _ints(s: str, lo: int, hi: int) -> list[int]:
    try:
        xs = sorted({int(x) for x in s.split(",") if x.strip()})
    except ValueError as e:
        raise HTTPException(422, f"bad list: {s!r}") from e
    if not xs or any(x < lo or x > hi for x in xs):
        raise HTTPException(422, f"values must be {lo}-{hi}")
    return xs


def _bands(s: str) -> list[tuple[float, float]]:
    out = []
    for part in s.split(","):
        try:
            a, b = (float(x) for x in part.split(":"))
        except ValueError as e:
            raise HTTPException(422, f"bad band {part!r}, use lo:hi in C") from e
        if not (-40 <= a <= b <= 50):
            raise HTTPException(422, f"band {part!r} out of range")
        out.append((a, b))
    return out


@router.get("/trip")
def trip(
    months: Annotated[str, Query(description="comma-separated months 1-12", examples=["9,10,11"])],
    bands: Annotated[str, Query(description="ideal daytime-high bands lo:hi in C", examples=["15:24,24:30"])] = "15:27",
    want: Annotated[str | None, Query(description="I'm into chips; suffix ! = must, e.g. stars,camping!")] = None,
    avoid: Annotated[str | None, Query(description="avoid chips; suffix ! = must")] = None,
    horizon: Literal["this_year", "next_year", "y2050"] = "next_year",
    scenario: Literal["ssp245", "ssp585"] = "ssp245",
    mystery: Annotated[str | None, Query(description="park codes that have an unsolved case")] = None,
) -> dict:
    """Every park ranked for a trip: best month in the range, reasons, month strip, 2050 change."""
    try:
        parks, climate = load()
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e
    tp = TripPrefs(
        months=_ints(months, 1, 12),
        bands=_bands(bands),
        wants=parse_chips(want, WANTS),
        avoids=parse_chips(avoid, AVOIDS),
        horizon=horizon,
        scenario=scenario,
        mystery={x for x in (mystery or "").split(",") if x},
    )
    return plan_trip(parks, climate, tp)


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


@router.get("/best-days")
def best_days_route(
    park_ids: Annotated[str, Query(description="comma-separated park ids, at most 10")],
    month: Annotated[int, Query(ge=1, le=12)],
    t_lo: Annotated[float, Query(ge=-40, le=50)],
    t_hi: Annotated[float, Query(ge=-40, le=50)],
    horizon: Literal["this_year", "next_year", "y2050"] = "next_year",
    rh_max: Annotated[float | None, Query(ge=0, le=100)] = None,
    dew_max: Annotated[float | None, Query(ge=-40, le=40)] = None,
    rain_max: Annotated[float | None, Query(ge=0, le=1000)] = None,
    avoid_bugs: bool = False,
    stars: bool = False,
    snowmelt: bool = False,
    scenario: Literal["ssp245", "ssp585"] = "ssp245",
) -> dict:
    """Day-by-day scores for the chosen month and year, plus the best days and best stretch."""
    if t_hi < t_lo:
        raise HTTPException(422, "t_hi must be >= t_lo")
    ids = [x for x in park_ids.split(",") if x][:10]
    try:
        _, climate = load()
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e
    prefs = Prefs(month, t_lo, t_hi, rh_max, rain_max, avoid_bugs, stars, snowmelt, dew_max=dew_max)
    out = {}
    for pid in ids:
        path = DATA_DIR / "daily" / f"{pid}.json"
        if pid not in climate or not path.exists():
            raise HTTPException(404, f"no daily data for park {pid!r}")
        out[pid] = best_days(json.loads(path.read_text()), climate[pid], prefs, scenario, horizon)
    return {"parks": out}


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
