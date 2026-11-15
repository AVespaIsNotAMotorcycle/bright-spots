"""Step 6: EPA ecoregion (Level I and Level III) for each park's centre point.

Source: EPA ecoregion web service (public, no key)
  https://geodata.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/11
Writes: data/trends/ecoregions.json  {park_id: {"l1": ..., "l3": ...}}
A park whose centre point falls outside the layer (some islands, Alaska) gets nulls.
Run step4_insights.py afterwards to fold it into insights.json.
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data" / "trends"
URL = "https://geodata.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/11/query"


def lookup(lat, lon):
    q = urllib.parse.urlencode({
        "geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint", "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "outFields": "*", "returnGeometry": "false", "f": "json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f"{URL}?{q}", timeout=40) as r:
                feats = json.load(r).get("features", [])
            return feats[0]["attributes"] if feats else None
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def main():
    out = {}
    for f in sorted((DATA / "parks").glob("*.json")):
        d = json.loads(f.read_text())
        a = lookup(d["park"]["lat"], d["park"]["lon"])
        keys = {k.lower(): v for k, v in (a or {}).items()}
        out[f.stem] = {
            "l1": keys.get("na_l1name"), "l2": keys.get("na_l2name"), "l3": keys.get("us_l3name")}
        print(f.stem, out[f.stem])
    (DATA / "ecoregions.json").write_text(json.dumps(out, ensure_ascii=False, indent=0))
    print("missing:", [k for k, v in out.items() if not v["l1"]])


if __name__ == "__main__":
    main()
