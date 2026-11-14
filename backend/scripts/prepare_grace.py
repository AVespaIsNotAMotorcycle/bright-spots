"""One-off: CSR RL06.3 GRACE/GRACE-FO mascons -> data/grace_1deg.npz (spec 5.3).

Inputs (download into data/raw/grace/, see README):
  CSR_GRACE_GRACE-FO_RL0603_Mascons_all-corrections.nc
  CSR_GRACE_GRACE-FO_RL06_Mascons_v02_LandMask.nc

Output arrays: lwe (time, 180, 360) float32 cm, NaN over ocean;
time as "YYYY-MM"; lat (-89.5..89.5); lon (-179.5..179.5).

Usage: uv run --group prep python scripts/prepare_grace.py
"""

from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import xarray as xr

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "grace"
OUT = ROOT / "data" / "grace_1deg.npz"
EPOCH = datetime(2002, 1, 1)


def main() -> None:
    ds = xr.open_dataset(
        RAW / "CSR_GRACE_GRACE-FO_RL0603_Mascons_all-corrections.nc", decode_times=False
    )
    mask = xr.open_dataset(RAW / "CSR_GRACE_GRACE-FO_RL06_Mascons_v02_LandMask.nc")[
        "LO_val"
    ].values

    lwe = ds["lwe_thickness"].values.astype(np.float32)  # (t, 720, 1440), lon 0..360
    lwe = np.where(mask[None] > 0.5, lwe, np.nan)

    # 4x4 block mean -> 1 degree. A 1-degree cell is land if any 0.25 cell is land.
    t = lwe.shape[0]
    blocks = lwe.reshape(t, 180, 4, 360, 4)
    with np.errstate(invalid="ignore"):
        coarse = np.nanmean(blocks, axis=(2, 4)).astype(np.float32)

    # Rotate lon 0..360 -> -180..180.
    coarse = np.roll(coarse, 180, axis=2)
    lat = np.arange(-89.5, 90, 1.0)
    lon = np.arange(-179.5, 180, 1.0)

    # Month label from the time-bounds midpoint. Collapse duplicate months by mean.
    mids = ds["time"].values
    labels = [(EPOCH + timedelta(days=float(d))).strftime("%Y-%m") for d in mids]
    uniq = sorted(set(labels))
    out = np.full((len(uniq), 180, 360), np.nan, dtype=np.float32)
    for i, m in enumerate(uniq):
        idx = [j for j, lab in enumerate(labels) if lab == m]
        with np.errstate(invalid="ignore"):
            out[i] = np.nanmean(coarse[idx], axis=0)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(OUT, lwe=out, time=np.array(uniq), lat=lat, lon=lon)
    dups = len(labels) - len(uniq)
    print(
        f"wrote {OUT} months={len(uniq)} ({uniq[0]}..{uniq[-1]}, {dups} duplicate months merged)"
    )


if __name__ == "__main__":
    main()
