import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.datasets import noaa_gsom
from app.main import app

SEARCH_BODY = {
    "results": [
        {
            "centroid": [-73.0, 41.0],
            "startDate": "1950-01-01T00:00:00",
            "endDate": "2026-10-31T23:59:59",
            "dataTypes": [{"id": "TAVG"}, {"id": "PRCP"}, {"id": "WDMV"}],
            "stations": [{"id": "FAR00000001", "name": "FAR"}],
        },
        {
            "centroid": [-73.96925, 40.77898],
            "startDate": "1869-01-01T00:00:00",
            "endDate": "2026-10-31T23:59:59",
            "dataTypes": [{"id": "TAVG"}],
            "stations": [{"id": "USW00094728", "name": "NY CITY CENTRAL PARK, NY US"}],
        },
    ]
}

DATA_BODY = [
    {"STATION": "USW00094728", "DATE": "2023-02", "TAVG": "5.1", "PRCP": "32.6"},
    {"STATION": "USW00094728", "DATE": "2023-01", "TAVG": "6.4"},
]


@pytest.fixture(autouse=True)
def clear_cache():
    noaa_gsom._cache.clear()


def test_bbox_order_is_north_west_south_east():
    n, w, s, e = map(float, noaa_gsom.bbox(40.0, -74.0, 111.0).split(","))
    assert n == pytest.approx(41.0) and s == pytest.approx(39.0)
    assert w < -74.0 < e


def test_parse_stations_sorts_by_distance_and_filters_variables():
    out = noaa_gsom.parse_stations(SEARCH_BODY, 40.78, -73.97)
    assert [s.id for s in out] == ["USW00094728", "FAR00000001"]
    assert out[0].distance_km < 1
    assert out[1].variables == ["TAVG", "PRCP"]


def test_parse_series_sorts_and_fills_missing():
    s = noaa_gsom.parse_series(DATA_BODY, "USW00094728", ["TAVG", "PRCP"])
    assert [p.date for p in s.points] == ["2023-01", "2023-02"]
    assert s.points[0].values == {"TAVG": 6.4, "PRCP": None}


@respx.mock
def test_stations_endpoint():
    respx.get(noaa_gsom.SEARCH_URL).mock(
        return_value=httpx.Response(200, json=SEARCH_BODY)
    )
    with TestClient(app) as client:
        r = client.get(
            "/api/datasets/gsom/stations", params={"lat": 40.78, "lon": -73.97}
        )
    assert r.status_code == 200
    assert r.json()[0]["id"] == "USW00094728"
    # FAR station (~100 km) is outside the default 50 km radius.
    assert len(r.json()) == 1


@respx.mock
def test_series_endpoint_and_cache():
    route = respx.get(noaa_gsom.DATA_URL).mock(
        return_value=httpx.Response(200, json=DATA_BODY)
    )
    with TestClient(app) as client:
        params = {"station": "USW00094728", "variables": "TAVG,PRCP"}
        r1 = client.get("/api/datasets/gsom/series", params=params)
        r2 = client.get("/api/datasets/gsom/series", params=params)
    assert r1.status_code == 200 and r1.json() == r2.json()
    assert route.call_count == 1
    assert route.calls[0].request.url.params["units"] == "metric"


def test_series_rejects_bad_input():
    with TestClient(app) as client:
        assert (
            client.get("/api/datasets/gsom/series", params={"station": "x"}).status_code
            == 422
        )
        r = client.get(
            "/api/datasets/gsom/series",
            params={"station": "USW00094728", "variables": "NOPE"},
        )
        assert r.status_code == 422


@respx.mock
def test_upstream_failure_is_502():
    respx.get(noaa_gsom.SEARCH_URL).mock(return_value=httpx.Response(503))
    with TestClient(app) as client:
        r = client.get("/api/datasets/gsom/stations", params={"lat": 0, "lon": 0})
    assert r.status_code == 502


def test_datasets_listing():
    with TestClient(app) as client:
        r = client.get("/api/datasets")
    assert r.json()[0]["id"] == "gsom"
