"""Best days to visit: the days of the chosen month that fit the user's preferences best.

Each day gets the same 0-100 score as the month, using that day's value from the daily
curves in daily.py: the smoothed 1991-2020 day-of-year normal, shifted by the monthly
forecast (next year) or projection (2050); for this year, measured days are used where
they exist and the normal elsewhere. These are typical-weather days, NOT a weather
forecast: a day scores well when its usual weather suits the user, not because a given
day will be fine.

Daily factors: daytime high, humidity, dew point, rain (the monthly limit spread over
the month's days), clear skies. Factors without daily data (bugs, snowmelt) keep the
month's value on every day.
"""

from __future__ import annotations

import calendar

from app.parks.daily import curves
from app.parks.scoring import (
    Prefs,
    clamp01,
    dewpoint_score,
    humidity_score,
    rain_score,
    score_park,
    temp_score,
)

WINDOW = 5  # days in the "best stretch"
TOP_DAYS = 5


def _month_slice(month: int) -> tuple[int, int]:
    """First 0-based day-of-year index and length of the month in the 365-day curves."""
    start = sum(calendar.monthrange(2001, m)[1] for m in range(1, month))
    return start, calendar.monthrange(2001, month)[1]


def best_days(
    daily: dict, climate: dict, prefs: Prefs, scenario: str, horizon: str
) -> dict:
    out = {"horizon": horizon, "month": prefs.month, "days": None, "best_days": [],
           "window": None, "measured_days": None, "note": ""}
    cur = curves(daily, climate, scenario)
    normal = cur["normal"]
    series = cur[horizon]
    if series.get("tmax") is None:
        out["note"] = "No 2050 projection for this park's grid cell."
        return out

    monthly = score_park(climate, prefs, scenario)[horizon].factors
    start, n = _month_slice(prefs.month)
    rain_limit = prefs.rain_max / n if prefs.rain_max else None

    measured = 0
    days = []
    for i in range(start, start + n):
        def val(var: str):
            v = series.get(var)
            v = v[i] if v is not None else None
            if v is None and var in normal:
                v = normal[var][i]
            return v

        if horizon == "this_year" and series["tmax"][i] is not None:
            measured += 1
        tmax, rh, dew, pr, cl = (val(k) for k in ("tmax", "rh", "dewpoint", "precip", "cloud"))
        f: list[float] = []
        if tmax is not None:
            f.append(temp_score(tmax, prefs.t_lo, prefs.t_hi))
        if prefs.rh_max is not None and rh is not None:
            f.append(humidity_score(rh, prefs.rh_max))
        if prefs.dew_max is not None and dew is not None:
            f.append(dewpoint_score(dew, prefs.dew_max))
        if rain_limit is not None and pr is not None:
            f.append(rain_score(pr, rain_limit))
        if prefs.stars and cl is not None:
            f.append(clamp01(1 - cl / 100))
        for k in ("bugs", "snowmelt"):  # monthly only
            if monthly.get(k) is not None:
                f.append(monthly[k])
        days.append({
            "day": i - start + 1,
            "score": round(100 * sum(f) / len(f), 1) if f else None,
            "tmax": tmax, "rh": rh, "dewpoint": dew, "precip": pr,
        })

    mid = (prefs.t_lo + prefs.t_hi) / 2

    def tie(d: dict) -> float:
        """Among equal scores prefer a high closer to the middle of the ideal range, then drier."""
        return -abs((d["tmax"] if d["tmax"] is not None else mid) - mid) - 0.1 * (d["precip"] or 0)

    scored = [d for d in days if d["score"] is not None]
    if scored:
        top = sorted(scored, key=lambda d: (d["score"], tie(d)), reverse=True)[:TOP_DAYS]
        out["best_days"] = sorted(d["day"] for d in top)
        if len(days) >= WINDOW:
            best = None
            for a in range(len(days) - WINDOW + 1):
                w = days[a : a + WINDOW]
                if any(d["score"] is None for d in w):
                    continue
                key = (sum(d["score"] for d in w) / WINDOW, sum(tie(d) for d in w) / WINDOW)
                if best is None or key > best[0]:
                    best = (key, a)
            if best:
                a = best[1]
                out["window"] = {"start": days[a]["day"], "end": days[a + WINDOW - 1]["day"],
                                 "mean": round(best[0][0], 1)}
    out["days"] = days
    if horizon == "this_year":
        out["measured_days"] = measured
        out["note"] = (
            f"{measured} of {n} days already measured; the rest use the 1991–2020 daily normal."
            if measured else "Not measured yet: days use the 1991–2020 daily normal."
        )
    elif horizon == "next_year":
        out["note"] = "Typical weather for each day (1991–2020 shape, shifted by the forecast trend). Not a weather forecast."
    else:
        out["note"] = "Typical weather for each day, shifted by the 2041–2060 projection. Not a weather forecast."
    return out
