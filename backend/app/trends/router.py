"""Trend atlas routes.

GET /api/trends/atlas          -> atlas.json (all parks × variables × periods, compact)
GET /api/trends/parks/{park_id} -> per-park trends + yearly series
"""

import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException

DATA = Path(__file__).resolve().parents[2] / "data" / "trends"

router = APIRouter(prefix="/api/trends")


@lru_cache(maxsize=1)
def _atlas() -> dict:
    p = DATA / "atlas.json"
    if not p.exists():
        raise FileNotFoundError("atlas.json not found — run scripts/step3_trends.py first")
    return json.loads(p.read_text())


@lru_cache(maxsize=256)
def _park(park_id: str) -> dict:
    p = DATA / "parks" / f"{park_id}.json"
    if not p.exists():
        raise FileNotFoundError(park_id)
    return json.loads(p.read_text())


@router.get("/atlas")
def get_atlas() -> dict:
    """Full trend atlas: variables metadata + per-park verdicts for every variable × period."""
    try:
        return _atlas()
    except FileNotFoundError as e:
        raise HTTPException(503, detail=str(e)) from e


@router.get("/parks/{park_id}")
def get_park_trends(park_id: str) -> dict:
    """All trends and yearly series for one park."""
    try:
        return _park(park_id)
    except FileNotFoundError:
        raise HTTPException(404, detail=f"No trend data for park '{park_id}'") from None


@lru_cache(maxsize=1)
def _insights() -> dict:
    p = DATA / "insights.json"
    if not p.exists():
        raise FileNotFoundError("insights.json not found — run scripts/step4_insights.py first")
    return json.loads(p.read_text())


@router.get("/insights")
def get_insights() -> dict:
    """Park list (with coordinates), park families and opposite-trend groups."""
    try:
        return _insights()
    except FileNotFoundError as e:
        raise HTTPException(503, detail=str(e)) from e
