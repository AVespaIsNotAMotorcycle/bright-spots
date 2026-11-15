"""Step 5: check our NASA POWER temperature trends against NOAA weather stations.

Source : NOAA GHCN-Daily (public files, no token): https://www.ncei.noaa.gov/pub/data/ghcn/daily/
Reads  : data/trends/parks/*.json  (our annual tmax_c / tmin_c series)
Writes : data/trends/validation.json

For each chosen park we take the nearest station that has TMAX and TMIN from the early 1980s
to 2024 or later, build annual means (a year needs 12 months, a month needs 25 valid days,
flagged values dropped), and compare with our POWER series over the same years.

Grade:  good     r >= 0.7 and slopes differ by <= 0.2 °C/decade
        partial  same direction but not "good"
        differs  opposite direction
"""
import json
import math
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pymannkendall as mk

DATA = Path(__file__).resolve().parents[1] / "data" / "trends"
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("out/noaa")
BASE = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/"
MAX_KM = 40
WANT = 12
# Spread across regions and climates; the first WANT with a good station are used.
CANDIDATES = ["crla", "zion", "glac", "acad", "romo", "grca", "yell", "ever", "olym", "shen",
              "deva", "grsm", "jotr", "yose", "bibe", "mora", "sagu", "isro", "badl", "dena"]


def fetch(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / name.replace("/", "_")
    if not p.exists():
        urllib.request.urlretrieve(BASE + name, p)
    return p


def km(lat1, lon1, lat2, lon2):
    a = math.radians
    d = math.sin((a(lat2) - a(lat1)) / 2) ** 2 + math.cos(a(lat1)) * math.cos(a(lat2)) * math.sin((a(lon2) - a(lon1)) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(d))


def stations():
    names = {}
    for line in fetch("ghcnd-stations.txt").read_text().splitlines():
        names[line[:11]] = (float(line[12:20]), float(line[21:30]), float(line[31:37]), line[41:71].strip())
    inv = {}
    for line in fetch("ghcnd-inventory.txt").read_text().splitlines():
        sid, el = line[:11], line[31:35]
        if el in ("TMAX", "TMIN") and sid.startswith("US"):
            inv.setdefault(sid, {})[el] = (int(line[36:40]), int(line[41:45]))
    ok = {s: v for s, v in inv.items()
          if "TMAX" in v and "TMIN" in v
          and max(v["TMAX"][0], v["TMIN"][0]) <= 1985 and min(v["TMAX"][1], v["TMIN"][1]) >= 2024}
    return {s: names[s] for s in ok if s in names}


def annual_means(station: str, element: str) -> dict[int, float]:
    path = fetch(f"all/{station}.dly")
    months: dict[tuple[int, int], list[float]] = {}
    for line in path.read_text().splitlines():
        if line[17:21] != element:
            continue
        y, m = int(line[11:15]), int(line[15:17])
        vals = []
        for d in range(31):
            seg = line[21 + 8 * d: 29 + 8 * d]
            v, qflag = int(seg[:5]), seg[6]
            if v != -9999 and qflag == " ":
                vals.append(v / 10)
        if len(vals) >= 25:
            months[(y, m)] = [sum(vals) / len(vals)]
    out = {}
    for y in range(1981, 2026):
        if all((y, m) in months for m in range(1, 13)):
            out[y] = float(np.mean([months[(y, m)][0] for m in range(1, 13)]))
    return out


def trend(years, vals):
    r = mk.original_test(np.array(vals))
    return {"slope": round(float(r.slope) * 10, 3), "p": round(float(r.p), 4)}


def main():
    sts = stations()
    print(f"{len(sts)} stations with a long TMAX+TMIN record")
    results = []
    for pid in CANDIDATES:
        if len(results) >= WANT:
            break
        f = DATA / "parks" / f"{pid}.json"
        if not f.exists():
            continue
        d = json.loads(f.read_text())
        lat, lon = d["park"]["lat"], d["park"]["lon"]
        near = sorted(((km(lat, lon, v[0], v[1]), s) for s, v in sts.items()))
        near = [(dist, s) for dist, s in near if dist <= MAX_KM][:3]
        rec = None
        for dist, sid in near:
            row = {"park": pid, "name": d["park"]["name"], "station": sid, "station_name": sts[sid][3],
                   "distance_km": round(dist, 1), "station_elev_m": sts[sid][2]}
            ok = True
            for el, var in (("TMAX", "tmax_c"), ("TMIN", "tmin_c")):
                st = annual_means(sid, el)
                ours = d["series"].get(var, {}).get("annual")
                if not ours:
                    ok = False
                    break
                ours_map = dict(zip(ours["years"], ours["values"]))
                yrs = sorted(set(st) & set(ours_map))
                if len(yrs) < 25:
                    ok = False
                    break
                a = [st[y] for y in yrs]
                b = [ours_map[y] for y in yrs]
                ta, tb = trend(yrs, a), trend(yrs, b)
                r = float(np.corrcoef(a, b)[0, 1])
                diff = ta["slope"] - tb["slope"]
                same = np.sign(ta["slope"]) == np.sign(tb["slope"])
                grade = "good" if (r >= 0.7 and abs(diff) <= 0.2) else ("partial" if same else "differs")
                row[var] = {"station": ta, "power": tb, "diff": round(diff, 3), "r": round(r, 2),
                            "bias_c": round(float(np.mean(a) - np.mean(b)), 2), "years": [yrs[0], yrs[-1]],
                            "n": len(yrs), "grade": grade}
            if ok:
                rec = row
                break
        if rec:
            results.append(rec)
            print(rec["name"], rec["station_name"], rec["distance_km"], "km",
                  rec["tmax_c"]["grade"], rec["tmin_c"]["grade"])
    out = {"source": "NOAA GHCN-Daily", "max_km": MAX_KM,
           "grading": "good: r>=0.7 and slopes within 0.2 °C/decade; partial: same direction; differs: opposite",
           "parks": results}
    (DATA / "validation.json").write_text(json.dumps(out, ensure_ascii=False))
    g = [x[v]["grade"] for x in results for v in ("tmax_c", "tmin_c")]
    print({k: g.count(k) for k in ("good", "partial", "differs")})


if __name__ == "__main__":
    main()
