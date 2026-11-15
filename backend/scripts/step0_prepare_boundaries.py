"""Step 0: cut the 64 national parks out of the official NPS boundary file.

Input : the NPS "Administrative Boundaries of National Park System Units"
        shapefile (download from https://irma.nps.gov/DataStore/Reference/Profile/2316744
        or search IRMA for the newest version; it has fields UNIT_CODE, UNIT_NAME, UNIT_TYPE).
Output: out/parks_64.zip      -> upload to Earth Engine as a table asset
        out/parks.csv         -> one row per park: code, name, state, area, a point inside the park

Usage:  python step0_prepare_boundaries.py path/to/nps_boundary.shp
"""
import sys
import zipfile
from pathlib import Path

import geopandas as gpd

from parks import PARKS, UNIT_CODES, POWER_ONLY

OUT = Path("out")


def main(shp_path: str) -> None:
    OUT.mkdir(exist_ok=True)
    gdf = gpd.read_file(shp_path)
    if "UNIT_CODE" not in gdf.columns:
        sys.exit(f"No UNIT_CODE field. Fields are: {list(gdf.columns)}")

    gdf["UNIT_CODE"] = gdf["UNIT_CODE"].str.upper().str.strip()
    sel = gdf[gdf["UNIT_CODE"].isin(UNIT_CODES)]
    missing = sorted(set(UNIT_CODES) - set(sel["UNIT_CODE"]))
    if missing:
        print("WARNING, codes not found in the boundary file:", missing)
        print("  Check the code (e.g. Sequoia/Kings Canyon may be SEQU/KICA) and edit parks.py.")

    # A park can be several polygons (park + preserve, islands). Merge them per code.
    merged = sel.dissolve(by="UNIT_CODE", as_index=False)[["UNIT_CODE", "geometry"]]

    # Area in km2 using an equal-area projection.
    merged["area_km2"] = merged.to_crs("ESRI:102003").area / 1e6

    # A point guaranteed to be inside the park (centroids can fall outside odd shapes).
    pts = merged.to_crs("EPSG:4326").representative_point()
    merged["lat"] = pts.y.round(4)
    merged["lon"] = pts.x.round(4)

    # Shapefile for Earth Engine: WGS84, light simplification (~50 m) to keep upload small.
    ee_gdf = merged.to_crs("EPSG:4326")[["UNIT_CODE", "geometry"]].copy()
    ee_gdf["geometry"] = ee_gdf.simplify(0.0005, preserve_topology=True)
    shp_dir = OUT / "parks_64_shp"
    shp_dir.mkdir(exist_ok=True)
    ee_gdf.to_file(shp_dir / "parks_64.shp")
    with zipfile.ZipFile(OUT / "parks_64.zip", "w") as z:
        for f in shp_dir.iterdir():
            z.write(f, f.name)

    # One row per park (Sequoia and Kings Canyon share a row's geometry if they share a code).
    info = merged.set_index("UNIT_CODE")
    rows = []
    for park_id, name, code, state in PARKS:
        r = info.loc[code] if code in info.index else None
        rows.append({
            "park_id": park_id, "name": name, "unit_code": code, "state": state,
            "area_km2": round(float(r["area_km2"]), 1) if r is not None else None,
            "lat": float(r["lat"]) if r is not None else None,
            "lon": float(r["lon"]) if r is not None else None,
            "climate_source": "NASA POWER" if code in POWER_ONLY else "Daymet (NASA ORNL)",
        })
    import pandas as pd
    pd.DataFrame(rows).to_csv(OUT / "parks.csv", index=False)
    print(f"Wrote {OUT/'parks_64.zip'} ({len(merged)} boundary units) and {OUT/'parks.csv'} (64 parks).")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
