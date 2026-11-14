"""Park suitability for a travel month, per horizon (SPEC Part 3).

Each preference becomes a factor score in [0, 1]; a park's score is the mean of the
factors that apply, times 100. Falloff widths and the bug-index thresholds below are
PROVISIONAL design choices, not values from a source; see the MVP open decisions.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field

# Provisional falloffs: how far outside the user's limit a factor reaches 0.
TEMP_FALLOFF_C = 8.0  # daytime high this far outside the ideal range scores 0
RH_FALLOFF_PCT = 20.0  # humidity this far above the user's maximum scores 0
# Rain: double the user's maximum scores 0.

# Provisional bug-activity proxy (mosquitoes and biting flies): activity needs warmth
# and moisture. No validated source yet; label as an estimate.
BUG_T_MIN_C, BUG_T_FULL_C = 10.0, 22.0  # mean temp: no activity below, full at/above
BUG_RH_MIN, BUG_RH_FULL = 40.0, 80.0  # relative humidity ramp
BUG_RAIN_FULL_MM = 100.0  # monthly rain giving full standing-water term

# Snowmelt: parks whose normal peak monthly snow depth is below this have no
# snowmelt season to speak of. Provisional.
SNOWPACK_MIN_CM = 5.0

VARS = ("tmax", "t2m", "rh", "precip", "cloud", "snow")


@dataclass(frozen=True)
class Prefs:
    month: int  # 1-12
    t_lo: float  # ideal daytime high range, C
    t_hi: float
    rh_max: float | None = None  # %, None = no preference
    rain_max: float | None = None  # mm per month, None = no preference
    avoid_bugs: bool = False
    stars: bool = False
    snowmelt: bool = False


@dataclass
class Scored:
    score: float | None
    low: float | None
    high: float | None
    factors: dict[str, float | None]
    values: dict[str, float | None]
    notes: list[str] = field(default_factory=list)


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def temp_score(tmax: float, lo: float, hi: float) -> float:
    if lo <= tmax <= hi:
        return 1.0
    dist = lo - tmax if tmax < lo else tmax - hi
    return clamp01(1 - dist / TEMP_FALLOFF_C)


def humidity_score(rh: float, rh_max: float) -> float:
    return 1.0 if rh <= rh_max else clamp01(1 - (rh - rh_max) / RH_FALLOFF_PCT)


def rain_score(precip: float, rain_max: float) -> float:
    if precip <= rain_max:
        return 1.0
    return clamp01(1 - (precip - rain_max) / rain_max) if rain_max > 0 else 0.0


def bug_index(t2m: float, rh: float, precip: float) -> float:
    """0 (no biting insects expected) to 1 (peak conditions). Provisional proxy."""
    warm = clamp01((t2m - BUG_T_MIN_C) / (BUG_T_FULL_C - BUG_T_MIN_C))
    humid = clamp01((rh - BUG_RH_MIN) / (BUG_RH_FULL - BUG_RH_MIN))
    wet = clamp01(precip / BUG_RAIN_FULL_MM)
    return warm * (0.5 * humid + 0.5 * wet)


def melt_shares(snow: Sequence[float | None]) -> list[float] | None:
    """Share of the year's snow-depth decline in each month; None without a snowpack."""
    s = [v or 0.0 for v in snow]
    if max(s) < SNOWPACK_MIN_CM:
        return None
    drops = [max(0.0, s[m - 1] - s[m]) for m in range(12)]  # m-1 wraps Dec -> Jan
    total = sum(drops)
    return [d / total for d in drops] if total > 0 else None


def melt_score(shares: list[float] | None, month: int) -> float:
    if shares is None:
        return 0.0
    return shares[month - 1] / max(shares)


def score(
    values: dict[str, float | None], prefs: Prefs, melt: list[float] | None
) -> Scored:
    f: dict[str, float | None] = {}
    v = values
    f["temperature"] = (
        None if v["tmax"] is None else temp_score(v["tmax"], prefs.t_lo, prefs.t_hi)
    )
    if prefs.rh_max is not None:
        f["humidity"] = (
            None if v["rh"] is None else humidity_score(v["rh"], prefs.rh_max)
        )
    if prefs.rain_max is not None:
        f["rain"] = (
            None if v["precip"] is None else rain_score(v["precip"], prefs.rain_max)
        )
    if prefs.avoid_bugs:
        t2m, rh, precip = v["t2m"], v["rh"], v["precip"]
        ok = t2m is not None and rh is not None and precip is not None
        f["bugs"] = 1 - bug_index(t2m, rh, precip) if ok else None
    if prefs.stars:
        f["stars"] = None if v["cloud"] is None else clamp01(1 - v["cloud"] / 100)
    if prefs.snowmelt:
        f["snowmelt"] = melt_score(melt, prefs.month)
    known = [x for x in f.values() if x is not None]
    s = round(100 * sum(known) / len(known), 1) if known else None
    return Scored(score=s, low=s, high=s, factors=f, values=dict(v))


def _pick(entry: dict, var: str, key: str, part: str = "value") -> float | None:
    h = entry[var][key]
    if h is None:
        return None
    return h if isinstance(h, (int, float)) else h.get(part)


def score_park(climate: dict, prefs: Prefs, scenario: str) -> dict[str, Scored]:
    """Scores for this_year, next_year and y2050 for one park's bundled climate."""
    months = climate["months"]
    m = months[prefs.month - 1]
    normal = {var: m[var]["normal"] for var in VARS}
    normal_melt = melt_shares([months[i]["snow"]["normal"] for i in range(12)])
    out: dict[str, Scored] = {}

    # This year: measured where available, otherwise the normal (and say so).
    measured = {var: m[var]["this_year"] for var in VARS}
    this_vals = {
        var: measured[var] if measured[var] is not None else normal[var] for var in VARS
    }
    this_melt = melt_shares(
        [
            months[i]["snow"]["this_year"]
            if months[i]["snow"]["this_year"] is not None
            else months[i]["snow"]["normal"]
            for i in range(12)
        ]
    )
    s = score(this_vals, prefs, this_melt)
    if measured["tmax"] is None:
        s.notes.append(
            f"{climate['this_year']} not measured yet for this month: showing the 1991-2020 normal"
        )
    out["this_year"] = s

    # Next year: trend forecast; range from the +-1 sd window.
    def at(part: str) -> dict[str, float | None]:
        return {
            var: _pick(m, var, "next_year", part)
            if m[var]["next_year"] is not None
            else normal[var]
            for var in VARS
        }

    mid, lo, hi = (score(at(p), prefs, normal_melt) for p in ("value", "low", "high"))
    mid.low, mid.high = _range(mid, lo, hi)
    mid.notes.append(
        "Forecast from the record: the 1991 onward trend for this month extended one year, "
        "range = year-to-year scatter. Not a weather forecast."
    )
    out["next_year"] = mid

    # 2050: projected temperature and precipitation; humidity, cloud and snow keep
    # the normal (not projected in the bundled data).
    def proj(part: str) -> dict[str, float | None]:
        vals = dict(normal)
        for var in ("tmax", "t2m", "precip"):
            p = m[var]["y2050"]
            if p and scenario in p:
                vals[var] = p[scenario][part]
        return vals

    has_proj = bool(m["tmax"]["y2050"]) and scenario in (m["tmax"]["y2050"] or {})
    if has_proj:
        mid, lo, hi = (
            score(proj(p), prefs, normal_melt) for p in ("value", "low", "high")
        )
        mid.low, mid.high = _range(mid, lo, hi)
        mid.notes.append(
            "Projected (2041-2060, CMIP6 via WorldClim): temperature and rain change; "
            "humidity, cloud and snow shown at today's normal."
        )
        if prefs.snowmelt and normal_melt is not None:
            mid.notes.append(
                "Snowmelt timing uses today's normal; the measured direction is earlier "
                "(2-3 weeks over ~30 years in the West, Clow 2010)."
            )
    else:
        mid = Scored(
            None, None, None, {}, {}, ["No 2050 projection for this park's grid cell."]
        )
    out["y2050"] = mid
    return out


def _range(mid: Scored, lo: Scored, hi: Scored) -> tuple[float | None, float | None]:
    xs = [x.score for x in (mid, lo, hi) if x.score is not None]
    return (min(xs), max(xs)) if xs else (None, None)
