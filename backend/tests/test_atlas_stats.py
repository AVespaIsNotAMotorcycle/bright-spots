"""Atlas trend statistics (SPEC Feature 1)."""

import math

import numpy as np
import pytest

from app.atlas import stats as st

YEARS = list(range(1981, 2026))  # 45 years


def test_clean_trend_is_found_with_matching_slopes():
    rng = np.random.default_rng(1)
    vals = [0.03 * (y - 1981) + rng.normal(0, 0.2) for y in YEARS]
    c = st.trend(YEARS, vals)
    assert c.n == 45 and (c.first_year, c.last_year) == (1981, 2025)
    assert c.sen_per_decade == pytest.approx(0.3, abs=0.06)
    lo, ols, hi = c.ols_ci_low, c.ols_per_decade, c.ols_ci_high
    assert lo is not None and ols is not None and hi is not None
    assert lo < ols < hi and lo < 0.3 < hi
    assert c.p is not None and c.p < 1e-6 and c.direction == "up"
    assert c.sen_per_decade is not None and c.sd is not None
    assert c.snr == pytest.approx(c.sen_per_decade / c.sd)


def test_too_little_data_has_no_verdict():
    c = st.trend(YEARS[:14], [float(i) for i in range(14)])
    assert c.n == 14 and c.p is None and c.verdict == "too_little_data"
    gappy = [None if i % 3 else float(i) for i in range(45)]  # 15 valid years
    assert st.trend(YEARS, gappy).p is not None


def test_constant_series_is_no_change():
    c = st.trend(YEARS, [5.0] * 45)
    assert c.sen_per_decade == 0 and c.p == 1.0 and c.direction is None
    assert (c.ols_ci_low, c.ols_ci_high) == (0.0, 0.0)
    d = c.to_dict()
    assert all(not isinstance(v, float) or math.isfinite(v) for v in d.values())
    assert st.fdr([c])[0].verdict == "none"


def test_fdr_wording_ladder():
    def cell(p: float) -> st.Cell:
        return st.Cell(n=30, first_year=1990, last_year=2019, p=p)

    cells = st.fdr(
        [
            cell(0.001),
            cell(0.04),
            cell(0.5),
            st.Cell(n=5, first_year=2020, last_year=2024),
        ]
    )
    # BH over 3 tests: q = [0.003, 0.06, 0.5].
    assert [c.verdict for c in cells] == ["real", "possible", "none", "too_little_data"]
    assert cells[0].q == pytest.approx(0.003) and cells[1].q == pytest.approx(0.06)
    assert cells[3].q is None


def test_autocorrelation_flag_when_prewhitening_changes_significance():
    rng = np.random.default_rng(3)
    # A random walk: strongly autocorrelated, often "significant" before pre-whitening.
    flags = []
    for _ in range(40):
        walk = np.cumsum(rng.normal(0, 1, 45))
        c = st.trend(YEARS, list(walk))
        flags.append(c.autocorr_flag)
        assert c.p is not None and c.p_prewhitened is not None
        assert c.autocorr_flag == ((c.p < 0.05) != (c.p_prewhitened < 0.05))
    assert any(flags)


def test_period_series_months_seasons_annual():
    monthly = {
        (y, m): float(m) + (y - 2000) for y in (2000, 2001) for m in range(1, 13)
    }
    years, jul = st.period_series(monthly, "jul", total=False)
    assert years == [2000, 2001] and jul == [7.0, 8.0]
    _, djf = st.period_series(monthly, "djf", total=False)
    assert djf[0] is None  # no Dec 1999
    assert djf[1] == pytest.approx(
        (12 + 0 + 1 + 1 + 2 + 1) / 3
    )  # Dec 2000, Jan+Feb 2001
    _, ann = st.period_series(monthly, "annual", total=True)
    assert ann == [78.0, 90.0]
    del monthly[(2001, 5)]
    assert st.period_series(monthly, "annual", total=False)[1][1] is None
    assert st.period_series(monthly, "mam", total=False)[1][1] is None
    assert len(st.PERIODS) == 17
