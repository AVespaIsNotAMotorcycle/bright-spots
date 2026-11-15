"""Year-long daily curves per horizon, for the hover charts on the park cards.

The bundled daily file (scripts/prepare_parks.py) has the smoothed 1991-2020
day-of-year normal and this year's measured days. Next year and 2050 exist only as
monthly values, so their curves are the daily normal shifted by the monthly change
(next-year forecast or 2050 projection minus the monthly normal), interpolated
linearly between mid-month days around the year. Rain uses a ratio, the rest an
offset; variables without a 2050 projection keep the normal.
"""

from __future__ import annotations

import calendar
from collections.abc import Sequence

DAILY_VARS = ("tmax", "rh", "precip", "cloud")
BOUNDS = {"rh": (0.0, 100.0), "cloud": (0.0, 100.0), "precip": (0.0, None)}

# Day-of-year index (0-based, non-leap year) of each month's middle.
MID_MONTH = [
    sum(calendar.monthrange(2001, m)[1] for m in range(1, mo))
    + (calendar.monthrange(2001, mo)[1] - 1) / 2
    for mo in range(1, 13)
]


def interp_monthly(values: list[float]) -> list[float]:
    """12 monthly values -> 365 daily values, linear between mid-month points,
    wrapping December -> January."""
    out = []
    for d in range(365):
        # Find the mid-month points on either side of day d (circularly).
        nxt = next((i for i, m in enumerate(MID_MONTH) if m >= d), 0)
        prv = (nxt - 1) % 12
        x0, x1 = MID_MONTH[prv], MID_MONTH[nxt]
        if x1 < x0 or (nxt == 0 and d > MID_MONTH[-1]):  # across the year end
            x1 += 365
        dd = d + 365 if d < x0 else d
        t = 0.0 if x1 == x0 else (dd - x0) / (x1 - x0)
        out.append(values[prv] + t * (values[nxt] - values[prv]))
    return out


def _clip(var: str, v: float) -> float:
    lo, hi = BOUNDS.get(var, (None, None))
    if lo is not None:
        v = max(lo, v)
    if hi is not None:
        v = min(hi, v)
    return v


def shifted(
    var: str,
    normal_daily: Sequence[float | None],
    monthly_normal: Sequence[float | None],
    monthly_target: Sequence[float | None],
) -> list[float | None]:
    """The daily normal moved by the monthly change from monthly_normal to monthly_target."""
    ratio = var == "precip"
    change = []
    for n, t in zip(monthly_normal, monthly_target, strict=True):
        if n is None or t is None:
            change.append(1.0 if ratio else 0.0)
        elif ratio:
            change.append(t / n if n > 0 else 1.0)
        else:
            change.append(t - n)
    daily_change = interp_monthly(change)
    out: list[float | None] = []
    for v, c in zip(normal_daily, daily_change, strict=True):
        out.append(
            None if v is None else round(_clip(var, v * c if ratio else v + c), 1)
        )
    return out


def curves(daily: dict, climate: dict, scenario: str) -> dict:
    months = climate["months"]

    def monthly(var: str, pick) -> list[float | None]:
        return [pick(m[var]) for m in months]

    def next_value(h: dict) -> float | None:
        return h["next_year"]["value"] if h["next_year"] else None

    def proj_value(h: dict) -> float | None:
        p = h["y2050"]
        if p and scenario in p:
            return p[scenario]["value"]
        return h["normal"]  # not projected: keep the normal

    out: dict[str, dict] = {"normal": {}, "this_year": {}, "next_year": {}, "y2050": {}}
    has_2050 = (
        bool(months[0]["tmax"]["y2050"]) and scenario in months[0]["tmax"]["y2050"]
    )
    for var in DAILY_VARS:
        normal_daily = daily["normal"][var]
        normal_monthly = monthly(var, lambda h: h["normal"])
        out["normal"][var] = normal_daily
        out["this_year"][var] = daily["this_year"][var]
        out["next_year"][var] = shifted(
            var, normal_daily, normal_monthly, monthly(var, next_value)
        )
        out["y2050"][var] = (
            shifted(var, normal_daily, normal_monthly, monthly(var, proj_value))
            if has_2050
            else None
        )
    return out
