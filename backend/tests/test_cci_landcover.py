"""CCI / C3S land cover reader (spec 5.7) and its use as the ORNL fallback (5.1)."""

import json

import httpx
import numpy as np
import pytest
import rasterio
import respx
from fastapi.testclient import TestClient
from rasterio.transform import from_origin

from app import http
from app.datasets import cci_landcover, ornl
from app.main import app

PARIS = {"lat": 48.8566, "lon": 2.3522}  # 1 deg grid: row 41, col 182
SAME_GROUP = {"lat": 0.5, "lon": 0.5}  # row 89, col 180: 11 -> 10, both Cropland
LEGEND = {
    "0": "no_data",
    "10": "cropland_rainfed",
    "11": "cropland_rainfed_herbaceous_cover",
    "190": "urban",
    "210": "water",
}


def _write(path, grid: np.ndarray) -> None:
    with rasterio.open(
        path, "w", driver="GTiff", dtype="uint8", count=1, height=180, width=360,
        crs="EPSG:4326", transform=from_origin(-180, 90, 1, 1), nodata=0,
    ) as dst:  # fmt: skip
        dst.write(grid, 1)


@pytest.fixture
def fake_cci(tmp_path, monkeypatch):
    first = np.zeros((180, 360), np.uint8)
    latest = np.zeros((180, 360), np.uint8)
    first[41, 182], latest[41, 182] = 10, 190
    first[89, 180], latest[89, 180] = 11, 10
    first[179, 359] = latest[179, 359] = 210  # south-east corner
    _write(tmp_path / "lccs_1992.tif", first)
    _write(tmp_path / "lccs_2025.tif", latest)
    (tmp_path / "legend.json").write_text(json.dumps(LEGEND))
    (tmp_path / "lccs_2025.tif.part").write_text("ignored")
    monkeypatch.setattr(cci_landcover, "LANDCOVER_DIR", tmp_path)
    cci_landcover._legend.cache_clear()
    yield tmp_path
    cci_landcover._legend.cache_clear()


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    http.clear_cache()
    monkeypatch.setattr(http, "RETRY_BACKOFF_S", (0.0, 0.0))


def test_years_available_ignores_other_files(fake_cci):
    assert cci_landcover.years_available() == [1992, 2025]


def test_lookup_change_between_groups(fake_cci):
    r = cci_landcover.lookup(**PARIS).model_dump()
    assert r["source"] == "ESA CCI / C3S"
    assert r["first"] == {
        "year": 1992, "code": 10, "name": "Cropland rainfed", "group": "Cropland",
    }  # fmt: skip
    assert r["latest"] == {
        "year": 2025, "code": 190, "name": "Urban", "group": "Built-up",
    }  # fmt: skip
    assert r["changed"] is True


def test_lookup_subclass_change_within_group_is_not_changed(fake_cci):
    r = cci_landcover.lookup(**SAME_GROUP).model_dump()
    assert (r["first"]["code"], r["latest"]["code"]) == (11, 10)
    assert r["changed"] is False


def test_lookup_no_data_and_grid_edges(fake_cci):
    r = cci_landcover.lookup(lat=10, lon=10)
    assert r.first is None and r.latest is None and r.changed is None
    edge = cci_landcover.lookup(lat=-90, lon=180).model_dump()  # clamps to last pixel
    assert edge["first"]["group"] == "Water" and edge["changed"] is False


def test_every_group_code_has_a_group():
    assert set(cci_landcover.GROUPS.values()) == set(ornl.IGBP_GROUPS.values())


def test_cci_endpoint_and_missing_files_503(fake_cci, tmp_path_factory, monkeypatch):
    with TestClient(app) as c:
        ok = c.get("/api/datasets/cci/landcover", params=PARIS)
        monkeypatch.setattr(
            cci_landcover, "LANDCOVER_DIR", tmp_path_factory.mktemp("empty")
        )
        missing = c.get("/api/datasets/cci/landcover", params=PARIS)
    assert ok.status_code == 200 and ok.json()["latest"]["name"] == "Urban"
    assert missing.status_code == 503
    assert "prepare_landcover" in missing.json()["detail"]


@respx.mock
def test_landcover_falls_back_to_cci_when_ornl_fails(fake_cci):
    route = respx.get(f"{ornl.BASE}/MCD12Q1/subset").mock(
        return_value=httpx.Response(503)
    )
    with TestClient(app) as c:
        r = c.get("/api/datasets/modis/landcover", params=PARIS)
    assert route.called
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "ESA CCI / C3S" and body["changed"] is True
    assert (body["first"]["year"], body["latest"]["year"]) == (1992, 2025)


@respx.mock
def test_landcover_falls_back_when_ornl_returns_no_rows(fake_cci):
    respx.get(f"{ornl.BASE}/MCD12Q1/subset").mock(
        return_value=httpx.Response(200, json={"subset": []})
    )
    with TestClient(app) as c:
        body = c.get("/api/datasets/modis/landcover", params=PARIS).json()
    assert body["source"] == "ESA CCI / C3S"


@respx.mock
def test_landcover_ornl_down_and_no_cci_files_is_502(tmp_path, monkeypatch):
    monkeypatch.setattr(cci_landcover, "LANDCOVER_DIR", tmp_path)
    respx.get(f"{ornl.BASE}/MCD12Q1/subset").mock(return_value=httpx.Response(503))
    with TestClient(app) as c:
        r = c.get("/api/datasets/modis/landcover", params=PARIS)
    assert r.status_code == 502


@respx.mock
def test_landcover_ornl_empty_and_no_cci_files_returns_ornl(tmp_path, monkeypatch):
    monkeypatch.setattr(cci_landcover, "LANDCOVER_DIR", tmp_path)
    respx.get(f"{ornl.BASE}/MCD12Q1/subset").mock(
        return_value=httpx.Response(200, json={"subset": []})
    )
    with TestClient(app) as c:
        body = c.get("/api/datasets/modis/landcover", params=PARIS).json()
    assert body["source"] == "MCD12Q1" and body["first"] is None
