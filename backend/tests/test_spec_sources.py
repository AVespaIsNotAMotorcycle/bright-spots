"""Tests for the spec's six data sources (HTTP mocked with respx)."""

import httpx
import numpy as np
import pytest
import respx
from fastapi.testclient import TestClient

from app import http
from app.datasets import bundled, nominatim, ornl, power
from app.main import app


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    http.clear_cache()
    monkeypatch.setattr(http, "RETRY_BACKOFF_S", (0.0, 0.0))
    monkeypatch.setattr(nominatim, "MIN_INTERVAL_S", 0.0)


# ---------- shared http helper ----------


@respx.mock
async def test_get_json_retries_5xx_then_succeeds():
    route = respx.get("https://x.test/a").mock(
        side_effect=[httpx.Response(503), httpx.Response(200, json={"ok": 1})]
    )
    async with httpx.AsyncClient() as c:
        assert await http.get_json(c, "https://x.test/a", backoff_s=(0, 0)) == {"ok": 1}
    assert route.call_count == 2


@respx.mock
async def test_get_json_does_not_retry_4xx():
    route = respx.get("https://x.test/b").mock(return_value=httpx.Response(404))
    async with httpx.AsyncClient() as c:
        with pytest.raises(httpx.HTTPStatusError):
            await http.get_json(c, "https://x.test/b", backoff_s=(0, 0))
    assert route.call_count == 1


# ---------- POWER ----------

POWER_BODY = {
    "geometry": {"coordinates": [-73.97, 40.78, 75.8]},
    "properties": {
        "parameter": {
            "PRECTOTCORR": {
                **{f"2023{m:02d}": 2.0 for m in range(1, 13)},
                "202313": 9.9,
            },
            "T2M": {**{f"2023{m:02d}": 10.0 for m in range(1, 13)}, "202302": -999.0},
            "GWETROOT": {f"2023{m:02d}": 0.5 for m in range(1, 13)},
        }
    },
}


def test_power_parse_converts_rain_and_drops_missing():
    r = power.parse(POWER_BODY, 40.78, -73.97)
    assert len(r.monthly) == 12  # key ...13 ignored
    feb = r.monthly[1]
    assert feb.values["RAIN"] == 56.0  # 2.0 mm/day * 28 days
    assert feb.values["T2M"] is None
    y = r.yearly[0]
    assert y.rain_mm == 730.0  # 2.0 * 365
    assert y.t2m_c is None  # incomplete year
    assert y.gwetroot == 0.5
    assert r.elevation_m == 75.8


@respx.mock
def test_power_endpoint():
    route = respx.get(power.URL).mock(return_value=httpx.Response(200, json=POWER_BODY))
    with TestClient(app) as c:
        r = c.get("/api/datasets/power/monthly", params={"lat": 40.78, "lon": -73.97})
    assert r.status_code == 200
    q = route.calls[0].request.url.params
    assert q["community"] == "AG" and q["parameters"] == "PRECTOTCORR,T2M,GWETROOT"


# ---------- Nominatim ----------


def test_parse_coords():
    p = nominatim.parse_coords(" -1.29, 36.82 ")
    assert p and (p.lat, p.lon, p.source) == (-1.29, 36.82, "coordinates")
    assert nominatim.parse_coords("40.7 -73.9")
    assert nominatim.parse_coords("Nairobi") is None
    assert nominatim.parse_coords("95, 10") is None


@respx.mock
def test_geocode_coords_skip_lookup_and_text_hits_nominatim():
    route = respx.get(nominatim.URL).mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "display_name": "Nairobi, Kenya",
                    "lat": "-1.30",
                    "lon": "36.83",
                    "boundingbox": ["-1.4", "-1.1", "36.6", "37.1"],
                }
            ],
        )
    )
    with TestClient(app) as c:
        assert (
            c.get("/api/geocode", params={"q": "1, 2"}).json()[0]["source"]
            == "coordinates"
        )
        assert route.call_count == 0
        r = c.get("/api/geocode", params={"q": "Nairobi"}).json()
        c.get("/api/geocode", params={"q": "Nairobi"})  # cached
    assert r[0]["name"] == "Nairobi, Kenya" and r[0]["bbox"] == [-1.4, -1.1, 36.6, 37.1]
    assert route.call_count == 1
    assert route.calls[0].request.headers["user-agent"].startswith("BrightSpots/0.1")


# ---------- ORNL ----------


def _row(d: str, band: str, v: int) -> dict:
    return {"calendar_date": d, "band": band, "data": [v]}


def test_date_windows_hold_at_most_10_composites():
    for period in (8, 16):
        for s, e in ornl.date_windows(2020, 2021, period):
            ds, de = int(s[5:]), int(e[5:])
            n = len([d for d in range(1, 367, period) if ds <= d <= de])
            assert n <= ornl.MAX_DATES_PER_REQUEST
    assert ornl.date_windows(2020, 2020, 16)[0] == ("A2020001", "A2020160")


def test_parse_subset_ndvi_quality_and_fill():
    body = {
        "subset": [
            _row("2020-01-01", "250m_16_days_NDVI", 4312),
            _row("2020-01-01", "250m_16_days_pixel_reliability", 0),
            _row("2020-01-01", "250m_16_days_EVI", 1),
            _row("2020-01-17", "250m_16_days_NDVI", 5000),
            _row("2020-01-17", "250m_16_days_pixel_reliability", 3),
            _row("2020-02-02", "250m_16_days_NDVI", -3000),
            _row("2020-02-02", "250m_16_days_pixel_reliability", 0),
        ]
    }
    obs = ornl.parse_subset(body, ornl.PRODUCTS["MOD13Q1"])
    assert [(o.date, o.value, o.kept) for o in obs] == [
        ("2020-01-01", 0.4312, True),
        ("2020-01-17", 0.5, False),
        ("2020-02-02", None, False),
    ]


def test_parse_subset_lst_kelvin_to_celsius():
    body = {
        "subset": [
            _row("2020-07-11", "LST_Day_1km", 15000),  # 300 K
            _row("2020-07-11", "QC_Day", 0),
            _row("2020-07-19", "LST_Day_1km", 15000),
            _row("2020-07-19", "QC_Day", 2),  # not produced
        ]
    }
    obs = ornl.parse_subset(body, ornl.PRODUCTS["MOD11A2"])
    assert obs[0].value == pytest.approx(26.85) and obs[0].kept
    assert not obs[1].kept


@respx.mock
def test_modis_series_endpoint_and_all_failed_is_502():
    respx.get(f"{ornl.BASE}/MOD13Q1/subset").mock(
        return_value=httpx.Response(
            200,
            json={
                "subset": [
                    _row("2020-01-01", "250m_16_days_NDVI", 4000),
                    _row("2020-01-01", "250m_16_days_pixel_reliability", 1),
                ]
            },
        )
    )
    respx.get(f"{ornl.BASE}/MOD11A2/subset").mock(return_value=httpx.Response(503))
    with TestClient(app) as c:
        ok = c.get(
            "/api/datasets/modis/series",
            params={"lat": 1, "lon": 2, "start": 2020, "end": 2020},
        )
        bad = c.get(
            "/api/datasets/modis/series",
            params={
                "lat": 1,
                "lon": 2,
                "product": "MOD11A2",
                "start": 2020,
                "end": 2020,
            },
        )
    assert ok.status_code == 200
    body = ok.json()
    assert body["requests"] == 3 and body["failed_requests"] == 0
    assert body["observations"][0] == {"date": "2020-01-01", "value": 0.4, "kept": True}
    assert bad.status_code == 502


@respx.mock
def test_landcover_first_and_latest():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.params["startDate"] == "A2001001":
            rows = [_row("2001-01-01", "LC_Type1", 12)]
        else:
            rows = [
                _row("2022-01-01", "LC_Type1", 12),
                _row("2023-01-01", "LC_Type1", 13),
            ]
        return httpx.Response(200, json={"subset": rows})

    respx.get(f"{ornl.BASE}/MCD12Q1/subset").mock(side_effect=handler)
    with TestClient(app) as c:
        r = c.get("/api/datasets/modis/landcover", params={"lat": 1, "lon": 2}).json()
    assert r["first"]["name"] == "Cropland"
    assert r["latest"] == {"year": 2023, "code": 13, "name": "Urban and built-up"}
    assert r["changed"] is True


# ---------- bundled files ----------


def test_grace_and_koppen_cells():
    assert bundled.grace_cell(-90, -180) == (0, 0)
    assert bundled.grace_cell(90, 180) == (179, 359)
    assert bundled.grace_cell(0.5, 0.5) == (90, 180)
    assert bundled.koppen_cell(90, -180) == (0, 0)
    assert bundled.koppen_cell(-90, 180) == (359, 719)


@pytest.fixture
def fake_bundled(tmp_path, monkeypatch):
    lwe = np.full((2, 180, 360), np.nan, dtype=np.float32)
    lwe[:, 130, 106] = [1.5, -2.25]  # cell containing (40.78, -73.97)
    np.savez_compressed(
        tmp_path / "g.npz",
        lwe=lwe,
        time=np.array(["2002-04", "2002-05"]),
        lat=np.arange(-89.5, 90, 1.0),
        lon=np.arange(-179.5, 180, 1.0),
    )
    now = np.zeros((360, 720), np.uint8)
    fut = np.zeros((360, 720), np.uint8)
    now[98, 212], fut[98, 212] = 25, 14  # (40.78, -73.97)
    np.savez_compressed(tmp_path / "k.npz", now=now, future=fut)
    (tmp_path / "k.json").write_text(
        '{"14": {"code": "Cfa", "name": "Temperate, no dry season, hot summer", "rgb": [200,255,80]},'
        ' "25": {"code": "Dfa", "name": "Cold, no dry season, hot summer", "rgb": [0,255,255]}}'
    )
    monkeypatch.setattr(bundled, "GRACE_FILE", tmp_path / "g.npz")
    monkeypatch.setattr(bundled, "KOPPEN_FILE", tmp_path / "k.npz")
    monkeypatch.setattr(bundled, "KOPPEN_LEGEND", tmp_path / "k.json")
    bundled._grace.cache_clear()
    bundled._koppen.cache_clear()
    yield
    bundled._grace.cache_clear()
    bundled._koppen.cache_clear()


def test_bundled_endpoints(fake_bundled):
    with TestClient(app) as c:
        g = c.get(
            "/api/datasets/grace/series", params={"lat": 40.78, "lon": -73.97}
        ).json()
        ocean = c.get(
            "/api/datasets/grace/series", params={"lat": 0, "lon": -30}
        ).json()
        k = c.get(
            "/api/datasets/koppen/lookup", params={"lat": 40.78, "lon": -73.97}
        ).json()
        k_ocean = c.get(
            "/api/datasets/koppen/lookup", params={"lat": 0, "lon": -30}
        ).json()
    assert g["land"] and [m["lwe_cm"] for m in g["months"]] == [1.5, -2.25]
    assert (g["cell_lat"], g["cell_lon"]) == (40.5, -73.5)
    assert ocean == {**ocean, "land": False, "months": []}
    assert k["now"]["code"] == "Dfa" and k["future"]["code"] == "Cfa" and k["changed"]
    assert k_ocean["now"] is None and k_ocean["changed"] is None


def test_bundled_missing_file_is_503(tmp_path, monkeypatch):
    monkeypatch.setattr(bundled, "GRACE_FILE", tmp_path / "nope.npz")
    bundled._grace.cache_clear()
    with TestClient(app) as c:
        r = c.get("/api/datasets/grace/series", params={"lat": 0, "lon": 0})
    bundled._grace.cache_clear()
    assert r.status_code == 503 and "prepare_grace" in r.json()["detail"]


def test_datasets_lists_six_spec_sources_plus_gsom():
    with TestClient(app) as c:
        ids = [d["id"] for d in c.get("/api/datasets").json()]
    assert ids == ["power", "modis", "grace", "koppen", "gibs", "gsom"]
