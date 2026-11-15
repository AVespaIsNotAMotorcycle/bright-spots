"""Step 4: park families and opposite-trend finder.

Reads  : data/trends/parks/*.json   (written by step3, copied to backend/data/trends)
Writes : data/trends/insights.json

Park families (spec Feature 2)
  * Change fingerprint = signal-to-noise (Sen's slope per decade / year-to-year SD)
    for a fixed set of variable x period pairs. Temperature mean is left out because it is
    redundant with max and min.
  * Columns are standardised, then clustered with average linkage (Euclidean).
  * Stability: re-cluster 300 times on a random resample of the fingerprint columns
    and count how often two parks share a family. A family is "stable" when its
    parks share it at least 70% of the time on average.
  * Names come from the family's strongest shared trends, in plain words.

Opposite trends (spec Feature 3)
  * For every variable x period, list parks with a Real or Possible trend up and parks
    with one down. Strong = both sides contain a Real (FDR-passing) park.
  * For the best up/down pair, attach the trends of driver variables side by side.
    These are hypotheses, not proof.
"""
import json
from pathlib import Path

import numpy as np
from scipy.cluster.hierarchy import fcluster, linkage

DATA = Path(__file__).resolve().parents[1] / "data" / "trends"
K = 5
BOOTSTRAPS = 300
STABLE_AT = 0.70

# (variable, period, phrase when the park's z-score is high, phrase when low)
FEATURES = [
    ("tmax_c", "annual", "faster-rising day heat", "slower-rising day heat"),
    ("tmin_c", "annual", "faster-rising night warmth", "slower-rising night warmth"),
    ("tmax_c", "JJA", "fast-warming summers", "slow-warming summers"),
    ("tmin_c", "DJF", "fast-warming winter nights", "slow-warming winter nights"),
    ("tmax_c", "MAM", "fast-warming springs", "slow-warming springs"),
    ("tmax_c", "SON", "fast-warming autumns", "slow-warming autumns"),
    ("prcp_mm", "annual", "wetting years", "drying years"),
    ("prcp_mm", "DJF", "wetting winters", "drying winters"),
    ("prcp_mm", "JJA", "wetting summers", "drying summers"),
    ("hot90_days", "annual", "rising 90°F days", "fewer new 90°F days"),
]

# For an opposite-trend pair, which other variables might explain it.
DRIVERS = {
    "tmax_c": ["prcp_mm", "tmin_c"],
    "tmin_c": ["prcp_mm", "tmax_c"],
    "tmean_c": ["prcp_mm"],
    "hot90_days": ["prcp_mm", "tmax_c"],
    "hot100_days": ["prcp_mm", "tmax_c"],
    "prcp_mm": ["tmax_c", "tmin_c"],
}


def load_parks():
    parks = {}
    for f in sorted((DATA / "parks").glob("*.json")):
        d = json.loads(f.read_text())
        rows = {(t["variable"], t["period"]): t for t in d["trends"]}
        parks[f.stem] = {"park": d["park"], "rows": rows}
    return parks


def trend_ref(row):
    if not row:
        return None
    return {
        "sen": row.get("sen_per_decade"),
        "sn": row.get("signal_to_noise"),
        "q": row.get("q"),
        "verdict": row.get("verdict"),
        "years": [row.get("first_year"), row.get("last_year")],
    }


def families(parks):
    ids = list(parks)
    X = np.zeros((len(ids), len(FEATURES)))
    for i, pid in enumerate(ids):
        for j, (v, p, _, _) in enumerate(FEATURES):
            r = parks[pid]["rows"].get((v, p)) or {}
            sn = r.get("signal_to_noise")
            X[i, j] = sn if sn is not None else 0.0
    sd = X.std(axis=0)
    sd[sd == 0] = 1
    Z = (X - X.mean(axis=0)) / sd

    labels = fcluster(linkage(Z, "average"), K, criterion="maxclust")

    # Bootstrap over fingerprint columns.
    rng = np.random.default_rng(42)
    co = np.zeros((len(ids), len(ids)))
    for _ in range(BOOTSTRAPS):
        cols = rng.integers(0, Z.shape[1], Z.shape[1])
        lab = fcluster(linkage(Z[:, cols], "average"), K, criterion="maxclust")
        co += lab[:, None] == lab[None, :]
    co /= BOOTSTRAPS

    # PCA for a 2-D picture of the families.
    u, s, _ = np.linalg.svd(Z - Z.mean(axis=0), full_matrices=False)
    xy = (u[:, :2] * s[:2])

    fams = []
    for fam in sorted(set(labels)):
        members = [i for i in range(len(ids)) if labels[i] == fam]
        zmean = Z[members].mean(axis=0)
        rawmean = X[members].mean(axis=0)
        order = np.argsort(-np.abs(zmean))
        phrases = []
        for j in order[:3]:
            if abs(zmean[j]) < 0.4:
                continue
            phrases.append(FEATURES[j][2] if zmean[j] > 0 else FEATURES[j][3])
        tz, pz = float(rawmean[0:6].mean()), float(rawmean[6:9].mean())   # signal-to-noise, not z
        title = "Fast warmers" if tz >= 0.7 else ("Steady warmers" if tz >= 0.45 else "Gentle warmers")
        if pz <= -0.15:
            title += ", drying"
        elif pz >= 0.15:
            title += ", wetting"
        stab = float(np.mean([co[np.ix_([i], members)].mean() for i in members]))
        fams.append({
            "id": int(fam),
            "title": title,
            "name": ", ".join(phrases) if phrases else "no strong shared trend",
            "size": len(members),
            "stability": round(stab, 2),
            "stable": stab >= STABLE_AT,
            "signature": [
                {"variable": FEATURES[j][0], "period": FEATURES[j][1],
                 "z": round(float(zmean[j]), 2), "sn": round(float(rawmean[j]), 2)}
                for j in range(len(FEATURES))],
            "parks": [ids[i] for i in members],
        })
    fams.sort(key=lambda f: -f["size"])
    remap = {f["id"]: n + 1 for n, f in enumerate(fams)}
    for f in fams:
        f["id"] = remap[f["id"]]

    per_park = {}
    for i, pid in enumerate(ids):
        mem = [j for j in range(len(ids)) if labels[j] == labels[i] and j != i]
        per_park[pid] = {
            "family": remap[int(labels[i])],
            "agreement": round(float(co[i, mem].mean()), 2) if mem else 1.0,
            "x": round(float(xy[i, 0]), 3), "y": round(float(xy[i, 1]), 3),
        }
    return {"k": K, "bootstraps": BOOTSTRAPS, "stable_at": STABLE_AT,
            "features": [{"variable": v, "period": p} for v, p, _, _ in FEATURES],
            "families": fams, "parks": per_park}


def opposites(parks):
    variables = sorted({v for p in parks.values() for (v, _) in p["rows"]})
    periods = sorted({pe for p in parks.values() for (_, pe) in p["rows"]})
    seen_codes = {}
    out = []
    for v in variables:
        for pe in periods:
            up, down = [], []
            for pid, p in parks.items():
                r = p["rows"].get((v, pe))
                if not r or r.get("verdict") not in ("real", "possible"):
                    continue
                code = p["park"]["unit_code"]
                if (v, pe, code) in seen_codes:
                    continue
                seen_codes[(v, pe, code)] = 1
                item = {"park": pid, "sen": r["sen_per_decade"], "sn": r.get("signal_to_noise"),
                        "q": r.get("q"), "verdict": r["verdict"]}
                (up if r["sen_per_decade"] > 0 else down).append(item)
            if not up or not down:
                continue
            key = lambda x: -abs(x["sn"] or 0)  # noqa: E731
            up.sort(key=key)
            down.sort(key=key)
            strong = any(x["verdict"] == "real" for x in up) and any(x["verdict"] == "real" for x in down)
            a, b = up[0], down[0]
            drivers = {}
            for dv in DRIVERS.get(v, []):
                drivers[dv] = {pid: trend_ref(parks[pid]["rows"].get((dv, pe)))
                               for pid in (a["park"], b["park"])}
            out.append({"variable": v, "period": pe, "tier": "strong" if strong else "weak",
                        "up": up, "down": down, "pair": [a["park"], b["park"]],
                        "drivers": drivers,
                        "score": round(min(abs(a["sn"] or 0), abs(b["sn"] or 0)), 2)})
    out.sort(key=lambda g: (g["tier"] != "strong", -g["score"]))
    out = [g for g in out if g["score"] >= 0.05]
    return out[:80]


def ari(a, b):
    """Adjusted Rand index between two labelings (1 = same grouping, about 0 = chance)."""
    a, b = np.asarray(a), np.asarray(b)
    n = len(a)
    ua, ia = np.unique(a, return_inverse=True)
    ub, ib = np.unique(b, return_inverse=True)
    m = np.zeros((len(ua), len(ub)))
    for x, y in zip(ia, ib):
        m[x, y] += 1
    c2 = lambda v: v * (v - 1) / 2  # noqa: E731
    sum_ij = c2(m).sum()
    sa, sb = c2(m.sum(1)).sum(), c2(m.sum(0)).sum()
    exp = sa * sb / c2(n)
    mx = (sa + sb) / 2
    return float((sum_ij - exp) / (mx - exp)) if mx != exp else 0.0


def ecoregion_overlay(fam):
    path = DATA / "ecoregions.json"
    if not path.exists():
        return None
    eco = json.loads(path.read_text())
    ids = [pid for pid in fam["parks"] if eco.get(pid, {}).get("l1")]
    fl = [fam["parks"][pid]["family"] for pid in ids]
    el = [eco[pid]["l1"] for pid in ids]
    obs = ari(fl, el)
    rng = np.random.default_rng(7)
    perm = [ari(fl, rng.permutation(el)) for _ in range(2000)]
    pval = float((np.sum(np.array(perm) >= obs) + 1) / (len(perm) + 1))
    table = {}
    for pid, f, e in zip(ids, fl, el):
        table.setdefault(str(f), {}).setdefault(e, []).append(pid)
    return {"parks": eco, "n_with_ecoregion": len(ids), "n_ecoregions": len(set(el)),
            "ari": round(obs, 3), "p": round(pval, 4), "by_family": table}


def main():
    parks = load_parks()
    meta = [{"id": pid, "name": p["park"]["name"], "state": p["park"].get("state"),
             "lat": p["park"]["lat"], "lon": p["park"]["lon"]} for pid, p in parks.items()]
    fam = families(parks)
    opp = opposites(parks)
    fam["ecoregions"] = ecoregion_overlay(fam)
    (DATA / "insights.json").write_text(json.dumps(
        {"parks": meta, "families": fam, "opposites": opp}, ensure_ascii=False))
    print(f"{len(parks)} parks; families: {[(f['id'], f['size'], f['stability'], f['title']) for f in fam['families']]}")
    e = fam["ecoregions"]
    if e:
        print(f"ecoregion overlay: ARI={e['ari']} p={e['p']} over {e['n_with_ecoregion']} parks, {e['n_ecoregions']} ecoregions")
    print(f"opposite-trend groups: {len(opp)} ({sum(g['tier'] == 'strong' for g in opp)} strong)")


if __name__ == "__main__":
    main()
