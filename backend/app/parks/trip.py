"""Trip planner scoring: months, "feel" bands, "I'm into" and "Avoid" chips.

Every factor is a score in [0, 1] (1 = good for the traveller) built from bundled data:

  base climate   data/parks/park_climate.json (NASA POWER normals, this year, the next-year
                 trend forecast, WorldClim CMIP6 2050) via scoring.score_park
  extras         data/parks/trip_extras.json (NASA POWER 2005-2024 night lows, wind, UV,
                 sunlight, rainy/heat/freeze/hazy days; NASA FIRMS fires) from step10
  trends         data/trends/atlas.json (Sen's slope + FDR verdict per park and month)
  ecoregions     data/trends/ecoregions.json (EPA level I, for fall colours)
  maths          day length and new-moon dates

Falloffs below are PROVISIONAL design choices, not values from a source. Wildflowers, fall
colours and bugs are estimates from weather and are labelled so in the UI.

A chip is "nice" (counts toward the score) or "must" (counts more, and a park whose value is
below 0.5 is dropped). With several months, each park is ranked on its best month.
"""

from __future__ import annotations

import datetime as dt
import json
import math
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from app.parks.scoring import (
    Prefs,
    bug_index,
    clamp01,
    dewpoint_score,
    melt_score,
    melt_shares,
    score_park,
    temp_score,
)

ROOT = Path(__file__).resolve().parents[2] / "data"
HORIZONS = ("this_year", "next_year", "y2050")
MUST_MIN = 0.5
W_TEMP, W_NICE, W_MUST = 2.0, 1.0, 1.5
SYNODIC = 29.530588853
NEW_MOON_REF = dt.datetime(2000, 1, 6, 18, 14)  # a known new moon (UTC)
STRONG_FALL = {"EASTERN TEMPERATE FORESTS", "NORTHERN FORESTS"}
SOME_FALL = {"NORTHWESTERN FORESTED MOUNTAINS", "MARINE WEST COAST FOREST"}


@lru_cache(maxsize=1)
def extras() -> dict:
    p = ROOT / "parks" / "trip_extras.json"
    return json.loads(p.read_text()) if p.exists() else {}


@lru_cache(maxsize=1)
def trends() -> dict[str, dict[str, dict]]:
    """month -> park code -> {sen, verdict} for the daytime high."""
    p = ROOT / "trends" / "atlas.json"
    if not p.exists():
        return {}
    a = json.loads(p.read_text())["atlas"].get("tmax_c", {})
    return {m: {c["park_id"]: c for c in cells} for m, cells in a.items()}


@lru_cache(maxsize=1)
def ecoregions() -> dict[str, dict]:
    p = ROOT / "trends" / "ecoregions.json"
    return json.loads(p.read_text()) if p.exists() else {}


def day_length(lat: float, month: int) -> float:
    """Hours of daylight on the 15th of the month (standard declination formula)."""
    doy = dt.date(2021, month, 15).timetuple().tm_yday
    decl = 23.44 * math.sin(math.radians(360 / 365 * (doy - 81)))
    x = -math.tan(math.radians(lat)) * math.tan(math.radians(decl))
    if x <= -1:
        return 24.0
    if x >= 1:
        return 0.0
    return round(2 * math.degrees(math.acos(x)) / 15, 1)


def new_moons(year: int, month: int) -> list[int]:
    """Days of the month with a new moon (UTC), from the mean synodic month."""
    start = dt.datetime(year, month, 1)
    end = dt.datetime(year + (month == 12), month % 12 + 1, 1)
    k = math.ceil((start - NEW_MOON_REF).total_seconds() / 86400 / SYNODIC)
    out = []
    while True:
        t = NEW_MOON_REF + dt.timedelta(days=k * SYNODIC)
        if t >= end:
            return out
        out.append(t.day)
        k += 1


def tri(x: float, lo: float, hi: float) -> float:
    """1 in the middle of [lo, hi], falling to 0 at the ends."""
    if x <= lo or x >= hi:
        return 0.0
    mid = (lo + hi) / 2
    return 1 - abs(x - mid) / (mid - lo)


@dataclass
class Ctx:
    park: dict
    month: int
    v: dict  # base climate values for this month and horizon
    x: dict  # extras normals for this month
    prev_v: dict  # base values for the month before (wildflowers)
    melt: list[float] | None
    mystery: set[str]


Result = tuple[float, float | None] | None  # (score, value shown) or not applicable


def _need(*vals: float | None) -> bool:
    return all(v is not None for v in vals)


def f_stars(c: Ctx) -> Result:
    cloud = c.v.get("cloud")
    if cloud is None:
        return None
    night = 24 - day_length(c.park["lat"], c.month)
    return 0.65 * clamp01(1 - cloud / 100) + 0.35 * clamp01((night - 8) / 6), cloud


def f_waterfalls(c: Ctx) -> Result:
    p = c.v.get("precip")
    if p is None:
        return None
    if c.melt is not None:
        return 0.75 * melt_score(c.melt, c.month) + 0.25 * clamp01(p / 120), round(100 * c.melt[c.month - 1])
    # No snowpack: only heavy rain feeds falls, and we cannot tell which parks have them.
    return 0.5 * clamp01(p / 150), p


def f_wildflowers(c: Ctx) -> Result:
    t = c.v.get("tmax")
    if t is None:
        return None
    if c.melt is not None:  # blooms follow the melt by about a month
        prev = c.month - 1 or 12
        return melt_score(c.melt, prev) * (1.0 if t >= 10 else 0.3), t
    rain = (c.v.get("precip") or 0) + (c.prev_v.get("precip") or 0)
    return tri(t, 12, 30) * clamp01(rain / 60), t


def f_fall(c: Ctx) -> Result:
    tmin = c.x.get("tmin")
    l1 = (ecoregions().get(c.park.get("code") or "") or {}).get("l1")
    forest = 1.0 if l1 in STRONG_FALL else 0.4 if l1 in SOME_FALL else 0.0
    if tmin is None:
        return None
    autumn = 1.0 if c.month in (9, 10, 11) else 0.0
    return forest * autumn * tri(tmin, -2, 14), tmin


def f_snow_play(c: Ctx) -> Result:
    s = c.v.get("snow")
    return None if s is None else (clamp01(s / 20), s)


def f_camping(c: Ctx) -> Result:
    t = c.x.get("tmin")
    return None if t is None else (temp_score(t, 5, 15), t)


def f_calm(c: Ctx) -> Result:
    w = c.x.get("wind")
    return None if w is None else (1 - clamp01((w - 2) / 3.5), w)


def f_sunny(c: Ctx) -> Result:
    s = c.x.get("sun")
    return None if s is None else (clamp01((s - 2.5) / 4.5), s)


def f_hikes(c: Ctx) -> Result:
    t, heat = c.v.get("tmax"), c.x.get("heat_days")
    if not _need(t, heat):
        return None
    day = day_length(c.park["lat"], c.month)
    return clamp01((day - 9) / 4) * temp_score(t, 10, 26) * (1 - clamp01(heat / 10)), day


def f_witness(c: Ctx) -> Result:
    cell = trends().get(str(c.month), {}).get(c.park.get("code") or "")
    if not cell or cell.get("sen") is None:
        return None
    s = clamp01(abs(cell["sen"]) / 0.6) if cell["verdict"] == "real" else 0.0
    return s, cell["sen"]


def f_mystery(c: Ctx) -> Result:
    return (1.0 if c.park.get("code") in c.mystery else 0.0), None


def f_bugs(c: Ctx) -> Result:
    t2m, rh, p = c.v.get("t2m"), c.v.get("rh"), c.v.get("precip")
    if not _need(t2m, rh, p):
        return None
    b = bug_index(t2m, rh, p)
    return 1 - b, round(b, 2)


def _days(key: str, full: float, free: float = 0.0) -> Callable[[Ctx], Result]:
    def f(c: Ctx) -> Result:
        n = c.x.get(key)
        return None if n is None else (1 - clamp01((n - free) / full), n)

    return f


def f_muggy(c: Ctx) -> Result:
    d = c.v.get("dewpoint")
    return None if d is None else (dewpoint_score(d, 16), d)


def f_gray(c: Ctx) -> Result:
    cl = c.v.get("cloud")
    return None if cl is None else (clamp01((85 - cl) / 45), cl)


def f_windy(c: Ctx) -> Result:
    w = c.x.get("wind")
    return None if w is None else (1 - clamp01((w - 3) / 3), w)


def f_uv(c: Ctx) -> Result:
    u = c.x.get("uv")
    return None if u is None else (1 - clamp01((u - 1.6) / 1.4), u)


def f_snow_trails(c: Ctx) -> Result:
    s = c.v.get("snow")
    return None if s is None else (1 - clamp01(s / 15), s)


def f_crowds(c: Ctx) -> Result:
    n = c.park.get("visitors_2025")
    return None if not n else (1 - clamp01((math.log10(n) - 5) / 1.7), n)


WANTS: dict[str, Callable[[Ctx], Result]] = {
    "stars": f_stars,
    "waterfalls": f_waterfalls,
    "wildflowers": f_wildflowers,
    "fall": f_fall,
    "snow_play": f_snow_play,
    "camping": f_camping,
    "calm": f_calm,
    "sunny": f_sunny,
    "hikes": f_hikes,
    "witness": f_witness,
    "mystery": f_mystery,
}
AVOIDS: dict[str, Callable[[Ctx], Result]] = {
    "bugs": f_bugs,
    "heat": _days("heat_days", 8),
    "freezing": _days("freeze_days", 8),
    "rain": _days("rainy_days", 12, 4),
    "muggy": f_muggy,
    "gray": f_gray,
    "windy": f_windy,
    "uv": f_uv,
    "snow_trails": f_snow_trails,
    "crowds": f_crowds,
    "fire": _days("fires", 15),
    "smoke": _days("smoky_days", 10),
}


def parse_chips(s: str | None, known: dict) -> dict[str, str]:
    """"stars,camping!" -> {"stars": "nice", "camping": "must"}; unknown keys are ignored."""
    out: dict[str, str] = {}
    for raw in (s or "").split(","):
        k = raw.strip()
        must = k.endswith("!")
        k = k.rstrip("!")
        if k in known:
            out[k] = "must" if must else "nice"
    return out


@dataclass
class TripPrefs:
    months: list[int]
    bands: list[tuple[float, float]]
    wants: dict[str, str] = field(default_factory=dict)
    avoids: dict[str, str] = field(default_factory=dict)
    horizon: str = "next_year"
    scenario: str = "ssp245"
    mystery: set[str] = field(default_factory=set)


def _evaluate(ctx: Ctx, tp: TripPrefs) -> dict:
    """Score one park-month-horizon."""
    reasons, total, weight, failed = [], 0.0, 0.0, []
    t = ctx.v.get("tmax")
    if t is not None:
        s = max(temp_score(t, lo, hi) for lo, hi in tp.bands)
        reasons.append({"key": "temperature", "kind": "feel", "level": "nice", "score": round(s, 3), "value": t})
        total += W_TEMP * s
        weight += W_TEMP
    for kind, chosen, table in (("want", tp.wants, WANTS), ("avoid", tp.avoids, AVOIDS)):
        for key, level in chosen.items():
            r = table[key](ctx)
            if r is None:
                reasons.append({"key": key, "kind": kind, "level": level, "score": None, "value": None})
                continue
            s, val = r
            w = W_MUST if level == "must" else W_NICE
            total += w * s
            weight += w
            if level == "must" and s < MUST_MIN:
                failed.append(key)
            reasons.append({"key": key, "kind": kind, "level": level, "score": round(s, 3), "value": val})
    score = round(100 * total / weight, 1) if weight else None
    return {"score": score, "failed": failed, "reasons": reasons}


def ok(e: dict | None) -> bool:
    return bool(e) and e["score"] is not None and not e["failed"]


def _year_best(evs: list[dict | None]) -> int | None:
    """Best passing month of the whole year."""
    sc = [(ev["score"], i + 1) for i, ev in enumerate(evs) if ok(ev)]
    return max(sc)[1] if sc else None


def plan_trip(parks: list, climate: dict[str, dict], tp: TripPrefs) -> dict:
    ex = extras()
    lo, hi = min(b[0] for b in tp.bands), max(b[1] for b in tp.bands)
    rows = []
    for p in parks:
        park = p.model_dump() if hasattr(p, "model_dump") else dict(p)
        cl = climate[park["id"]]
        months_x = (ex.get(park["id"]) or {}).get("months") or [{}] * 12
        melt = melt_shares([cl["months"][i]["snow"]["normal"] for i in range(12)])
        # Base values for all 12 months and 3 horizons.
        base = [score_park(cl, Prefs(m, lo, hi), tp.scenario) for m in range(1, 13)]
        evals: dict[str, list[dict | None]] = {h: [] for h in HORIZONS}
        for m in range(1, 13):
            for h in HORIZONS:
                v = base[m - 1][h].values
                if not v:
                    evals[h].append(None)
                    continue
                prev = base[(m - 2) % 12][h].values or {}
                ctx = Ctx(park, m, v, months_x[m - 1] or {}, prev, melt, tp.mystery)
                evals[h].append(_evaluate(ctx, tp))

        main = evals[tp.horizon]
        chosen = [m for m in tp.months if main[m - 1] is not None]
        passing = [m for m in chosen if ok(main[m - 1])]
        pool = passing or chosen
        best = max(pool, key=lambda m: main[m - 1]["score"] or 0) if pool else tp.months[0]
        e = main[best - 1] or {"score": None, "failed": [], "reasons": []}

        # Which single "must" would bring this park back (for "relax one thing").
        relax = sorted(
            {fk for m in chosen if main[m - 1] and len(main[m - 1]["failed"]) == 1 for fk in main[m - 1]["failed"]}
        ) if not passing else []

        now = evals["next_year"][best - 1]
        later = evals["y2050"][best - 1]
        delta = round(later["score"] - now["score"], 1) if now and later and now["score"] is not None and later["score"] is not None else None
        rows.append({
            "park": park,
            "ok": bool(passing),
            "best_month": best,
            "score": e["score"],
            "failed": e["failed"],
            "relax": relax,
            "reasons": e["reasons"],
            "scores": {h: (evals[h][best - 1] or {}).get("score") for h in HORIZONS},
            "values": {h: base[best - 1][h].values for h in HORIZONS},
            "month_scores": [
                {"score": ev["score"], "ok": ok(ev)} if ev else {"score": None, "ok": False} for ev in main
            ],
            "best_now": _year_best(evals["next_year"]),
            "best_2050": _year_best(evals["y2050"]),
            "change_2050": delta,
            "day_length": day_length(park["lat"], best),
            "fire_source": (ex.get(park["id"]) or {}).get("fire_source"),
        })
    rows.sort(key=lambda r: (not r["ok"], -(r["score"] or -1)))
    gains: dict[str, int] = {}
    for r in rows:
        for k in r["relax"]:
            gains[k] = gains.get(k, 0) + 1
    first = climate[parks[0].id if hasattr(parks[0], "id") else parks[0]["id"]]
    return {
        "months": tp.months,
        "horizon": tp.horizon,
        "this_year": first["this_year"],
        "next_year": first["next_year"],
        "scenario": tp.scenario,
        "matches": sum(r["ok"] for r in rows),
        "relax": [{"key": k, "parks": n} for k, n in sorted(gains.items(), key=lambda kv: -kv[1])],
        "new_moons": {m: new_moons(first["next_year"] if tp.horizon != "this_year" else first["this_year"], m) for m in range(1, 13)},
        "sources": (extras().get("_meta") or {}),
        "parks": rows,
    }
