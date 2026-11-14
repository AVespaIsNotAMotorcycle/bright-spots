"""Bundled ESA CCI / C3S 300 m land cover (spec 5.7): fallback for ORNL MCD12Q1.

Files come from scripts/prepare_landcover.py: data/landcover/lccs_{year}.tif plus
legend.json. The guard compares the first CCI year (1992) with the latest bundled
year. Each lookup opens the files and reads one pixel per year (~1 ms each, measured),
so no handles are shared between threads.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

import rasterio

from app.datasets.bundled import DATA_DIR, MissingDataFile
from app.datasets.ornl import LandCover, LandCoverYear

LANDCOVER_DIR = DATA_DIR / "landcover"
SOURCE = "ESA CCI / C3S"
FILE_RE = re.compile(r"^lccs_(\d{4})\.tif$")

# LCCS code -> spec 7.6 group (IPCC aggregation from the CCI land cover user guide;
# open item in spec 13 to verify).
_GROUP_CODES: list[tuple[str, list[int]]] = [
    ("Cropland", [10, 11, 12, 20, 30, 40]),
    ("Forest", [50, 60, 61, 62, 70, 71, 72, 80, 81, 82, 90, 100, 160, 170]),
    ("Grassland", [110, 130]),
    ("Wetland", [180]),
    ("Built-up", [190]),
    ("Shrub and savanna", [120, 121, 122]),
    ("Bare", [140, 150, 151, 152, 153, 200, 201, 202]),
    ("Water", [210]),
    ("Snow and ice", [220]),
]
GROUPS: dict[int, str] = {c: g for g, codes in _GROUP_CODES for c in codes}


def years_available(directory: Path | None = None) -> list[int]:
    d = directory or LANDCOVER_DIR
    if not d.is_dir():
        return []
    return sorted(int(m[1]) for p in d.iterdir() if (m := FILE_RE.match(p.name)))


@lru_cache(maxsize=4)
def _legend(path: Path) -> dict[int, str]:
    raw = json.loads(path.read_text())
    return {int(k): v.replace("_", " ").capitalize() for k, v in raw.items()}


def read_code(path: Path, lat: float, lon: float) -> int:
    """Class code of the pixel containing (lat, lon); edges clamp into the grid."""
    with rasterio.open(path) as src:
        r, c = src.index(lon, lat)
        r = min(max(r, 0), src.height - 1)
        c = min(max(c, 0), src.width - 1)
        return int(src.read(1, window=((r, r + 1), (c, c + 1)))[0, 0])


def _year(
    year: int, lat: float, lon: float, legend: dict[int, str]
) -> LandCoverYear | None:
    code = read_code(LANDCOVER_DIR / f"lccs_{year}.tif", lat, lon)
    if code == 0 or code not in legend:  # 0 = no data
        return None
    return LandCoverYear(
        year=year, code=code, name=legend[code], group=GROUPS.get(code)
    )


def lookup(lat: float, lon: float) -> LandCover:
    """First and latest bundled year at the point (blocking; run in a thread)."""
    years = years_available()
    legend_path = LANDCOVER_DIR / "legend.json"
    if len(years) < 2 or not legend_path.exists():
        raise MissingDataFile(
            "data/landcover/ needs two lccs_{year}.tif files and legend.json; "
            "run scripts/prepare_landcover.py 1992 2025"
        )
    legend = _legend(legend_path)
    first = _year(years[0], lat, lon, legend)
    latest = _year(years[-1], lat, lon, legend)
    return LandCover(
        lat=lat,
        lon=lon,
        first=first,
        latest=latest,
        changed=None if not (first and latest) else first.group != latest.group,
        source=SOURCE,
    )
