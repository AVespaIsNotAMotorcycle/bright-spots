"""One-off: Beck et al. 2023 Köppen-Geiger 0.5° GeoTIFFs -> uint8 arrays (spec 5.4).

Inputs (from koppen_geiger_tif.zip on figshare, extracted into data/raw/koppen/):
  1991_2020/koppen_geiger_0p5.tif
  2041_2070/ssp245/koppen_geiger_0p5.tif
  legend.txt

Outputs: data/koppen_0p5.npz (now, future: uint8 360x720, row 0 = north, 0 = no data)
         data/koppen_legend.json ({"4": {"code": "BWh", "name": "...", "rgb": [...]}})

Usage: uv run --group prep python scripts/prepare_koppen.py
"""

import json
import re
from pathlib import Path

import numpy as np
import rasterio

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "koppen"
OUT = ROOT / "data"

LEGEND_RE = re.compile(r"^\s*(\d+):\s+(\S+)\s+(.+?)\s+\[(\d+) (\d+) (\d+)\]\s*$")


def read(path: Path) -> np.ndarray:
    with rasterio.open(path) as src:
        assert src.shape == (360, 720), src.shape
        t = src.transform
        assert (round(t.c), round(t.f), t.a, t.e) == (-180, 90, 0.5, -0.5), t
        arr = src.read(1)
    return arr.astype(np.uint8)


def parse_legend(text: str) -> dict[str, dict]:
    out = {}
    for line in text.splitlines():
        if m := LEGEND_RE.match(line):
            code, short, name, r, g, b = m.groups()
            out[code] = {"code": short, "name": name, "rgb": [int(r), int(g), int(b)]}
    return out


def main() -> None:
    now = read(RAW / "1991_2020" / "koppen_geiger_0p5.tif")
    future = read(RAW / "2041_2070" / "ssp245" / "koppen_geiger_0p5.tif")
    legend = parse_legend((RAW / "legend.txt").read_text())
    assert len(legend) == 30, len(legend)
    np.savez_compressed(OUT / "koppen_0p5.npz", now=now, future=future)
    (OUT / "koppen_legend.json").write_text(
        json.dumps(legend, indent=1, ensure_ascii=False)
    )
    print(
        f"wrote koppen_0p5.npz (land cells now={int((now > 0).sum())}) and koppen_legend.json"
    )


if __name__ == "__main__":
    main()
