"""Step 10: extra monthly normals for the trip planner's "I'm into" and "Avoid" chips.

Per park and calendar month, averaged over 2005-2024 (20 years):

  NASA POWER daily point data (community RE, one point per park):
    tmin        mean night low, C                       (T2M_MIN)
    freeze_days nights below 0 C, per month             (T2M_MIN)
    wind        mean wind at 2 m, m/s                   (WS2M)
    uv          mean daily UV index, POWER units        (ALLSKY_SFC_UV_INDEX, "W m-2 x 40",
                a 24-hour average, so lower than the noon UV index on forecasts)
    sun         mean sunlight, kWh/m2/day               (ALLSKY_SFC_SW_DWN)
    rainy_days  days with at least 1 mm of rain         (PRECTOTCORR)
    heat_days   days with a high of 32 C or more, or a mean wet-bulb of 24 C or more
                                                        (T2M_MAX, T2MWET)
    smoky_days  days with aerosol optical depth above 0.3 (AOD_55; smoke, dust or haze)

  NASA FIRMS MODIS active fires (country files, 2015-2024, confidence >= 50):
    fires       fire detections within 25 km of the park point, per month (mean of years).
                None for parks outside the United States country file.

Writes backend/data/parks/trip_extras.json  {park_id: {"months": [12 x {...}], "fire_source": ...}}
Raw FIRMS files are cached in backend/data/raw/firms/ (gitignored).

Run from backend/:  .venv/bin/python scripts/step10_trip_extras.py
"""

from __future__ import annotations

import csv
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
PARKS = BACKEND / "data/parks/parks.json"
OUT = BACKEND / "data/parks/trip_extras.json"
RAW = BACKEND / "data/raw/firms"
POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
FIRMS = "https://firms.modaps.eosdis.nasa.gov/data/country/modis/{y}/modis_{y}_United_States.csv"
PARAMS = ["T2M_MIN", "T2M_MAX", "T2MWET", "WS2M", "ALLSKY_SFC_UV_INDEX", "ALLSKY_SFC_SW_DWN", "PRECTOTCORR", "AOD_55"]
START, END = 2005, 2024
FIRE_YEARS = range(2015, 2025)
FIRE_KM = 25.0
UA = {"User-Agent": "ParkTrendDetective/1.0 (NASA Space Apps 2026)"}


def get(url: str, timeout: int = 180) -> bytes:
    for wait in (0, 5, 15, 45):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError):
            continue
    raise RuntimeError(f"failed: {url}")


def power_daily(lat: float, lon: float) -> dict[str, dict[str, float | None]]:
    q = {"parameters": ",".join(PARAMS), "community": "RE", "latitude": lat, "longitude": lon,
         "start": f"{START}0101", "end": f"{END}1231", "format": "JSON"}
    js = json.loads(get(POWER + "?" + urllib.parse.urlencode(q)))
    fill = js.get("header", {}).get("fill_value", -999)
    return {k: {d: (None if v == fill else v) for d, v in s.items()} for k, s in js["properties"]["parameter"].items()}


def mean(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 2) if xs else None


def monthly(p: dict[str, dict[str, float | None]]) -> list[dict]:
    """Calendar-month normals from daily values."""
    per = [defaultdict(list) for _ in range(12)]          # month -> var -> daily values
    counts = [defaultdict(lambda: defaultdict(int)) for _ in range(12)]  # month -> var -> year -> days
    years_seen = [set() for _ in range(12)]
    for day, tmin in p["T2M_MIN"].items():
        y, m = int(day[:4]), int(day[4:6]) - 1
        g = lambda k, d=day: p[k].get(d)  # noqa: E731
        tmax, wet, rain, aod = g("T2M_MAX"), g("T2MWET"), g("PRECTOTCORR"), g("AOD_55")
        years_seen[m].add(y)
        for k, name in (("T2M_MIN", "tmin"), ("WS2M", "wind"), ("ALLSKY_SFC_UV_INDEX", "uv"), ("ALLSKY_SFC_SW_DWN", "sun")):
            if g(k) is not None:
                per[m][name].append(g(k))
        c = counts[m]
        if tmin is not None and tmin < 0:
            c["freeze_days"][y] += 1
        if rain is not None and rain >= 1:
            c["rainy_days"][y] += 1
        if (tmax is not None and tmax >= 32) or (wet is not None and wet >= 24):
            c["heat_days"][y] += 1
        if aod is not None and aod > 0.3:
            c["smoky_days"][y] += 1
    out = []
    for m in range(12):
        n = len(years_seen[m]) or 1
        row = {k: mean(v) for k, v in per[m].items()}
        for k in ("freeze_days", "rainy_days", "heat_days", "smoky_days"):
            row[k] = round(sum(counts[m][k].values()) / n, 1)
        out.append(row)
    return out


def km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = math.pi / 180
    a = math.sin((lat2 - lat1) * r / 2) ** 2 + math.cos(lat1 * r) * math.cos(lat2 * r) * math.sin((lon2 - lon1) * r / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


def fires(parks: list[dict]) -> dict[str, list[float]]:
    """Mean fire detections per calendar month within FIRE_KM of each park point."""
    RAW.mkdir(parents=True, exist_ok=True)
    tally = {p["id"]: [0] * 12 for p in parks}
    for y in FIRE_YEARS:
        f = RAW / f"modis_{y}_United_States.csv"
        if not f.exists():
            print(f"FIRMS {y}: downloading")
            f.write_bytes(get(FIRMS.format(y=y), timeout=600))
        with f.open() as fh:
            for row in csv.DictReader(fh):
                if int(row["confidence"]) < 50:
                    continue
                lat, lon = float(row["latitude"]), float(row["longitude"])
                for p in parks:
                    # Cheap box test first: 25 km is well under 0.5 degree of latitude.
                    if abs(lat - p["lat"]) < 0.5 and abs(lon - p["lon"]) < 0.8 and km(lat, lon, p["lat"], p["lon"]) <= FIRE_KM:
                        tally[p["id"]][int(row["acq_date"][5:7]) - 1] += 1
    n = len(FIRE_YEARS)
    return {k: [round(v / n, 1) for v in vals] for k, vals in tally.items()}


def main() -> None:
    parks = json.loads(PARKS.read_text())
    out: dict[str, dict] = json.loads(OUT.read_text()) if OUT.exists() else {}
    for p in parks:
        if p["id"] in out:
            continue
        print("POWER:", p["short"])
        out[p["id"]] = {"months": monthly(power_daily(p["lat"], p["lon"]))}
        OUT.write_text(json.dumps(out, separators=(",", ":")))
        time.sleep(1)
    # Samoa and the Virgin Islands are not in the United States FIRMS country file.
    us = [p for p in parks if "American Samoa" not in p["states"] and "U.S. Virgin Islands" not in p["states"]]
    fire = fires(us)
    for p in parks:
        f = fire.get(p["id"])
        for m, row in enumerate(out[p["id"]]["months"]):
            row["fires"] = f[m] if f else None
        out[p["id"]]["fire_source"] = f"NASA FIRMS MODIS {FIRE_YEARS[0]}-{FIRE_YEARS[-1]}, within {FIRE_KM:.0f} km" if f else None
    out["_meta"] = {
        "power": f"NASA POWER daily point data {START}-{END}, community RE",
        "firms": f"NASA FIRMS MODIS active fires {FIRE_YEARS[0]}-{FIRE_YEARS[-1]}, confidence >= 50",
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT} for {len(parks)} parks")


if __name__ == "__main__":
    main()
