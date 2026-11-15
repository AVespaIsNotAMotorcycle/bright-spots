"""Park planner: factor scores, horizons and the /api/parks endpoints."""

import json

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.main import app
from app.parks import daily as dc
from app.parks import router as parks_router
from app.parks import scoring as sc


def test_temp_score_band_and_falloff():
    assert sc.temp_score(25, 20, 28) == 1
    assert sc.temp_score(20 - sc.TEMP_FALLOFF_C / 2, 20, 28) == pytest.approx(0.5)
    assert sc.temp_score(40, 20, 28) == 0


def test_humidity_and_rain_scores():
    assert sc.humidity_score(50, 60) == 1
    assert sc.humidity_score(70, 60) == pytest.approx(0.5)
    assert sc.rain_score(30, 50) == 1
    assert sc.rain_score(75, 50) == pytest.approx(0.5)
    assert sc.rain_score(100, 50) == 0
    assert sc.rain_score(10, 0) == 0


def test_bug_index_needs_warmth_and_moisture():
    assert sc.bug_index(5, 90, 200) == 0  # too cold
    assert sc.bug_index(30, 90, 200) == 1  # warm, humid, wet
    assert sc.bug_index(30, 20, 0) == 0  # warm but dry
    assert 0 < sc.bug_index(16, 60, 50) < 1


def test_melt_shares_peak_month_and_no_snowpack():
    snow = [40, 45, 40, 20, 2, 0, 0, 0, 0, 0, 5, 20]
    shares = sc.melt_shares(snow)
    assert shares is not None and sum(shares) == pytest.approx(1)
    assert shares.index(max(shares)) == 3  # April: 40 -> 20 cm is the biggest drop
    assert sc.melt_score(shares, 4) == 1 and sc.melt_score(shares, 8) == 0
    assert sc.melt_shares([1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1]) is None


def _var(normal, this=None, nxt=None, y2050=None):
    return {"normal": normal, "this_year": this, "next_year": nxt, "y2050": y2050}


def _climate(tmax_this=None):
    months = []
    for m in range(12):
        snow = [40, 45, 40, 20, 2, 0, 0, 0, 0, 0, 5, 20][m]
        months.append(
            {
                "tmax": _var(
                    24.0,
                    this=tmax_this if m == 6 else None,
                    nxt={"value": 25.0, "low": 23.0, "high": 27.0},
                    y2050={"ssp245": {"value": 27.0, "low": 26.0, "high": 29.0}},
                ),
                "t2m": _var(
                    15.0, y2050={"ssp245": {"value": 18.0, "low": 17.0, "high": 20.0}}
                ),
                "rh": _var(50.0),
                "precip": _var(
                    40.0, y2050={"ssp245": {"value": 44.0, "low": 40.0, "high": 50.0}}
                ),
                "cloud": _var(30.0),
                "snow": _var(float(snow)),
            }
        )
    return {"id": "test-park", "this_year": 2026, "next_year": 2027, "months": months}


def test_score_park_horizons():
    prefs = sc.Prefs(month=7, t_lo=20, t_hi=26, rh_max=60, rain_max=50, stars=True)
    s = sc.score_park(_climate(tmax_this=22.0), prefs, "ssp245")
    assert s["this_year"].values["tmax"] == 22.0 and s["this_year"].notes == []
    assert s["next_year"].values["tmax"] == 25.0
    nxt = s["next_year"]
    assert nxt.low is not None and nxt.score is not None and nxt.high is not None
    assert nxt.low <= nxt.score <= nxt.high
    assert s["y2050"].values["tmax"] == 27.0 and s["y2050"].values["rh"] == 50.0
    # 27 C is 1 C above the range: temperature factor 1 - 1/8.
    assert s["y2050"].factors["temperature"] == pytest.approx(1 - 1 / sc.TEMP_FALLOFF_C)
    y50, now = s["y2050"].score, s["this_year"].score
    assert y50 is not None and now is not None and y50 < now


def test_unmeasured_month_falls_back_to_normal_and_says_so():
    s = sc.score_park(_climate(), sc.Prefs(month=7, t_lo=20, t_hi=26), "ssp245")
    assert s["this_year"].values["tmax"] == 24.0
    assert "not measured yet" in s["this_year"].notes[0]


def test_missing_scenario_has_no_2050_score():
    s = sc.score_park(_climate(), sc.Prefs(month=7, t_lo=20, t_hi=26), "ssp585")
    assert s["y2050"].score is None and "No 2050 projection" in s["y2050"].notes[0]


@pytest.fixture
def fake_parks(tmp_path, monkeypatch):
    park = {"id": "test-park", "code": "tstp", "name": "Test National Park", "short": "Test",
            "states": ["Utah"], "lat": 38.0, "lon": -110.0, "visitors_2025": 1000}  # fmt: skip
    (tmp_path / "parks.json").write_text(json.dumps([park]))
    (tmp_path / "park_climate.json").write_text(
        json.dumps({"test-park": _climate(22.0)})
    )
    monkeypatch.setattr(parks_router, "DATA_DIR", tmp_path)
    parks_router.load.cache_clear()
    yield
    parks_router.load.cache_clear()


def test_plan_endpoint(fake_parks):
    with TestClient(app) as c:
        r = c.get(
            "/api/parks/plan",
            params={"month": 7, "t_lo": 20, "t_hi": 26, "snowmelt": "true"},
        )
        bad = c.get("/api/parks/plan", params={"month": 7, "t_lo": 30, "t_hi": 20})
        parks = c.get("/api/parks").json()
    assert r.status_code == 200
    body = r.json()
    assert (body["month"], body["this_year"], body["next_year"]) == (7, 2026, 2027)
    p = body["parks"][0]
    assert p["park"]["short"] == "Test" and p["this_year"]["factors"]["snowmelt"] == 0
    assert set(p) == {"park", "this_year", "next_year", "y2050"}
    assert bad.status_code == 422
    assert parks[0]["id"] == "test-park"


def test_plan_missing_data_is_503(tmp_path, monkeypatch):
    monkeypatch.setattr(parks_router, "DATA_DIR", tmp_path)
    parks_router.load.cache_clear()
    with TestClient(app) as c:
        r = c.get("/api/parks/plan", params={"month": 7, "t_lo": 20, "t_hi": 26})
    parks_router.load.cache_clear()
    assert r.status_code == 503


# ---------- daily curves ----------


def test_interp_monthly_hits_mid_month_values_and_wraps():
    vals = [float(m) for m in range(12)]  # 0 in Jan ... 11 in Dec
    d = dc.interp_monthly(vals)
    assert len(d) == 365
    for m, mid in enumerate(dc.MID_MONTH):
        if mid == int(mid):
            assert d[int(mid)] == pytest.approx(vals[m])
    # Between mid-Dec (11) and mid-Jan (0) the curve runs smoothly from 11 down to 0.
    assert d[364] < 11 and d[0] > 0 and d[364] > d[0]
    assert dc.interp_monthly([5.0] * 12) == [5.0] * 365


def test_shifted_offset_ratio_and_bounds():
    normal = [10.0] * 365
    assert dc.shifted("tmax", normal, [0.0] * 12, [2.0] * 12) == [12.0] * 365
    assert dc.shifted("precip", [2.0] * 365, [50.0] * 12, [75.0] * 12) == [3.0] * 365
    assert set(dc.shifted("rh", [95.0] * 365, [50.0] * 12, [60.0] * 12)) == {100.0}
    assert dc.shifted("tmax", [None] * 365, [0.0] * 12, [1.0] * 12) == [None] * 365


def test_daily_endpoint(fake_parks, tmp_path):
    (tmp_path / "daily").mkdir()
    curves = {
        "year": 2026,
        "through": "2026-11-14",
        "normal": {v: [10.0] * 365 for v in dc.DAILY_VARS},
        "this_year": {v: [11.0] * 200 + [None] * 165 for v in dc.DAILY_VARS},
    }
    (tmp_path / "daily" / "test-park.json").write_text(json.dumps(curves))
    with TestClient(app) as c:
        r = c.get("/api/parks/test-park/daily")
        other = c.get("/api/parks/test-park/daily", params={"scenario": "ssp585"})
        missing = c.get("/api/parks/nope/daily")
    assert r.status_code == 200
    body = r.json()
    assert body["year"] == 2026 and len(body["normal"]["tmax"]) == 365
    # Fixture: tmax normal 24, next year 25 (+1), 2050 SSP2-4.5 27 (+3).
    assert body["next_year"]["tmax"][180] == pytest.approx(11.0)
    assert body["y2050"]["tmax"][180] == pytest.approx(13.0)
    assert body["y2050"]["rh"][180] == pytest.approx(10.0)  # not projected
    assert (
        body["this_year"]["tmax"][199] == 11.0
        and body["this_year"]["tmax"][200] is None
    )
    assert other.json()["y2050"]["tmax"] is None  # fixture has no SSP5-8.5
    assert missing.status_code == 404


def test_next_year_note_names_real_trends():
    c = _climate()
    c["months"][6]["tmax"]["next_year"]["basis"] = "trend"
    s = sc.score_park(c, sc.Prefs(month=7, t_lo=20, t_hi=26), "ssp245")
    assert "Real trend applied: daytime high." in s["next_year"].notes
    plain = sc.score_park(_climate(), sc.Prefs(month=7, t_lo=20, t_hi=26), "ssp245")
    assert not any("Real trend applied" in n for n in plain["next_year"].notes)


@respx.mock
def test_city_normals_endpoint():
    import calendar

    from app.parks import city

    def monthly(value: float) -> dict[str, float]:
        return {f"{y}{m:02d}": value for y in range(1990, 2022) for m in range(1, 14)}

    body = {
        "properties": {
            "parameter": {"RH2M": monthly(50.0), "PRECTOTCORR": monthly(2.0)}
        }
    }
    # Daily maxima: 20 C every day, except July 2019 at 30 C; July 1995 missing a day.
    daily = {
        f"{y}{m:02d}{d:02d}": (30.0 if (y, m) == (2019, 7) else 20.0)
        for y in range(1991, 2021)
        for m in range(1, 13)
        for d in range(1, calendar.monthrange(y, m)[1] + 1)
    }
    daily["19950704"] = -999.0
    respx.get(city.URL).mock(return_value=httpx.Response(200, json=body))
    respx.get(city.DAILY_URL).mock(
        return_value=httpx.Response(
            200, json={"properties": {"parameter": {"T2M_MAX": daily}}}
        )
    )
    with TestClient(app) as c:
        r = c.get("/api/parks/city-normals", params={"lat": 39.74, "lon": -104.98})
    assert r.status_code == 200
    m = r.json()["months"]
    assert len(m) == 12 and m[0] == {
        "month": 1,
        "tmax": 20.0,
        "rh": 50.0,
        "precip": 62.0,
    }
    # July: 28 complete Julys at 20 C plus 2019 at 30 C (1995 incomplete, dropped).
    assert m[6]["tmax"] == pytest.approx(round((28 * 20 + 30) / 29, 2))


def test_dewpoint_factor_and_missing_variable():
    assert sc.dewpoint_score(15, 16) == 1
    assert sc.dewpoint_score(16 + sc.DEW_FALLOFF_C / 2, 16) == pytest.approx(0.5)
    prefs = sc.Prefs(month=7, t_lo=20, t_hi=26, dew_max=16)
    c = _climate()
    for m in c["months"]:
        m["dewpoint"] = _var(18.5)
    s = sc.score_park(c, prefs, "ssp245")
    assert s["this_year"].factors["dewpoint"] == pytest.approx(
        1 - 2.5 / sc.DEW_FALLOFF_C
    )
    assert s["y2050"].values["dewpoint"] == 18.5  # not projected: the normal
    # Bundles without dew point still score; the factor is simply unknown.
    old = sc.score_park(_climate(), prefs, "ssp245")
    assert (
        old["this_year"].factors["dewpoint"] is None
        and old["this_year"].score is not None
    )


def test_plan_endpoint_accepts_dew_max(fake_parks):
    with TestClient(app) as c:
        r = c.get(
            "/api/parks/plan",
            params={"month": 7, "t_lo": 20, "t_hi": 26, "dew_max": 16},
        )
    assert (
        r.status_code == 200
        and "dewpoint" in r.json()["parks"][0]["this_year"]["factors"]
    )
