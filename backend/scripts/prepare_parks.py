"""One-off: US national parks + monthly climate for three horizons -> data/parks/.

Park list: Wikipedia "List of national parks of the United States" (CC BY-SA 4.0),
parsed for name, state, coordinates, 2025 visitors and the nps.gov unit code. The NPS
API (the spec's source) timed out on 2026-11-14 (503, then no response in 110 s).

Per park and calendar month, for each variable:
  normal     NASA POWER monthly, mean of 1991-2020.
  this_year  NASA POWER monthly value for the current year, if already measured.
  next_year  OLS trend of that month over 1991..last complete year, extended to next
             year; range = +-1 residual std (spec Part 3: a window at least as wide
             as the year-to-year scatter). A forecast from the record, not a model.
  y2050      WorldClim 2.1 CMIP6 downscaled monthly normals for 2041-2060 (10 arc-min),
             6 models x 2 scenarios (SSP2-4.5, SSP5-8.5): per model, future minus
             the WorldClim 1970-2000 baseline, added to the POWER 1991-2020 normal
             (precipitation: ratio). Median and min-max across models, per scenario.
             Temperature and precipitation only. Replaces the Open-Meteo stand-in:
             its free tier allows ~1 park-sized request per minute (measured: one
             10-year, 5-variable, 7-model request used the full 600/min allowance).

Daily curves (data/parks/daily/{id}.json, for the hover charts): NASA POWER daily
daytime high, humidity, rain (mm/day) and cloud, 1991 to today; the 1991-2020
day-of-year mean smoothed over 15 days, and this year's daily values so far.

Variables: tmax (C, mean daily max), t2m (C), rh (%), precip (mm/month),
cloud (%), snow (cm snow depth; POWER only, so no 2050 value).

Outputs: data/parks/parks.json, data/parks/park_climate.json (committed, small)
Raw API responses are cached in data/raw/parks/ (gitignored).

Usage: uv run python scripts/prepare_parks.py [--limit N] [--only CODE,CODE]
"""

import argparse
import calendar
import html
import json
import re
import statistics
import time
import unicodedata
import zipfile
from datetime import date
from pathlib import Path

import httpx
import numpy as np
import rasterio

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "parks"
OUT = ROOT / "data" / "parks"
UA = {"User-Agent": "park-visit-planner-dev/0.1"}

WIKI = (
    "https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2"
    "&page=List_of_national_parks_of_the_United_States&prop=wikitext"
)
POWER = "https://power.larc.nasa.gov/api/temporal/monthly/point"
POWER_DAILY = "https://power.larc.nasa.gov/api/temporal/daily/point"
DAILY_PARAMS = {
    "T2M_MAX": "tmax",
    "RH2M": "rh",
    "PRECTOTCORR": "precip",
    "CLOUD_AMT": "cloud",
}
DAILY_SMOOTH_DAYS = 15  # centred circular moving average of the day-of-year normal
POWER_PARAMS = {"T2M_MAX": "tmax", "T2M": "t2m", "RH2M": "rh", "PRECTOTCORR": "precip",
                "CLOUD_AMT": "cloud", "SNODP": "snow"}  # fmt: skip
WC_FUTURE = "https://geodata.ucdavis.edu/cmip6/10m/{m}/{ssp}/wc2.1_10m_{v}_{m}_{ssp}_2041-2060.tif"
WC_BASE = "https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_{v}.zip"
WC_MODELS = ["ACCESS-CM2", "EC-Earth3-Veg", "MIROC6", "MPI-ESM1-2-HR", "MRI-ESM2-0",
             "UKESM1-0-LL"]  # fmt: skip
WC_SSPS = ["ssp245", "ssp585"]
WC_VARS = ["tmax", "tmin", "prec"]
NORMAL = (1991, 2020)
BOUNDED = {"rh": (0, 100), "cloud": (0, 100), "precip": (0, None), "snow": (0, None)}


# ---------- park list ----------

ROW_RE = re.compile(
    r"\n\|-\s*\n!\s*scope=\"row\"[^|\n]*\|\s*(.+?)(?=\n\|-|\n\|\})", re.DOTALL
)


def clean(text: str) -> str:
    """Wikitext link text -> plain text (entities such as &nbsp; decoded)."""
    return " ".join(html.unescape(text).split())


def slug(text: str) -> str:
    """ASCII id: "Haleakalā" -> "haleakala", "Wrangell–St. Elias" -> "wrangell-st-elias"."""
    words = re.sub(r"[^\w]+", " ", text)  # punctuation, incl. en dashes -> space
    ascii_ = unicodedata.normalize("NFKD", words).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_.lower()).strip("-")


def parse_parks(wikitext: str) -> list[dict]:
    parks = []
    for m in ROW_RE.finditer(wikitext):
        row = m.group(1)
        link = re.match(r"\[\[([^|\]]+)(?:\|([^\]]+))?\]\]", row.strip())
        coord = re.search(r"\{\{coord\|(-?[\d.]+)\|(-?[\d.]+)", row)
        code = re.search(r"nps\.gov/([a-z]{4})/", row)
        if not (link and coord):
            continue
        lines = row.split("\n|")
        location = lines[2] if len(lines) > 2 else ""
        # Displayed link text: [[Washington (state)|Washington]] -> Washington.
        states = [
            clean(disp or target)
            for target, disp in re.findall(
                r"\[\[([^|\]]+)(?:\|([^\]]+))?\]\]", location.split("<br")[0]
            )
        ]
        visitors = lines[5].strip().replace(",", "") if len(lines) > 5 else ""
        short = clean(link.group(2) or link.group(1))
        parks.append(
            {
                # Unique id: NPS codes are shared by Sequoia and Kings Canyon (seki).
                "id": slug(short),
                "code": code.group(1) if code else None,
                "name": clean(link.group(1)),
                "short": short,
                "states": states,
                "lat": float(coord.group(1)),
                "lon": float(coord.group(2)),
                "visitors_2025": int(visitors) if visitors.isdigit() else None,
            }
        )
    return parks


# ---------- fetching (cached) ----------


def cached_json(path: Path, fetch) -> dict:
    if path.exists():
        return json.loads(path.read_text())
    body = fetch()
    path.write_text(json.dumps(body))
    return body


def get(client: httpx.Client, url: str, params: dict, tries: int = 4) -> dict:
    for attempt in range(1, tries + 1):
        try:
            r = client.get(url, params=params)
            if r.status_code == 400:  # Open-Meteo puts the reason in the body
                raise RuntimeError(f"{url}: {r.text[:300]}")
            if r.status_code == 429 or r.status_code >= 500:
                raise httpx.HTTPStatusError("retryable", request=r.request, response=r)
            r.raise_for_status()
            return r.json()
        except (httpx.TransportError, httpx.HTTPStatusError):
            if attempt == tries:
                raise
            time.sleep(5 * attempt)
    raise AssertionError


def power_monthly(client: httpx.Client, park: dict, end_year: int) -> dict:
    params = {"parameters": ",".join(POWER_PARAMS), "community": "RE",
              "latitude": park["lat"], "longitude": park["lon"],
              "start": NORMAL[0], "end": end_year, "format": "JSON"}  # fmt: skip
    return cached_json(
        RAW / f"{park['id']}_power_{end_year}.json",
        lambda: get(client, POWER, params),
    )


def worldclim_files() -> tuple[dict[str, list[Path]], dict[tuple[str, str, str], Path]]:
    """Download (once) the WorldClim baseline and future GeoTIFFs; return their paths."""
    d = RAW / "worldclim"
    d.mkdir(parents=True, exist_ok=True)
    base: dict[str, list[Path]] = {}
    fut: dict[tuple[str, str, str], Path] = {}
    with httpx.Client(timeout=300, headers=UA, follow_redirects=True) as c:
        for v in WC_VARS:
            months = [d / f"wc2.1_10m_{v}_{m:02d}.tif" for m in range(1, 13)]
            if not all(f.exists() for f in months):
                z = d / f"base_{v}.zip"
                z.write_bytes(c.get(WC_BASE.format(v=v)).raise_for_status().content)
                with zipfile.ZipFile(z) as zf:
                    zf.extractall(d)
                z.unlink()
            base[v] = months
            for m in WC_MODELS:
                for ssp in WC_SSPS:
                    f = d / f"wc2.1_10m_{v}_{m}_{ssp}_2041-2060.tif"
                    if not f.exists():
                        url = WC_FUTURE.format(m=m, ssp=ssp, v=v)
                        f.write_bytes(c.get(url).raise_for_status().content)
                    fut[(v, m, ssp)] = f
    return base, fut


def common_mask(files) -> np.ndarray:
    """Cells with data in every WorldClim file (they share one 10 arc-min grid)."""
    base_f, fut_f = files
    paths = [f for fs in base_f.values() for f in fs] + list(fut_f.values())
    mask = None
    for f in paths:
        with rasterio.open(f) as src:
            ok = np.isfinite(src.read(1))
        mask = ok if mask is None else mask & ok
    assert mask is not None
    return mask


def nearest_cell(
    mask: np.ndarray, path: Path, lat: float, lon: float
) -> tuple[int, int] | None:
    """The park's cell, or the nearest cell valid in all files within 1 degree
    (coastal and island parks fall on cells masked as ocean)."""
    with rasterio.open(path) as src:
        r, c = src.index(lon, lat)
    for rad in range(7):
        r0, c0 = max(r - rad, 0), max(c - rad, 0)
        sub = mask[r0 : r + rad + 1, c0 : c + rad + 1]
        cand = np.argwhere(sub)
        if len(cand):
            d = ((cand[:, 0] + r0 - r) ** 2 + (cand[:, 1] + c0 - c) ** 2).argmin()
            return int(cand[d, 0] + r0), int(cand[d, 1] + c0)
    return None


def read_cell(path: Path, cell: tuple[int, int]) -> list[float]:
    r, c = cell
    with rasterio.open(path) as src:
        return [float(v) for v in src.read(window=((r, r + 1), (c, c + 1)))[:, 0, 0]]


def worldclim_point(park: dict, files, mask: np.ndarray) -> dict:
    """var -> {"base": [12], ssp: {model: [12]}} with var in tmax, t2m, precip;
    plus "cell_offset_deg" when a neighbouring cell was used."""
    base_f, fut_f = files
    cell = nearest_cell(mask, base_f["tmax"][0], park["lat"], park["lon"])
    raw: dict[str, dict] = {}
    for v in WC_VARS:
        raw[v] = {"base": None}
        if cell is None:
            continue
        raw[v]["base"] = [read_cell(f, cell)[0] for f in base_f[v]]
        for ssp in WC_SSPS:
            raw[v][ssp] = {m: read_cell(fut_f[(v, m, ssp)], cell) for m in WC_MODELS}
    out = {"tmax": raw["tmax"], "precip": raw["prec"], "t2m": {"base": None}}
    if raw["tmax"]["base"] and raw["tmin"]["base"]:
        out["t2m"]["base"] = [
            (a + b) / 2
            for a, b in zip(raw["tmax"]["base"], raw["tmin"]["base"], strict=True)
        ]
        for ssp in WC_SSPS:
            out["t2m"][ssp] = {
                m: [
                    (a + b) / 2
                    for a, b in zip(
                        raw["tmax"][ssp][m], raw["tmin"][ssp][m], strict=True
                    )
                ]
                for m in WC_MODELS
                if m in raw["tmax"][ssp] and m in raw["tmin"][ssp]
            }
    return out


# ---------- horizons ----------


def clip(var: str, v: float) -> float:
    lo, hi = BOUNDED.get(var, (None, None))
    if lo is not None:
        v = max(lo, v)
    if hi is not None:
        v = min(hi, v)
    return v


def power_series(body: dict, this_year: int) -> dict[str, dict[int, dict[int, float]]]:
    """var -> month -> year -> value (monthly totals for precip)."""
    out: dict[str, dict[int, dict[int, float]]] = {v: {} for v in POWER_PARAMS.values()}
    for p, var in POWER_PARAMS.items():
        for key, val in body["properties"]["parameter"][p].items():
            y, mo = int(key[:4]), int(key[4:])
            if mo == 13 or val == -999 or y > this_year:
                continue
            if var == "precip":  # mm/day -> mm/month
                val = val * calendar.monthrange(y, mo)[1]
            out[var].setdefault(mo, {})[y] = val
    return out


def mean_years(series: dict[int, float], years: tuple[int, int]) -> float | None:
    xs = [v for y, v in series.items() if years[0] <= y <= years[1]]
    return statistics.fmean(xs) if len(xs) >= 0.8 * (years[1] - years[0] + 1) else None


def horizons(park: dict, today: date, wc_files, wc_mask: np.ndarray) -> dict:
    this_year, next_year = today.year, today.year + 1
    last_complete = this_year - 1
    with httpx.Client(timeout=120, headers=UA) as client:
        pw = power_series(power_monthly(client, park, this_year), this_year)
    wc = worldclim_point(park, wc_files, wc_mask)
    months = []
    for mo in range(1, 13):
        entry: dict[str, dict] = {}
        for var in POWER_PARAMS.values():
            s = pw[var].get(mo, {})
            normal = mean_years(s, NORMAL)
            rec = {y: v for y, v in s.items() if y <= last_complete}
            xs = np.array(sorted(rec), dtype=float)
            ys = np.array([rec[int(y)] for y in xs])
            nxt = None
            if len(xs) >= 20:
                slope, icpt = np.polyfit(xs, ys, 1)
                resid = ys - (icpt + slope * xs)
                sd = float(np.sqrt((resid**2).sum() / (len(xs) - 2)))
                mid = float(icpt + slope * next_year)
                nxt = {
                    "value": clip(var, mid),
                    "low": clip(var, mid - sd),
                    "high": clip(var, mid + sd),
                    "trend_per_decade": float(slope * 10),
                }
            y2050 = None
            w = wc.get(var)
            if normal is not None and w and w["base"]:
                y2050 = {}
                b = w["base"][mo - 1]
                for ssp in WC_SSPS:
                    vals = []
                    for series in w.get(ssp, {}).values():
                        f = series[mo - 1]
                        if var == "precip":
                            vals.append(clip(var, normal * f / b) if b > 0 else normal)
                        else:
                            vals.append(clip(var, normal + (f - b)))
                    if vals:
                        y2050[ssp] = {
                            "value": float(statistics.median(vals)),
                            "low": float(min(vals)),
                            "high": float(max(vals)),
                            "models": len(vals),
                        }
            entry[var] = {
                "normal": normal,
                "this_year": s.get(this_year),
                "next_year": nxt,
                "y2050": y2050,
            }
        months.append(entry)
    return {
        "id": park["id"],
        "this_year": this_year,
        "next_year": next_year,
        "months": months,
    }


def power_daily(client: httpx.Client, park: dict, today: date) -> dict:
    params = {"parameters": ",".join(DAILY_PARAMS), "community": "RE",
              "latitude": park["lat"], "longitude": park["lon"],
              "start": f"{NORMAL[0]}0101", "end": today.strftime("%Y%m%d"),
              "format": "JSON"}  # fmt: skip
    return cached_json(
        RAW / f"{park['id']}_power_daily_{today.isoformat()}.json",
        lambda: get(client, POWER_DAILY, params),
    )


def daily_curves(body: dict, this_year: int) -> dict:
    """365-day curves (Feb 29 dropped): the 1991-2020 day-of-year mean, smoothed
    with a centred circular moving average, and this year's daily values so far."""
    params = body["properties"]["parameter"]
    normal: dict[str, list[float | None]] = {}
    current: dict[str, list[float | None]] = {}
    for p, var in DAILY_PARAMS.items():
        sums = np.zeros(365)
        counts = np.zeros(365)
        cur: list[float | None] = [None] * 365
        for key, val in params[p].items():
            d = date(int(key[:4]), int(key[4:6]), int(key[6:]))
            if (d.month, d.day) == (2, 29) or val == -999:
                continue
            doy = date(2001, d.month, d.day).timetuple().tm_yday - 1  # non-leap index
            if NORMAL[0] <= d.year <= NORMAL[1]:
                sums[doy] += val
                counts[doy] += 1
            elif d.year == this_year:
                cur[doy] = float(val)
        mean = np.where(counts > 0, sums / np.maximum(counts, 1), np.nan)
        k = DAILY_SMOOTH_DAYS // 2
        padded = np.concatenate([mean[-k:], mean, mean[:k]])
        win = np.lib.stride_tricks.sliding_window_view(padded, DAILY_SMOOTH_DAYS)
        smooth = np.nanmean(win, axis=1)
        normal[var] = [None if not np.isfinite(v) else float(v) for v in smooth]
        current[var] = cur
    return {"normal": normal, "this_year": current}


def round_floats(o, nd: int = 2):
    if isinstance(o, float):
        return round(o, nd)
    if isinstance(o, dict):
        return {k: round_floats(v, nd) for k, v in o.items()}
    if isinstance(o, list):
        return [round_floats(v, nd) for v in o]
    return o


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--only", help="comma-separated park codes")
    args = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=60, headers=UA) as c:
        wiki = cached_json(RAW / "wikipedia_list.json", lambda: c.get(WIKI).json())
    parks = parse_parks(wiki["parse"]["wikitext"])
    missing_code = [p["name"] for p in parks if not p["code"]]
    print(f"parsed {len(parks)} parks; without nps.gov code: {missing_code}")
    parks = [p for p in parks if p["code"]]
    (OUT / "parks.json").write_text(
        json.dumps(parks, indent=1, ensure_ascii=False) + "\n"
    )

    todo = parks
    if args.only:
        want = set(args.only.split(","))
        todo = [p for p in parks if p["id"] in want]
    if args.limit:
        todo = todo[: args.limit]
    today = date.today()
    t = time.monotonic()
    wc_files = worldclim_files()
    wc_mask = common_mask(wc_files)
    print(f"WorldClim files ready in {time.monotonic() - t:.0f}s", flush=True)
    out_path = OUT / "park_climate.json"
    climate = json.loads(out_path.read_text()) if out_path.exists() else {}
    assert len({p["id"] for p in parks}) == len(parks), "park ids must be unique"
    for i, park in enumerate(todo, 1):
        t = time.monotonic()
        climate[park["id"]] = round_floats(horizons(park, today, wc_files, wc_mask))
        with httpx.Client(timeout=120, headers=UA) as client:
            curves = daily_curves(power_daily(client, park, today), today.year)
        daily_dir = OUT / "daily"
        daily_dir.mkdir(exist_ok=True)
        (daily_dir / f"{park['id']}.json").write_text(
            json.dumps(
                {
                    "year": today.year,
                    "through": today.isoformat(),
                    **round_floats(curves, 1),
                },
                separators=(",", ":"),
            )
            + "\n"
        )
        out_path.write_text(json.dumps(climate, separators=(",", ":")) + "\n")
        print(
            f"[{i}/{len(todo)}] {park['id']}: {time.monotonic() - t:.1f}s",
            flush=True,
        )
    print(
        f"wrote {out_path} ({out_path.stat().st_size / 1e3:.0f} kB, {len(climate)} parks)"
    )


if __name__ == "__main__":
    main()
