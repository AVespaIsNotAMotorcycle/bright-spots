"""Park planner endpoints. Data: data/parks/*.json from scripts/prepare_parks.py."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

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
    prefs = Prefs(month, t_lo, t_hi, rh_max, rain_max, avoid_bugs, stars, snowmelt)
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
