"""Step 1: monthly temperature (and friends) for every park, from Daymet V4 in Earth Engine.

Daymet V4 (NASA ORNL DAAC) is daily, 1 km, 1980 onward, covering continental North
America, Hawaii and Puerto Rico. Earth Engine ID: NASA/ORNL/DAYMET_V4.

For each park and each month we compute the average over all 1 km pixels in the park of:
  tmax_c      mean daily high (°C)
  tmin_c      mean daily low (°C)
  tmean_c     mean of (high + low) / 2 (°C)
  hot90_days  number of days with a high above 90°F (32.2°C)
  hot100_days number of days with a high above 100°F (37.8°C)
  prcp_mm     total precipitation (mm)
  vp_pa       mean water vapour pressure (Pa), for humidity later

One export task per year is sent to your Google Drive (folder park_trend_detective).
When all tasks are done, download the CSVs into out/daymet/.

Setup (once):
  pip install earthengine-api
  earthengine authenticate
  Upload out/parks_64.zip as a table asset (Code Editor > Assets > New > Shape files).

Usage:
  python step1_earthengine_daymet.py --project YOUR_CLOUD_PROJECT \
      --asset projects/YOUR_CLOUD_PROJECT/assets/parks_64 [--first 1980] [--last 2025]
"""
import argparse

import ee

from parks import UNIT_CODES, POWER_ONLY

HOT90_C = 32.2222
HOT100_C = 37.7778
DRIVE_FOLDER = "park_trend_detective"


def monthly_image(year, month):
    start = ee.Date.fromYMD(year, month, 1)
    end = start.advance(1, "month")
    days = ee.ImageCollection("NASA/ORNL/DAYMET_V4").filterDate(start, end)
    tmax = days.select("tmax")
    tmin = days.select("tmin")
    tmean = days.map(lambda d: d.expression("(b('tmax') + b('tmin')) / 2").rename("tmean"))
    img = ee.Image.cat([
        tmax.mean().rename("tmax_c"),
        tmin.mean().rename("tmin_c"),
        tmean.mean().rename("tmean_c"),
        tmax.map(lambda d: d.gt(HOT90_C)).sum().rename("hot90_days"),
        tmax.map(lambda d: d.gt(HOT100_C)).sum().rename("hot100_days"),
        days.select("prcp").sum().rename("prcp_mm"),
        days.select("vp").mean().rename("vp_pa"),
        days.select("tmax").count().rename("n_days"),
    ])
    return img.set({"year": year, "month": month})


def year_table(parks, year):
    def per_month(m):
        m = ee.Number(m)
        img = monthly_image(year, m)
        stats = img.reduceRegions(collection=parks, reducer=ee.Reducer.mean(),
                                  scale=1000, tileScale=4)
        return stats.map(lambda f: f.set({"year": year, "month": m}).setGeometry(None))
    return ee.FeatureCollection(ee.List.sequence(1, 12).map(per_month)).flatten()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, help="Google Cloud project registered for Earth Engine")
    ap.add_argument("--asset", required=True, help="Earth Engine table asset with the park boundaries")
    ap.add_argument("--first", type=int, default=1980)
    ap.add_argument("--last", type=int, default=None, help="last full year (default: newest in Daymet)")
    args = ap.parse_args()

    ee.Initialize(project=args.project)

    daymet = ee.ImageCollection("NASA/ORNL/DAYMET_V4")
    newest = ee.Date(daymet.aggregate_max("system:time_start")).format("YYYY-MM-dd").getInfo()
    print("Newest Daymet day available:", newest)
    last = args.last or int(newest[:4]) - (0 if newest[5:] >= "12-30" else 1)

    codes = [c for c in UNIT_CODES if c not in POWER_ONLY]
    parks = ee.FeatureCollection(args.asset).filter(ee.Filter.inList("UNIT_CODE", codes))
    found = parks.aggregate_array("UNIT_CODE").getInfo()
    print(f"{len(found)} park boundaries found in the asset (expected {len(codes)}).")
    if missing := sorted(set(codes) - set(found)):
        print("  Missing:", missing)

    cols = ["UNIT_CODE", "year", "month", "tmax_c", "tmin_c", "tmean_c",
            "hot90_days", "hot100_days", "prcp_mm", "vp_pa", "n_days"]
    for y in range(args.first, last + 1):
        task = ee.batch.Export.table.toDrive(
            collection=year_table(parks, y), description=f"daymet_parks_{y}",
            folder=DRIVE_FOLDER, fileNamePrefix=f"daymet_parks_{y}",
            fileFormat="CSV", selectors=cols)
        task.start()
        print("Started", y)
    print(f"Started {last - args.first + 1} export tasks. Watch them at https://code.earthengine.google.com/tasks")


if __name__ == "__main__":
    main()
