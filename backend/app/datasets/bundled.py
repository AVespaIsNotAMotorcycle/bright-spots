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
