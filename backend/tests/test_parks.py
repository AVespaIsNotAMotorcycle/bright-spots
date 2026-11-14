"""Park planner: factor scores, horizons and the /api/parks endpoints."""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
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
