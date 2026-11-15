"""NASA POWER helpers shared by the prep scripts and the API.

POWER's *monthly* T2M_MAX is the month's highest daily maximum (verified on
2026-11-14: Yellowstone July 2000 monthly T2M_MAX 30.94 C = the max of the daily
values; their mean was 23.77 C). The typical daytime high is the mean of the
daily maxima, so it is computed here from the *daily* endpoint.
"""

from __future__ import annotations

import calendar
import statistics

MISSING = -999


def monthly_mean_of_daily(daily: dict[str, float]) -> dict[tuple[int, int], float]:
    """{YYYYMMDD: value} -> {(year, month): mean}, complete months only."""
    by_month: dict[tuple[int, int], list[float]] = {}
    for key, v in daily.items():
        if v == MISSING:
            continue
        by_month.setdefault((int(key[:4]), int(key[4:6])), []).append(v)
    return {
        ym: statistics.fmean(vs)
        for ym, vs in by_month.items()
        if len(vs) == calendar.monthrange(*ym)[1]
    }
