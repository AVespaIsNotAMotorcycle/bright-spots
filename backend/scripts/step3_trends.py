"""Step 3: trends and significance for every park × variable × period.

Inputs : out/parks.csv, out/daymet/*.csv (step 1), out/power_monthly.csv (step 2)
Outputs: out/trends.csv              one row per park × variable × period (the trend atlas)
         out/web/atlas.json          compact table for the national map
         out/web/parks/<park>.json   per-park trends + yearly series for charts

Periods: each month (1-12), each season (DJF, MAM, JJA, SON; December counts toward the
next year's winter), and the whole year. Only complete periods are used.

Statistics for each yearly series:
  * Sen's slope (per decade) + Mann-Kendall test (original)
  * PRIMARY p-value: the original Mann-Kendall test, or, when the residuals show
    significant year-to-year autocorrelation, the modified test of Hamed & Rao (1998)
    (Yue & Wang 2004 as fallback). Column p_method says which was used.
    Checked on fake data with no trend: ~6% of tests had p < 0.05 and ~1% passed FDR.
  * Ordinary least squares slope with 95% confidence interval and t-test p-value
  * Signal-to-noise: change per decade divided by the year-to-year scatter
  * False discovery rate (Benjamini-Hochberg) across parks, for each variable × period:
    with ~64 tests per map, some would look "significant" by luck alone.

Verdicts (for the app and explainer cards):
  real      q < 0.05                   "Real, not luck"
  possible  p < 0.05 but q >= 0.05     "Possible, not proven"
  none      p >= 0.05                  "No clear change"
  short     fewer than MIN_YEARS years "Too little data"
  flat      the value never changes (e.g. no 100°F days ever)
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy import stats
from statsmodels.stats.multitest import multipletests

from parks import POWER_ONLY

OUT = Path("out")
MIN_YEARS = 15
MIN_DAYS_IN_MONTH = 28

# variable -> (how to combine months into a season/year, label, unit, is temperature)
VARIABLES = {
    "tmax_c":      ("mean", "Average daily high", "°C", True),
    "tmin_c":      ("mean", "Average daily low", "°C", True),
    "tmean_c":     ("mean", "Average temperature", "°C", True),
    "hot90_days":  ("sum", "Days above 90°F", "days", False),
    "hot100_days": ("sum", "Days above 100°F", "days", False),
    "prcp_mm":     ("sum", "Precipitation", "mm", False),
}
SEASONS = {"DJF": (12, 1, 2), "MAM": (3, 4, 5), "JJA": (6, 7, 8), "SON": (9, 10, 11)}
PERIODS = [str(m) for m in range(1, 13)] + list(SEASONS) + ["annual"]


# ---------- loading ----------

def load_monthly():
    parks = pd.read_csv(OUT / "parks.csv")
    code_to_ids = parks.groupby("unit_code")["park_id"].apply(list).to_dict()

    frames = []
    daymet_files = sorted((OUT / "daymet").glob("*.csv"))
    if daymet_files:
        d = pd.concat([pd.read_csv(f) for f in daymet_files], ignore_index=True)
        rows = []
        for code, ids in code_to_ids.items():
            sub = d[d["UNIT_CODE"] == code]
            for pid in ids:
                rows.append(sub.assign(park_id=pid))
        d = pd.concat(rows, ignore_index=True).drop(columns=["UNIT_CODE"])
        d["source"] = "daymet"
        frames.append(d)

    p_path = OUT / "power_monthly.csv"
    if p_path.exists():
        p = pd.read_csv(p_path)
        p["source"] = "power"
        frames.append(p)

    m = pd.concat(frames, ignore_index=True)
    m = m[m["n_days"] >= MIN_DAYS_IN_MONTH]          # drop incomplete months
    return parks, m


def yearly_series(m, var, period):
    """Return a Series indexed by year for one park/source monthly table."""
    how = VARIABLES[var][0]
    if period.isdigit():
        s = m[m["month"] == int(period)].set_index("year")[var]
        return s.dropna().sort_index()
    months = SEASONS.get(period, tuple(range(1, 13)))
    t = m[m["month"].isin(months)][["year", "month", var]].copy()
    if period == "DJF":
        t.loc[t["month"] == 12, "year"] += 1
    g = t.groupby("year")[var]
    agg = g.mean() if how == "mean" else g.sum()
    agg = agg[g.count() == len(months)]               # only complete seasons/years
    return agg.dropna().sort_index()


# ---------- statistics ----------

def trend_stats(s):
    years = s.index.values.astype(float)
    y = s.values.astype(float)
    n = len(y)
    out = {"n_years": n,
           "first_year": int(years[0]) if n else None,
           "last_year": int(years[-1]) if n else None,
           "mean": float(np.mean(y)) if n else None}
    if n < MIN_YEARS:
        out["verdict_raw"] = "short"
        return out
    if np.allclose(y, y[0]):
        out["verdict_raw"] = "flat"
        return out

    lr = stats.linregress(years, y)
    tcrit = stats.t.ppf(0.975, n - 2)
    orig = mk.original_test(y)
    sen0 = float(orig.slope)
    r0 = y - (np.median(y - sen0 * (years - years[0])) + sen0 * (years - years[0]))
    lag1_0 = float(np.corrcoef(r0[:-1], r0[1:])[0, 1])
    autocorrelated = abs(lag1_0) > 1.96 / np.sqrt(n)
    # Only correct for autocorrelation when it is actually present (standard practice;
    # the corrected tests are slightly too eager on short, uncorrelated series).
    # Hamed-Rao can fail (negative variance) when residuals are strongly anti-correlated;
    # fall back to Yue-Wang, then to the original test, and record which one was used.
    p_mod, p_method = np.nan, None
    tests = [("hamed_rao", mk.hamed_rao_modification_test),
             ("yue_wang", mk.yue_wang_modification_test)] if autocorrelated else []
    for name, fn in tests:
        try:
            with np.errstate(all="ignore"):
                p_try = float(fn(y).p)
        except Exception:
            continue
        if np.isfinite(p_try):
            p_mod, p_method = p_try, name
            break
    if not np.isfinite(p_mod):
        p_mod, p_method = float(orig.p), "original"

    sen = float(orig.slope)                            # per year
    intercept = np.median(y - sen * (years - years[0]))
    resid = y - (intercept + sen * (years - years[0]))
    sd = float(np.std(resid, ddof=1))
    lag1 = float(np.corrcoef(resid[:-1], resid[1:])[0, 1]) if n > 3 else None

    out.update({
        "sen_per_decade": sen * 10,
        "mk_tau": float(orig.Tau),
        "mk_p": float(orig.p),
        "mk_p_modified": p_mod,
        "ols_per_decade": lr.slope * 10,
        "ols_ci_low": (lr.slope - tcrit * lr.stderr) * 10,
        "ols_ci_high": (lr.slope + tcrit * lr.stderr) * 10,
        "ols_p": float(lr.pvalue),
        "resid_sd": sd,
        "signal_to_noise": (sen * 10) / sd if sd > 0 else None,
        "lag1_autocorr": lag1,
        "tests_agree": bool((lr.pvalue < 0.05) == (p_mod < 0.05)
                            and np.sign(lr.slope) == np.sign(sen or lr.slope)),
        "p": p_mod,                                    # primary p-value
        "p_method": p_method,
    })
    return out


def add_fdr(df):
    """Benjamini-Hochberg across parks within each variable × period × source.
    Parks sharing a boundary (Sequoia / Kings Canyon) are counted once."""
    df["q"] = np.nan
    for _, idx in df[df["p"].notna()].groupby(["variable", "period", "source"]).groups.items():
        sub = df.loc[idx]
        uniq = sub.drop_duplicates("unit_code")
        q = multipletests(uniq["p"], method="fdr_bh")[1]
        qmap = dict(zip(uniq["unit_code"], q))
        df.loc[idx, "q"] = sub["unit_code"].map(qmap).values
    return df


def verdict(r):
    if r.get("verdict_raw") in ("short", "flat"):
        return r["verdict_raw"]
    if r["q"] < 0.05:
        return "real"
    if r["p"] < 0.05:
        return "possible"
    return "none"


# ---------- main ----------

def main():
    parks, m = load_monthly()
    unit = parks.set_index("park_id")["unit_code"].to_dict()
    daymet_available = bool(list((OUT / "daymet").glob("*.csv"))) if (OUT / "daymet").exists() else False
    primary = {pid: ("power" if (unit[pid] in POWER_ONLY or not daymet_available) else "daymet") for pid in parks.park_id}

    rows, series_store = [], {}
    for (pid, source), pm in m.groupby(["park_id", "source"]):
        for var in VARIABLES:
            if var not in pm or pm[var].isna().all():
                continue
            for period in PERIODS:
                s = yearly_series(pm, var, period)
                r = trend_stats(s)
                r.update({"park_id": pid, "unit_code": unit[pid], "source": source,
                          "is_primary": source == primary[pid],
                          "variable": var, "period": period})
                rows.append(r)
                if source == primary[pid]:
                    series_store[(pid, var, period)] = s

    df = pd.DataFrame(rows)
    df["p"] = df["p"].astype(float)
    df = add_fdr(df)
    df["verdict"] = df.apply(verdict, axis=1)

    # Cross-check: does POWER agree with Daymet on the direction (and verdict) of the trend?
    key = ["park_id", "variable", "period"]
    dm = df[df.source == "daymet"].set_index(key)
    pw = df[df.source == "power"].set_index(key)
    both = dm.index.intersection(pw.index)
    cc = pd.DataFrame({
        "power_sen_per_decade": pw.loc[both, "sen_per_decade"],
        "power_verdict": pw.loc[both, "verdict"],
        "sources_same_direction": np.sign(dm.loc[both, "sen_per_decade"]) == np.sign(pw.loc[both, "sen_per_decade"]),
    })
    prim = df[df.is_primary].set_index(key).join(cc).reset_index()

    # Temperature changes also in °F (a change of 1°C = 1.8°F; no +32 for differences).
    for col in ["sen_per_decade", "ols_per_decade", "ols_ci_low", "ols_ci_high", "power_sen_per_decade"]:
        is_temp = prim["variable"].map(lambda v: VARIABLES[v][3])
        prim[col.replace("per_decade", "per_decade_f").replace("ci_", "ci_f_")] = np.where(
            is_temp, prim[col] * 1.8, np.nan)

    prim = prim.drop(columns=["verdict_raw"], errors="ignore")
    prim.to_csv(OUT / "trends.csv", index=False)

    # ---- web outputs ----
    web = OUT / "web" / "parks"
    web.mkdir(parents=True, exist_ok=True)
    meta = parks.drop_duplicates("park_id").set_index("park_id")
    def num(x):
        if x is None or (not isinstance(x, str) and pd.isna(x)):
            return None
        if isinstance(x, (bool, np.bool_)):
            return bool(x)
        if isinstance(x, (int, np.integer)):
            return int(x)
        if isinstance(x, (float, np.floating)):
            return round(float(x), 4)
        return x

    for pid, g in prim.groupby("park_id"):
        doc = {"park": {k: num(v) for k, v in meta.loc[pid].items()} | {"park_id": pid},
               "source": primary[pid], "trends": [], "series": {}}
        for _, r in g.iterrows():
            doc["trends"].append({k: num(r[k]) for k in [
                "variable", "period", "n_years", "first_year", "last_year", "mean",
                "sen_per_decade", "sen_per_decade_f", "ols_per_decade", "ols_ci_low", "ols_ci_high",
                "ols_p", "mk_p", "mk_p_modified", "p", "p_method", "q", "signal_to_noise", "lag1_autocorr",
                "tests_agree", "verdict", "power_sen_per_decade", "power_verdict",
                "sources_same_direction"] if k in r})
        for (p2, var, period), s in series_store.items():
            if p2 == pid:
                doc["series"].setdefault(var, {})[period] = {
                    "years": [int(y) for y in s.index], "values": [round(float(v), 3) for v in s.values]}
        (web / f"{pid}.json").write_text(json.dumps(doc, ensure_ascii=False))

    atlas = {}
    for (var, period), g in prim.groupby(["variable", "period"]):
        atlas.setdefault(var, {})[period] = [
            {"park_id": r.park_id, "sen": num(r.sen_per_decade), "q": num(r.q), "verdict": r.verdict}
            for r in g.itertuples()]
    (OUT / "web" / "atlas.json").write_text(json.dumps({
        "variables": {k: {"label": v[1], "unit": v[2]} for k, v in VARIABLES.items()},
        "periods": PERIODS, "atlas": atlas}, ensure_ascii=False))

    counts = prim.groupby("verdict").size().to_dict()
    print(f"{len(prim)} trend tests across {prim.park_id.nunique()} parks. Verdicts: {counts}")
    print(f"Wrote {OUT/'trends.csv'}, {OUT/'web/atlas.json'}, {web}/<park>.json")


if __name__ == "__main__":
    main()
