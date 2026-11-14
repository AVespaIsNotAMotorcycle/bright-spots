"""One-off: ESA CCI / C3S 300 m land cover maps -> one tiled, compressed GeoTIFF per year.

Source: the CDS retrieve API (CDSAPI_URL / CDSAPI_KEY in ../.env), whole-globe requests
  1992-2015  version v2_0_7cds (ESA CCI v2.0.7)
  2016-2025  version v2_1_1 (C3S)
Whole-globe yearly files are usually already in the CDS cache, so a request returns in
seconds and downloads at ~8 MB/s (measured 2026-11-14). The CEDA THREDDS copy of
v2.0.7 has no login but downloaded at 161 KB/s, ~4 h per year, so it is not used.

Only `lccs_class` (uint8 LCCS class code) is kept; the raw netCDF is deleted after
conversion unless --keep-raw. Conversion runs in row strips so memory stays at a few
hundred MB even though one year is 129600 x 64800 bytes (8.4 GB) uncompressed.

Outputs: data/landcover/lccs_{year}.tif  (EPSG:4326, 1/360 deg, row 0 = north)
         data/landcover/legend.json      ({"190": "urban", ...} from the file's own attrs)

Usage: uv run python scripts/prepare_landcover.py 2015 [2016 ...] [--keep-raw]
"""

import argparse
import json
import time
import zipfile
from pathlib import Path

import httpx
import netCDF4
import numpy as np
import rasterio
from rasterio.transform import from_origin

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "landcover"
OUT = ROOT / "data" / "landcover"
ENV = ROOT.parent / ".env"

NROWS, NCOLS, RES = 64800, 129600, 1 / 360
STRIP = 2048  # rows per read/write; multiple of the 512 tile size
GTIFF = {
    "driver": "GTiff",
    "dtype": "uint8",
    "count": 1,
    "height": NROWS,
    "width": NCOLS,
    "crs": "EPSG:4326",
    "transform": from_origin(-180, 90, RES, RES),
    "tiled": True,
    "blockxsize": 512,
    "blockysize": 512,
    "compress": "ZSTD",
    "zstd_level": 9,
    "nodata": 0,
    "BIGTIFF": "YES",
}
# Known pixels for a sanity check after conversion: (lat, lon) -> expected class.
CHECKS = {(48.8566, 2.3522): 190}  # central Paris, urban (confirmed via OPeNDAP)


def log(t0: float, msg: str) -> None:
    print(f"[{time.monotonic() - t0:7.1f}s] {msg}", flush=True)


def download(url: str, dest: Path, headers: dict | None = None) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    with httpx.stream(
        "GET", url, headers=headers, timeout=120, follow_redirects=True
    ) as r:
        r.raise_for_status()
        with tmp.open("wb") as f:
            for chunk in r.iter_bytes(1 << 22):
                f.write(chunk)
    tmp.rename(dest)


def fetch_cds(year: int) -> Path:
    found = sorted(RAW.glob(f"*-LC-L4-LCCS-Map-300m-P1Y-{year}-*.nc"))
    if found:
        return found[0]
    version = "v2_0_7cds" if year <= 2015 else "v2_1_1"
    env = dict(ln.split("=", 1) for ln in ENV.read_text().split() if "=" in ln)
    base = env["CDSAPI_URL"].rstrip("/") + "/retrieve/v1"
    hdr = {"PRIVATE-TOKEN": env["CDSAPI_KEY"]}
    body = {"inputs": {"variable": "all", "year": [str(year)], "version": version}}
    with httpx.Client(headers=hdr, timeout=60) as c:
        r = c.post(f"{base}/processes/satellite-land-cover/execution", json=body)
        r.raise_for_status()
        jid = r.json()["jobID"]
        while (status := c.get(f"{base}/jobs/{jid}").json()["status"]) not in (
            "successful",
            "failed",
            "rejected",
            "dismissed",
        ):
            time.sleep(10)
        if status != "successful":
            raise RuntimeError(f"CDS job {jid} {status}")
        href = c.get(f"{base}/jobs/{jid}/results").json()["asset"]["value"]["href"]
    zpath = RAW / f"cds_{year}.zip"
    download(href, zpath)
    with zipfile.ZipFile(zpath) as z:
        (name,) = [n for n in z.namelist() if n.endswith(".nc")]
        z.extract(name, RAW)
    zpath.unlink()
    return RAW / name


def legend(var: netCDF4.Variable) -> dict[str, str]:
    values = np.atleast_1d(var.getncattr("flag_values")).tolist()
    names = str(var.getncattr("flag_meanings")).split()
    assert len(values) == len(names), (len(values), len(names))
    return {str(int(v)): n for v, n in zip(values, names)}


def convert(src: Path, dest: Path, t0: float) -> dict[str, str]:
    with netCDF4.Dataset(src) as ds:
        var = ds["lccs_class"]
        var.set_auto_maskandscale(False)
        lat = ds["lat"][:]
        lon = ds["lon"][:]
        assert var.shape[-2:] == (NROWS, NCOLS), var.shape
        assert lat[0] > lat[-1] and abs(lat[0] - (90 - RES / 2)) < 1e-4, lat[[0, -1]]
        assert abs(lon[0] - (-180 + RES / 2)) < 1e-4, lon[[0, -1]]
        has_time = var.ndim == 3
        tmp = dest.with_suffix(".tif.part")
        with rasterio.open(tmp, "w", **GTIFF) as out:
            for r0 in range(0, NROWS, STRIP):
                n = min(STRIP, NROWS - r0)
                block = var[0, r0 : r0 + n, :] if has_time else var[r0 : r0 + n, :]
                out.write(
                    np.asarray(block, dtype=np.uint8),
                    1,
                    window=((r0, r0 + n), (0, NCOLS)),
                )
                if (r0 // STRIP) % 8 == 0:
                    log(t0, f"  rows {r0 + n}/{NROWS}")
        tmp.rename(dest)
        return legend(var)


def check(dest: Path) -> None:
    with rasterio.open(dest) as src:
        for (lat, lon), want in CHECKS.items():
            t = time.perf_counter()
            r, c = src.index(lon, lat)
            got = int(src.read(1, window=((r, r + 1), (c, c + 1)))[0, 0])
            ms = (time.perf_counter() - t) * 1000
            status = "ok" if got == want else "MISMATCH"
            print(
                f"  check ({lat}, {lon}): {got} (want {want}) {status}, read {ms:.1f} ms"
            )
            assert got == want


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("years", nargs="+", type=int)
    ap.add_argument("--keep-raw", action="store_true")
    args = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for year in args.years:
        t0 = time.monotonic()
        dest = OUT / f"lccs_{year}.tif"
        if dest.exists():
            print(f"{year}: {dest} exists, skipping")
            continue
        src = fetch_cds(year)
        log(t0, f"{year}: raw {src.name} {src.stat().st_size / 1e9:.3f} GB")
        leg = convert(src, dest, t0)
        log(t0, f"{year}: wrote {dest.name} {dest.stat().st_size / 1e9:.3f} GB")
        (OUT / "legend.json").write_text(json.dumps(leg, indent=1) + "\n")
        check(dest)
        if not args.keep_raw:
            src.unlink()


if __name__ == "__main__":
    main()
