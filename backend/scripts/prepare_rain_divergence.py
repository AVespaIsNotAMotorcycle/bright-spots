"""One-off: GPCC Full v2025 monthly precipitation -> post-2000 divergence from the
pre-2000 linear trend, per 1° land cell.

Method (per cell):
  1. Annual totals (mm/yr); a year counts only if all 12 months are present.
  2. OLS fit of annual totals over the baseline years (1951-1999).
  3. Extrapolate that line over 2000..last complete year.
  4. divergence_mm  = mean(actual - predicted) over post-2000 years
     divergence_pct = divergence_mm / mean(baseline actual) * 100
  5. z = divergence_mm / se, where se is the standard error of the mean of m
     future observations predicted from the baseline fit:
       se = s * sqrt(1/m + 1/n + (xbar_post - xbar_pre)^2 / Sxx)
     with s the baseline residual std (ddof=2). Assumes independent years.

Post-2000 period: 2000 through the end of the first unbroken run of complete
years (a gap stops the period rather than being bridged).

Data checks (NOAA PSL repackaging of GPCC Full v2025, checked 2026-11-14):
  - 1x1 file: time steps 2020-01..2024-12 are fill placeholders (9.97e36), and
    the 2019-12 slice is a byte-identical copy of 1891-01. Both are dropped here
    automatically (fill times, and any slice identical to an earlier one), so
    the 1 deg post-2000 period ends in 2018.
  - 2.5x2.5 file: complete 1891-01..2026-08, no fill steps or duplicate slices.

Input:  data/raw/gpcc/precip.mon.total.1x1.v2025.nc             (--res 1)
        data/raw/gpcc25/precip.mon.total.2.5x2.5.v2025.nc       (--res 2.5)
        from https://downloads.psl.noaa.gov/Datasets/gpcc/full_v2025/
Output: data/rain_divergence_{1deg,2p5deg}.npz  (map layers, small, committed)
        data/gpcc_annual_{1deg,2p5deg}.npz      (annual totals for point charts, gitignored)

Usage: uv run python scripts/prepare_rain_divergence.py --res 1
       uv run python scripts/prepare_rain_divergence.py --res 2.5
"""

import argparse
import hashlib
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import xarray as xr

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "1": ("gpcc/precip.mon.total.1x1.v2025.nc", "1deg"),
    "2.5": ("gpcc25/precip.mon.total.2.5x2.5.v2025.nc", "2p5deg"),
}
FILL_THRESHOLD = 1e30

BASE_START, BASE_END = 1951, 1999
POST_START = 2000
MIN_BASE_YEARS = 40  # of 49
MIN_POST_FRACTION = 0.8


def load_monthly(
    path: Path,
) -> tuple[list[tuple[int, int]], np.ndarray, np.ndarray, np.ndarray]:
    """Monthly grids with fill time steps and duplicated slices removed."""
    ds = xr.open_dataset(path, decode_times=False)
    t = ds["time"].values
    data = ds["precip"].values.astype(np.float32)
    data[np.abs(data) > FILL_THRESHOLD] = np.nan
    epoch = datetime(1800, 1, 1)
    keep, ym, seen = [], [], {}
    for i, v in enumerate(t):
        if v > FILL_THRESHOLD:
            continue
        d = epoch + timedelta(days=float(v))
        digest = hashlib.md5(np.nan_to_num(data[i], nan=-1).tobytes()).hexdigest()
        if digest in seen:
            print(f"  dropping {d:%Y-%m}: identical to {seen[digest]}")
            continue
        seen[digest] = f"{d:%Y-%m}"
        keep.append(i)
        ym.append((d.year, d.month))
    dropped_fill = int((t > FILL_THRESHOLD).sum())
    if dropped_fill:
        print(f"  dropping {dropped_fill} fill time steps")
    return (
        ym,
        data[keep],
        ds["lat"].values.astype(np.float32),
        ds["lon"].values.astype(np.float32),
    )


def annual_totals(
    ym: list[tuple[int, int]], data: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Annual totals for years with all 12 months present (per cell: all 12 finite)."""
    by_year: dict[int, dict[int, int]] = {}
    for i, (y, m) in enumerate(ym):
        by_year.setdefault(y, {})[m] = i
    years = np.array(sorted(y for y, ms in by_year.items() if len(ms) == 12))
    out = np.full((len(years), data.shape[1], data.shape[2]), np.nan, dtype=np.float32)
    for k, y in enumerate(years):
        block = data[[by_year[y][m] for m in range(1, 13)]]
        out[k] = np.where(np.isfinite(block).all(axis=0), block.sum(axis=0), np.nan)
    return years, out


def masked_ols(x: np.ndarray, Y: np.ndarray) -> dict[str, np.ndarray]:
    """Per-cell OLS of Y (t, ...) on x (t,), ignoring NaNs."""
    valid = np.isfinite(Y)
    n = valid.sum(axis=0).astype(np.float64)
    X = np.where(valid, x[:, None, None], 0.0)
    Yz = np.where(valid, Y, 0.0)
    with np.errstate(invalid="ignore", divide="ignore"):
        xbar = X.sum(axis=0) / n
        ybar = Yz.sum(axis=0) / n
        dx = np.where(valid, x[:, None, None] - xbar, 0.0)
        dy = np.where(valid, Y - ybar, 0.0)
        sxx = (dx * dx).sum(axis=0)
        slope = (dx * dy).sum(axis=0) / sxx
        intercept = ybar - slope * xbar
        resid = np.where(valid, Y - (intercept + slope * x[:, None, None]), 0.0)
        s = np.sqrt((resid * resid).sum(axis=0) / (n - 2))
    return {
        "n": n,
        "xbar": xbar,
        "ybar": ybar,
        "sxx": sxx,
        "slope": slope,
        "intercept": intercept,
        "s": s,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--res", choices=SOURCES, default="1")
    args = ap.parse_args()
    rel, tag = SOURCES[args.res]
    raw = ROOT / "data" / "raw" / rel
    out_map = ROOT / "data" / f"rain_divergence_{tag}.npz"
    out_annual = ROOT / "data" / f"gpcc_annual_{tag}.npz"

    print(f"reading {raw.name}")
    ym, monthly, lat, lon = load_monthly(raw)
    years, annual = annual_totals(ym, monthly)

    # Normalise grid: lat north->south, lon -180..180.
    if lat[0] < lat[-1]:
        lat, annual = lat[::-1], annual[:, ::-1, :]
    if lon.max() > 180:
        shift = int(np.argmax(lon >= 180))
        lon = np.concatenate([lon[shift:] - 360, lon[:shift]])
        annual = np.concatenate([annual[:, :, shift:], annual[:, :, :shift]], axis=2)

    # Post period: 2000 through the end of the first unbroken run of complete years.
    post_end = POST_START - 1
    while post_end + 1 in set(years.tolist()):
        post_end += 1
    if post_end < POST_START:
        raise SystemExit("no complete years from 2000")
    base_idx = (years >= BASE_START) & (years <= BASE_END)
    post_idx = (years >= POST_START) & (years <= post_end)
    xb, Yb = years[base_idx].astype(np.float64), annual[base_idx].astype(np.float64)
    xp, Yp = years[post_idx].astype(np.float64), annual[post_idx].astype(np.float64)

    fit = masked_ols(xb, Yb)
    pred = fit["intercept"] + fit["slope"] * xp[:, None, None]
    pvalid = np.isfinite(Yp)
    m = pvalid.sum(axis=0).astype(np.float64)
    with np.errstate(invalid="ignore", divide="ignore"):
        resid_mean = np.where(pvalid, Yp - pred, 0.0).sum(axis=0) / m
        xbar_post = np.where(pvalid, xp[:, None, None], 0.0).sum(axis=0) / m
        se = fit["s"] * np.sqrt(
            1 / m + 1 / fit["n"] + (xbar_post - fit["xbar"]) ** 2 / fit["sxx"]
        )
        z = resid_mean / se
        pct = resid_mean / fit["ybar"] * 100

    ok = (
        (fit["n"] >= MIN_BASE_YEARS)
        & (m >= MIN_POST_FRACTION * len(xp))
        & (fit["ybar"] > 0)
    )
    nan = np.float32(np.nan)

    def layer(a: np.ndarray) -> np.ndarray:
        return np.where(ok, a, nan).astype(np.float32)

    np.savez_compressed(
        out_map,
        pct=layer(pct),
        mm=layer(resid_mean),
        z=layer(z),
        base_mean=layer(fit["ybar"]),
        slope_pre=layer(fit["slope"]),
        lat=lat,
        lon=lon,
        meta=np.array([BASE_START, BASE_END, POST_START, post_end]),
        res=np.float32(abs(float(lat[1] - lat[0]))),
    )
    np.savez_compressed(
        out_annual, annual=annual.astype(np.float32), years=years, lat=lat, lon=lon
    )

    v = pct[ok]
    print(
        f"complete years: {years.min()}..{years.max()} ({len(years)}); post period {POST_START}-{post_end}"
    )
    print(f"cells with a result: {int(ok.sum())}")
    print(
        "pct percentiles 1/5/25/50/75/95/99:",
        np.round(np.percentile(v, [1, 5, 25, 50, 75, 95, 99]), 1),
    )
    print(f"|z|>=2: {(np.abs(z[ok]) >= 2).mean() * 100:.1f}% of cells")
    print(
        f"wrote {out_map.name} ({out_map.stat().st_size / 1e6:.2f} MB), {out_annual.name} ({out_annual.stat().st_size / 1e6:.1f} MB)"
    )


if __name__ == "__main__":
    main()
