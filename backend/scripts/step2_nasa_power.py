"""Step 2: daily NASA POWER data at one point inside each park, summarised by month.

Why we need it as well as Daymet:
  * American Samoa and the US Virgin Islands are outside Daymet, so POWER is their source.
  * POWER is updated within days, so it gives "this year so far" (Daymet lags by months).
  * For every other park it is an independent cross-check of the Daymet trend.

POWER is a coarse grid (about 0.5 degree), so in mountain parks the values describe the
region around the park, not a summit. That is fine for a cross-check; Daymet (1 km) is primary.

Needs out/parks.csv from step 0.
Output: out/power_monthly.csv

Usage:  python step2_nasa_power.py [--start 1981]
"""
import argparse
import datetime as dt
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests

URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = ["T2M_MAX", "T2M_MIN", "T2M", "PRECTOTCORR", "RH2M"]
HOT90_C, HOT100_C = 32.2222, 37.7778
OUT = Path("out")


def fetch(lat, lon, start, end):
    q = {"parameters": ",".join(PARAMS), "community": "AG", "latitude": lat, "longitude": lon,
         "start": start, "end": end, "format": "JSON"}
    for attempt in range(4):
        r = requests.get(URL, params=q, timeout=180)
        if r.ok:
            break
        time.sleep(5 * (attempt + 1))
    r.raise_for_status()
    js = r.json()
    fill = js.get("header", {}).get("fill_value", -999)
    df = pd.DataFrame(js["properties"]["parameter"])
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    return df.replace(fill, np.nan)


def monthly(daily):
    g = daily.groupby([daily.index.year, daily.index.month])
    out = pd.DataFrame({
        "tmax_c": g["T2M_MAX"].mean(),
        "tmin_c": g["T2M_MIN"].mean(),
        "tmean_c": g["T2M"].mean(),
        "hot90_days": g["T2M_MAX"].apply(lambda s: (s > HOT90_C).sum()),
        "hot100_days": g["T2M_MAX"].apply(lambda s: (s > HOT100_C).sum()),
        "prcp_mm": g["PRECTOTCORR"].sum(min_count=1),
        "rh_pct": g["RH2M"].mean(),
        "n_days": g["T2M_MAX"].count(),
    })
    out.index.names = ["year", "month"]
    return out.reset_index()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=1981)
    args = ap.parse_args()
    parks = pd.read_csv(OUT / "parks.csv").dropna(subset=["lat", "lon"])
    end = (dt.date.today() - dt.timedelta(days=3)).strftime("%Y%m%d")

    frames, seen = [], {}
    for _, p in parks.iterrows():
        key = (p.lat, p.lon)          # Sequoia and Kings Canyon may share a point
        if key not in seen:
            print("POWER:", p["name"])
            seen[key] = monthly(fetch(p.lat, p.lon, f"{args.start}0101", end))
            time.sleep(1)             # be polite to the service
        m = seen[key].copy()
        m.insert(0, "park_id", p.park_id)
        frames.append(m)

    out = pd.concat(frames, ignore_index=True)
    out.to_csv(OUT / "power_monthly.csv", index=False)
    print(f"Wrote {OUT/'power_monthly.csv'}: {len(out)} park-months, data to {end}.")


if __name__ == "__main__":
    main()
