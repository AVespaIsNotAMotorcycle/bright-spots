"""Bundled grid files (spec 5.3 GRACE, 5.4 Köppen-Geiger). Built by scripts/prepare_*.py."""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np
from pydantic import BaseModel

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
GRACE_FILE = DATA_DIR / "grace_1deg.npz"
KOPPEN_FILE = DATA_DIR / "koppen_0p5.npz"
KOPPEN_LEGEND = DATA_DIR / "koppen_legend.json"


class MissingDataFile(RuntimeError):
    pass


# ---------- GRACE ----------


class GraceMonth(BaseModel):
    date: str
    lwe_cm: float | None


class GraceResult(BaseModel):
    lat: float
    lon: float
    cell_lat: float
    cell_lon: float
    land: bool
    months: list[GraceMonth]


@lru_cache(maxsize=1)
def _grace() -> dict[str, np.ndarray]:
    if not GRACE_FILE.exists():
        raise MissingDataFile(
            "data/grace_1deg.npz missing; run scripts/prepare_grace.py"
        )
    with np.load(GRACE_FILE) as f:
        return {k: f[k] for k in ("lwe", "time", "lat", "lon")}


def grace_cell(lat: float, lon: float) -> tuple[int, int]:
    i = min(max(math.floor(lat + 90), 0), 179)
    j = min(max(math.floor(lon + 180), 0), 359)
    return i, j


def grace_series(lat: float, lon: float) -> GraceResult:
    g = _grace()
    i, j = grace_cell(lat, lon)
    col = g["lwe"][:, i, j]
    land = bool(np.isfinite(col).any())
    months = [
        GraceMonth(
            date=str(t), lwe_cm=None if not np.isfinite(v) else round(float(v), 2)
        )
        for t, v in zip(g["time"], col, strict=True)
    ]
    return GraceResult(
        lat=lat,
        lon=lon,
        cell_lat=float(g["lat"][i]),
        cell_lon=float(g["lon"][j]),
        land=land,
        months=months if land else [],
    )


# ---------- Köppen-Geiger ----------


class KoppenClass(BaseModel):
    id: int
    code: str
    name: str
    rgb: list[int]


class KoppenResult(BaseModel):
    lat: float
    lon: float
    now: KoppenClass | None  # 1991-2020
    future: KoppenClass | None  # 2041-2070, SSP2-4.5
    changed: bool | None


@lru_cache(maxsize=1)
def _koppen() -> tuple[np.ndarray, np.ndarray, dict[str, dict]]:
    if not KOPPEN_FILE.exists() or not KOPPEN_LEGEND.exists():
        raise MissingDataFile(
            "data/koppen_0p5.npz missing; run scripts/prepare_koppen.py"
        )
    with np.load(KOPPEN_FILE) as f:
        now, future = f["now"], f["future"]
    return now, future, json.loads(KOPPEN_LEGEND.read_text())


def koppen_cell(lat: float, lon: float) -> tuple[int, int]:
    row = min(max(math.floor((90 - lat) / 0.5), 0), 359)
    col = min(max(math.floor((lon + 180) / 0.5), 0), 719)
    return row, col


def koppen_lookup(lat: float, lon: float) -> KoppenResult:
    now, future, legend = _koppen()
    r, c = koppen_cell(lat, lon)

    def cls(code: int) -> KoppenClass | None:
        if code == 0 or str(code) not in legend:
            return None
        e = legend[str(code)]
        return KoppenClass(id=code, code=e["code"], name=e["name"], rgb=e["rgb"])

    a, b = cls(int(now[r, c])), cls(int(future[r, c]))
    return KoppenResult(
        lat=lat,
        lon=lon,
        now=a,
        future=b,
        changed=None if a is None or b is None else a.id != b.id,
    )


def koppen_legend() -> dict[str, dict]:
    return _koppen()[2]


# ---------- Rainfall divergence (GPCC; built by scripts/prepare_rain_divergence.py) ----------

RAINDIV_TAGS = {"1": "1deg", "2.5": "2p5deg"}


class RainDivGrid(BaseModel):
    res: float
    lat0: float  # centre of first row (north)
    lon0: float  # centre of first column (west)
    nlat: int
    nlon: int
    base_start: int
    base_end: int
    post_start: int
    post_end: int
    pct: list[float | None]  # row-major, north->south, west->east
    mm: list[float | None]
    z: list[float | None]


class RainDivPoint(BaseModel):
    res: float
    cell_lat: float
    cell_lon: float
    land: bool
    base_start: int
    base_end: int
    post_start: int
    post_end: int
    pct: float | None
    mm: float | None
    z: float | None
    base_mean: float | None
    slope_pre: float | None
    years: list[
        dict[str, float | int | None]
    ]  # {year, actual, fit (baseline+post only)}


def _raindiv_paths(res: str) -> tuple[Path, Path]:
    tag = RAINDIV_TAGS[res]
    return DATA_DIR / f"rain_divergence_{tag}.npz", DATA_DIR / f"gpcc_annual_{tag}.npz"


@lru_cache(maxsize=2)
def _raindiv(res: str) -> dict[str, np.ndarray]:
    path, _ = _raindiv_paths(res)
    if not path.exists():
        raise MissingDataFile(
            f"data/{path.name} missing; run scripts/prepare_rain_divergence.py --res {res}"
        )
    with np.load(path) as f:
        return {k: f[k] for k in f.files}


@lru_cache(maxsize=2)
def _raindiv_annual(res: str) -> dict[str, np.ndarray]:
    _, path = _raindiv_paths(res)
    if not path.exists():
        raise MissingDataFile(
            f"data/{path.name} missing; run scripts/prepare_rain_divergence.py --res {res}"
        )
    with np.load(path) as f:
        return {k: f[k] for k in f.files}


def _round_list(a: np.ndarray, nd: int) -> list[float | None]:
    flat = a.ravel().astype(np.float64)
    return [None if not np.isfinite(v) else round(float(v), nd) for v in flat]


@lru_cache(maxsize=2)
def raindiv_grid(res: str) -> RainDivGrid:
    d = _raindiv(res)
    b0, b1, p0, p1 = (int(x) for x in d["meta"])
    return RainDivGrid(
        res=float(d["res"]),
        lat0=float(d["lat"][0]),
        lon0=float(d["lon"][0]),
        nlat=len(d["lat"]),
        nlon=len(d["lon"]),
        base_start=b0,
        base_end=b1,
        post_start=p0,
        post_end=p1,
        pct=_round_list(d["pct"], 1),
        mm=_round_list(d["mm"], 0),
        z=_round_list(d["z"], 2),
    )


def raindiv_cell(res: str, lat: float, lon: float) -> tuple[int, int]:
    d = _raindiv(res)
    r = float(d["res"])
    i = int(
        np.clip(np.floor((float(d["lat"][0]) + r / 2 - lat) / r), 0, len(d["lat"]) - 1)
    )
    j = int(
        np.clip(
            np.floor((lon - (float(d["lon"][0]) - r / 2)) / r), 0, len(d["lon"]) - 1
        )
    )
    return i, j


def raindiv_point(res: str, lat: float, lon: float) -> RainDivPoint:
    d = _raindiv(res)
    a = _raindiv_annual(res)
    i, j = raindiv_cell(res, lat, lon)
    b0, b1, p0, p1 = (int(x) for x in d["meta"])

    def val(k: str, nd: int) -> float | None:
        v = float(d[k][i, j])
        return round(v, nd) if np.isfinite(v) else None

    pct, slope = val("pct", 1), val("slope_pre", 3)
    base_mean = val("base_mean", 1)
    land = pct is not None
    years: list[dict[str, float | int | None]] = []
    if land and slope is not None and base_mean is not None:
        # Fitted line passes through (mean baseline year with data, base_mean).
        yrs = a["years"]
        col = a["annual"][:, i, j]
        in_base = (yrs >= b0) & (yrs <= b1) & np.isfinite(col)
        xbar = float(yrs[in_base].mean())
        for y, v in zip(yrs.tolist(), col.tolist(), strict=True):
            fit = round(base_mean + slope * (y - xbar), 1) if b0 <= y <= p1 else None
            years.append(
                {
                    "year": int(y),
                    "actual": round(v, 1) if np.isfinite(v) else None,
                    "fit": fit,
                }
            )
    return RainDivPoint(
        res=float(d["res"]),
        cell_lat=float(d["lat"][i]),
        cell_lon=float(d["lon"][j]),
        land=land,
        base_start=b0,
        base_end=b1,
        post_start=p0,
        post_end=p1,
        pct=pct,
        mm=val("mm", 1),
        z=val("z", 2),
        base_mean=base_mean,
        slope_pre=slope,
        years=years,
    )
