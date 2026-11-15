"""Step 7: simplified park boundary shapes for the map.

Source : NPS boundary service (public, no key)
         https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/
         NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2
Writes : ../frontend/public/park-shapes.json   {park_id: [[ring, ring, ...], ...]}  (lon/lat, 3 decimals)
Sequoia ("seki") and Kings Canyon ("kica") are drawn as two shapes.
Boundaries are simplified to about 400 m; they are for drawing, not measuring.
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "trends" / "parks"
OUT = ROOT.parent / "frontend" / "public" / "park-shapes.json"
BASE = ("https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/"
        "NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2/query")
ALIASES = {"SEKI": ["SEQU"]}  # the trend file "seki" is one NASA point; the map draws Sequoia alone
EXTRA = {"kica": ["KICA"]}  # Kings Canyon gets its own shape and id


def fetch(code: str):
    q = urllib.parse.urlencode({
        "where": f"UNIT_CODE='{code}'", "outFields": "UNIT_CODE", "returnGeometry": "true",
        "maxAllowableOffset": 0.004, "geometryPrecision": 3, "outSR": 4326, "f": "geojson"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f"{BASE}?{q}", timeout=90) as r:
                return json.load(r).get("features", [])
        except Exception:
            time.sleep(3 * (attempt + 1))
    return []


def main():
    shapes, missing = {}, []
    todo = [(f.stem, ALIASES.get(c := json.loads(f.read_text())["park"]["unit_code"].upper(), [c]))
            for f in sorted(DATA.glob("*.json"))] + list(EXTRA.items())
    for key, codes in todo:
        feats = []
        for c in codes:
            feats += fetch(c)
        geoms = [shape(x["geometry"]) for x in feats if x.get("geometry")]
        if not geoms:
            missing.append(key)
            continue
        g = unary_union(geoms).simplify(0.003, preserve_topology=True)
        polys = list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
        shapes[key] = [[[[round(x, 3), round(y, 3)] for x, y in ring.coords]
                        for ring in [p.exterior, *p.interiors]] for p in polys if p.area > 1e-6]
        print(key, len(polys))
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(shapes, separators=(",", ":")))
    print("missing:", missing, "size KB:", OUT.stat().st_size // 1024)


if __name__ == "__main__":
    main()
