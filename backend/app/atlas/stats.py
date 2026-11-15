"""Trend statistics for the atlas (SPEC Feature 1), identical for every cell.

A cell is one park x variable x period (12 months, 4 seasons, annual). For its
yearly series:
  - Sen's slope (per decade) and the Mann-Kendall p-value (pymannkendall);
  - the same test after trend-free pre-whitening (Yue & Wang 2002) for
    autocorrelation; cells where significance at 0.05 differs are flagged;
  - OLS slope per decade with its 95% confidence interval;
  - year-to-year SD (of the OLS residuals) and signal-to-noise =
    Sen's slope per decade / SD;
  - fewer than MIN_YEARS valid years -> "too little data", no verdict.
Benjamini-Hochberg q-values are computed across parks within one
variable x period map (fdr()), and the verdict follows the spec's wording ladder:
  q < 0.05 -> "real"; p < 0.05 -> "possible"; otherwise "none".
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import asdict, dataclass

import numpy as np
import pymannkendall as mk
from scipy import stats as sps
from statsmodels.stats.multitest import multipletests

MIN_YEARS = 15
ALPHA = 0.05

MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
]
SEASONS = {"djf": (12, 1, 2), "mam": (3, 4, 5), "jja": (6, 7, 8), "son": (9, 10, 11)}
PERIODS = [*MONTHS, *SEASONS, "annual"]


@dataclass
class Cell:
    n: int
    first_year: int | None
    last_year: int | None
    sen_per_decade: float | None = None
    ols_per_decade: float | None = None
    ols_ci_low: float | None = None
    ols_ci_high: float | None = None
    p: float | None = None
    p_prewhitened: float | None = None
    autocorr_flag: bool = False  # significance changes after pre-whitening
    sd: float | None = None
    snr: float | None = None
    q: float | None = None
    verdict: str = "too_little_data"  # real | possible | none | too_little_data
    direction: str | None = None  # up | down | None

    def to_dict(self) -> dict:
        """JSON-safe: floats rounded, non-finite values (never expected) as None."""
        return {
            k: (round(v, 4) if math.isfinite(v) else None)
            if isinstance(v, float)
            else v
            for k, v in asdict(self).items()
        }


def trend(years: Sequence[int], values: Sequence[float | None]) -> Cell:
    """Statistics for one yearly series (missing values allowed). q and the final
    verdict are filled in by fdr() across parks."""
    pairs = [
        (y, v)
        for y, v in zip(years, values, strict=True)
        if v is not None and math.isfinite(v)
    ]
    n = len(pairs)
    if n == 0:
        return Cell(n=0, first_year=None, last_year=None)
    ys = np.array([y for y, _ in pairs], dtype=float)
    vs = np.array([v for _, v in pairs], dtype=float)
    cell = Cell(n=n, first_year=int(ys[0]), last_year=int(ys[-1]))
    if n < MIN_YEARS:
        return cell
    # Sen's slope on actual years (gaps allowed): median of pairwise slopes.
    i, j = np.triu_indices(n, k=1)
    sen = float(np.median((vs[j] - vs[i]) / (ys[j] - ys[i])))
    ols = sps.linregress(ys, vs)
    tcrit = float(sps.t.ppf(0.975, n - 2))
    resid = vs - (ols.intercept + ols.slope * ys)
    sd = float(np.std(resid, ddof=2))
    if np.ptp(vs) == 0:  # constant series: no trend, tests undefined
        p = p_pw = 1.0
    else:
        p = float(mk.original_test(vs).p)
        p_pw = float(mk.trend_free_pre_whitening_modification_test(vs).p)
    cell.sen_per_decade = sen * 10
    cell.ols_per_decade = float(ols.slope) * 10
    # A constant series fits exactly: scipy reports stderr NaN, the CI is [0, 0].
    stderr = float(ols.stderr) if math.isfinite(ols.stderr) else 0.0
    cell.ols_ci_low = (float(ols.slope) - tcrit * stderr) * 10
    cell.ols_ci_high = (float(ols.slope) + tcrit * stderr) * 10
    cell.p = p
    cell.p_prewhitened = p_pw
    cell.autocorr_flag = (p < ALPHA) != (p_pw < ALPHA)
    cell.sd = sd
    cell.snr = (sen * 10 / sd) if sd > 0 else None
    cell.direction = "up" if sen > 0 else "down" if sen < 0 else None
    return cell


def fdr(cells: list[Cell]) -> list[Cell]:
    """Benjamini-Hochberg across the cells of one map, then the wording ladder."""
    tested = [c for c in cells if c.p is not None]
    if tested:
        _, q, _, _ = multipletests([c.p for c in tested], alpha=ALPHA, method="fdr_bh")
        for c, qv in zip(tested, q, strict=True):
            c.q = float(qv)
            assert c.p is not None
            if c.q < ALPHA:
                c.verdict = "real"
            elif c.p < ALPHA:
                c.verdict = "possible"
            else:
                c.verdict = "none"
    return cells


def period_series(
    monthly: dict[tuple[int, int], float], period: str, total: bool
) -> tuple[list[int], list[float | None]]:
    """Yearly values for a period from {(year, month): value}. Months: that month.
    Seasons: mean (or total) of its three months, DJF dated by its January (needs
    the previous December). Annual: all 12 months. A year needs every month."""
    years = sorted({y for y, _ in monthly})
    out: list[float | None] = []
    for y in years:
        if period in MONTHS:
            keys = [(y, MONTHS.index(period) + 1)]
        elif period in SEASONS:
            keys = [
                (y - 1, m) if (period == "djf" and m == 12) else (y, m)
                for m in SEASONS[period]
            ]
        else:
            keys = [(y, m) for m in range(1, 13)]
        vals = [monthly.get(k) for k in keys]
        if any(v is None for v in vals):
            out.append(None)
            continue
        s = sum(v for v in vals if v is not None)
        out.append(s if total else s / len(vals))
    return years, out
