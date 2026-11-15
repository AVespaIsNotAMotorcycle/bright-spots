"""Step 8: GRACE / GRACE-FO total water storage at each park, with the same trend test as step 3.

Input : data/grace_1deg.npz (scripts/prepare_grace.py, from CSR RL06.3 mascons)
        data/trends/insights.json (park centre points)
Output: data/trends/grace.json   small, committed; the app needs no GRACE download

What GRACE measures: the change in ALL water stored in a region (groundwater, soil moisture,
snow, ice, lakes and rivers), as centimetres of water over the area, relative to the
2004-2009 mean. Mascons are about 300 km wide, much bigger than most parks, so a park's
value describes its whole region. Neighbouring parks often share one value.

Yearly values: each month minus that calendar month's long-run mean (removes the seasonal
cycle), then averaged over the year. Years with fewer than 6 months are left out: GRACE
skipped months from 2011 to save its batteries, and there is a gap between GRACE and
GRACE-FO (mid-2017 to mid-2018).
The trend test is step 3's: Sen's slope, Mann-Kendall (Hamed-Rao or Yue-Wang when the
residuals are autocorrelated), then Benjamini-Hochberg FDR across parks, with parks in the
same 1-degree cell counted once.

Usage: .venv/bin/python scripts/step8_grace_parks.py   (from backend/)
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.stats.multitest import multipletests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from step3_trends import trend_stats  # noqa: E402

from app.datasets import bundled  # noqa: E402

MIN_MONTHS = 6
OUT = ROOT / "data" / "trends" / "grace.json"


def main() -> None:
    parks = json.loads((ROOT / "data" / "trends" / "insights.json").read_text())["parks"]
    rows: dict[str, dict] = {}
    for p in parks:
        g = bundled.grace_series(p["lat"], p["lon"])
        if not g.land:
            rows[p["id"]] = {"land": False}
            continue
        ok = [(int(m.date[:4]), int(m.date[5:7]), m.lwe_cm) for m in g.months if m.lwe_cm is not None]
        # Remove the seasonal cycle first, so a year missing its wet months is not biased dry.
        clim = {mo: float(np.mean([v for _, mm, v in ok if mm == mo])) for mo in {mm for _, mm, _ in ok}}
        by_year: dict[int, list[float]] = defaultdict(list)
        for y, mo, v in ok:
            by_year[y].append(v - clim[mo])
        years = sorted(y for y, v in by_year.items() if len(v) >= MIN_MONTHS)
        s = pd.Series([float(np.mean(by_year[y])) for y in years], index=years)
        st = trend_stats(s)
        rows[p["id"]] = {
            "land": True,
            "cell": [g.cell_lat, g.cell_lon],
            "years": years,
            "values": [round(v, 2) for v in s.values],
            "n_years": st["n_years"],
            "sen_per_decade": st.get("sen_per_decade"),
            "p": st.get("p"),
            "p_method": st.get("p_method"),
            "signal_to_noise": st.get("signal_to_noise"),
            "verdict_raw": st.get("verdict_raw"),
        }

    # FDR across parks, each 1-degree cell once.
    cells = {}
    for r in rows.values():
        if r.get("p") is not None:
            cells.setdefault(tuple(r["cell"]), r["p"])
    keys = list(cells)
    qs = dict(zip(keys, multipletests([cells[k] for k in keys], method="fdr_bh")[1], strict=True)) if keys else {}
    for r in rows.values():
        if r.get("p") is None:
            r["q"] = None
            r["verdict"] = r.pop("verdict_raw", None) or "short"
            continue
        r["q"] = float(qs[tuple(r["cell"])])
        r.pop("verdict_raw", None)
        r["verdict"] = "real" if r["q"] < 0.05 else "possible" if r["p"] < 0.05 else "none"

    all_years = [y for r in rows.values() for y in r.get("years", [])]
    meta = {
        "source": "CSR GRACE/GRACE-FO RL06.3 mascons (NASA/DLR GRACE and NASA/GFZ GRACE-FO missions)",
        "url": "https://www2.csr.utexas.edu/grace/RL0603_mascons.html",
        "measure": "Total water storage anomaly, cm of water, seasonal cycle removed, yearly mean",
        "resolution_km": 300,
        "first_year": min(all_years) if all_years else None,
        "last_year": max(all_years) if all_years else None,
        "min_months_per_year": MIN_MONTHS,
        "unique_cells": len(keys),
    }
    OUT.write_text(json.dumps({"meta": meta, "parks": rows}, separators=(",", ":")))
    real = sum(r.get("verdict") == "real" for r in rows.values())
    print(f"wrote {OUT.name}: {len(rows)} parks, {len(keys)} cells, {real} confirmed trends, years {meta['first_year']}-{meta['last_year']}")


if __name__ == "__main__":
    main()
