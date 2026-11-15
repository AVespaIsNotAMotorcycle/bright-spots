"""Trend atlas routes.

GET /api/trends/atlas          -> atlas.json (all parks × variables × periods, compact)
GET /api/trends/parks/{park_id} -> per-park trends + yearly series
"""

import csv
import io
import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

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


@lru_cache(maxsize=1)
def _coverage() -> dict:
    """Years the bundled series really cover, read from the per-park files (not typed in by hand)."""
    first, last_full, last_year, last_month = 9999, 0, 0, 0
    for p in (DATA / "parks").glob("*.json"):
        for by_period in json.loads(p.read_text()).get("series", {}).values():
            for period, s in by_period.items():
                years = s.get("years") or []
                if not years:
                    continue
                first = min(first, int(years[0]))
                if period == "annual":
                    last_full = max(last_full, int(years[-1]))
                elif period.isdigit():
                    y, m = int(years[-1]), int(period)
                    if (y, m) > (last_year, last_month):
                        last_year, last_month = y, m
    if first == 9999:
        return {}
    return {"first_year": first, "last_full_year": last_full, "last_year": last_year, "last_month": last_month}


@router.get("/atlas")
def get_atlas() -> dict:
    """Full trend atlas: variables metadata + per-park verdicts for every variable × period."""
    try:
        return {**_atlas(), "coverage": _coverage()}
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


EXPORT_COLUMNS = [
    "park_id", "park_name", "state", "variable", "period", "n_years", "first_year", "last_year",
    "mean", "sen_per_decade", "sen_per_decade_f", "ols_per_decade", "ols_ci_low", "ols_ci_high",
    "mk_p", "p", "p_method", "q", "signal_to_noise", "lag1_autocorr", "verdict",
]


@router.get("/export.csv")
def export_csv(
    variable: str | None = None,
    period: str | None = None,
    verdict: str | None = None,
    parks: str | None = Query(None, description="comma-separated park ids"),
) -> Response:
    """Full statistics for the chosen slice of the atlas as CSV (all filters optional)."""
    wanted = set(parks.split(",")) if parks else None
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=EXPORT_COLUMNS, extrasaction="ignore")
    w.writeheader()
    for f in sorted((DATA / "parks").glob("*.json")):
        if wanted and f.stem not in wanted:
            continue
        d = _park(f.stem)
        for t in d["trends"]:
            if variable and t["variable"] != variable:
                continue
            if period and t["period"] != period:
                continue
            if verdict and t["verdict"] != verdict:
                continue
            w.writerow({**t, "park_id": f.stem, "park_name": d["park"]["name"], "state": d["park"].get("state")})
    return Response(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="park-trends.csv"'},
    )


@router.get("/validation")
def get_validation() -> dict:
    """Our temperature trends compared with NOAA GHCN-Daily stations (see scripts/step5_noaa_validation.py)."""
    p = DATA / "validation.json"
    if not p.exists():
        raise HTTPException(503, detail="validation.json not found — run scripts/step5_noaa_validation.py")
    return json.loads(p.read_text())
