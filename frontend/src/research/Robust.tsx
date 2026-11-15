// Robustness: start-year test, quality facts, methods and code export for one park series.
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Atlas, ParkTrends, TrendRow } from "../detective/model";
import { PERIOD_LABEL, VERDICT_LABEL } from "../detective/model";
import { ParkSelect, Pickers } from "./Compare";
import { findRow, pettitt, robustness, slopeText, startYearScan, useInsights, usePark } from "./lib";
import Validation from "./Validation";

export const BIB = `@article{gonzalez2018,
  author  = {Gonzalez, Patrick and Wang, Fushan and Notaro, Michael and Vimont, Daniel J. and Williams, John W.},
  title   = {Disproportionate magnitude of climate change in United States national parks},
  journal = {Environmental Research Letters},
  volume  = {13}, number = {10}, pages = {104001}, year = {2018},
  doi     = {10.1088/1748-9326/aade09}
}
@misc{nasapower,
  title  = {NASA Prediction Of Worldwide Energy Resources (POWER) Project, daily data},
  author = {{NASA Langley Research Center}},
  url    = {https://power.larc.nasa.gov/}
}
@article{hamed1998,
  author = {Hamed, Khaled H. and Rao, A. Ramachandra},
  title  = {A modified Mann-Kendall trend test for autocorrelated data},
  journal = {Journal of Hydrology}, volume = {204}, pages = {182--196}, year = {1998}
}
@article{benjamini1995,
  author = {Benjamini, Yoav and Hochberg, Yosef},
  title  = {Controlling the false discovery rate},
  journal = {Journal of the Royal Statistical Society B}, volume = {57}, pages = {289--300}, year = {1995}
}
@article{sen1968,
  author = {Sen, Pranab Kumar},
  title  = {Estimates of the regression coefficient based on Kendall's tau},
  journal = {Journal of the American Statistical Association}, volume = {63}, pages = {1379--1389}, year = {1968}
}`;

function snippet(lang: "python" | "r", d: ParkTrends, v: string, per: string): string {
  const s = d.series[v]?.[per];
  if (!s) return "# no series for this selection";
  const years = s.years.join(", ");
  const vals = s.values.join(", ");
  if (lang === "python")
    return `# ${d.park.name}, ${v}, ${PERIOD_LABEL[per] ?? per} (source: ${d.source})
import numpy as np, pymannkendall as mk
from scipy import stats

years  = np.array([${years}])
values = np.array([${vals}])

res = mk.original_test(values)            # Mann-Kendall + Sen's slope
print("Sen slope per decade:", res.slope * 10, " p:", res.p)
print("Hamed-Rao p (autocorrelation-aware):", mk.hamed_rao_modification_test(values).p)
print("OLS:", stats.linregress(years, values))
`;
  return `# ${d.park.name}, ${v}, ${PERIOD_LABEL[per] ?? per} (source: ${d.source})
library(trend); library(Kendall)

years  <- c(${years})
values <- c(${vals})

print(sens.slope(values))                 # Sen's slope per year (x10 for per decade)
print(MannKendall(values))
print(summary(lm(values ~ years)))
`;
}

export default function Robust({
  atlas, park, v: v0, per: per0, onChange,
}: {
  atlas: Atlas | null;
  park?: string | null; v?: string | null; per?: string | null;
  onChange: (park: string, v: string, per: string) => void;
}) {
  const { data: ins } = useInsights();
  const id = park ?? "crla";
  const v = v0 ?? "tmax_c";
  const per = per0 ?? "annual";
  const { data, error } = usePark(id);
  const [lang, setLang] = useState<"python" | "r">("python");
  const [copied, setCopied] = useState("");

  const series = data?.series[v]?.[per];
  const row: TrendRow | undefined = findRow(data, v, per);
  const scan = useMemo(() => (series ? startYearScan(series.years, series.values) : []), [series]);
  const rob = useMemo(() => (scan.length && row?.sen_per_decade != null ? robustness(scan, row.sen_per_decade) : null), [scan, row]);

  const cp = useMemo(() => (series ? pettitt(series.years, series.values) : null), [series]);
  const cpData = useMemo(() => {
    if (!series || !cp) return [];
    return series.years.map((y, i) => ({
      year: y,
      value: series.values[i],
      level: i <= cp.index ? cp.before : cp.after,
    }));
  }, [series, cp]);

  if (!ins) return <p className="muted">Loading…</p>;
  const temp = (atlas?.variables[v]?.unit ?? "").includes("°");
  const f = temp ? 1.8 : 1;
  const chart = scan.map((s) => ({ start: s.start, slope: +(s.slope * f).toFixed(3), sig: s.p < 0.05 }));
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("Copy blocked by the browser");
    }
  };

  return (
    <div className="panel-stack">
      <div className="card">
        <h2 className="section-title">Does the trend survive a different start year?</h2>
        <p className="panel-intro">
          A trend can come from picking a convenient start year. This re-runs the test for every start year that leaves at
          least 15 years of data. A robust trend keeps its direction and stays significant across most of them.
        </p>
        <div className="row gap-12" style={{ flexWrap: "wrap", margin: "8px 0" }}>
          <ParkSelect label="Park" value={id} parks={ins.parks} onChange={(p) => onChange(p, v, per)} />
          <Pickers atlas={atlas} v={v} per={per} setV={(x) => onChange(id, x, per)} setPer={(x) => onChange(id, v, x)} />
        </div>
        {error && <p className="error">Could not load this park.</p>}
        {!series && !error && <p className="muted">Loading…</p>}
        {series && !rob && <p className="muted">Not enough data for this selection.</p>}
        {rob && row && (
          <>
            <p style={{ fontSize: 16, margin: "6px 0" }}>
              <b>{rob.label}.</b> {rob.significant} of {rob.total} start years give a significant trend in the same direction as the full record ({Math.round(rob.sigShare * 100)}%).
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                <XAxis dataKey="start" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false}
                  label={{ value: "Start year", position: "insideBottom", offset: -10, fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} width={44} />
                <Tooltip formatter={(val) => [`${Number(val).toFixed(2)} per decade`, "Slope"]}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={0} stroke="var(--chart-neutral)" />
                <Line type="monotone" dataKey="slope" stroke="var(--accent)" strokeWidth={2}
                  dot={(p: { cx?: number; cy?: number; payload?: { sig: boolean }; index?: number }) => (
                    <circle key={p.index} cx={p.cx} cy={p.cy} r={4}
                      fill={p.payload?.sig ? "var(--pine)" : "var(--surface)"} stroke="var(--pine)" strokeWidth={1.5} />
                  )} />
              </LineChart>
            </ResponsiveContainer>
            <p className="micro muted">
              Filled dots: significant (p &lt; 0.05). Hollow: not. Slope in {temp ? "°F" : atlas?.variables[v]?.unit} per decade.
              This quick check uses the plain Mann-Kendall test; the atlas uses the autocorrelation-aware version when needed.
            </p>
          </>
        )}
      </div>

      {cp && series && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Is it a steady trend or a step?</h3>
          <p className="small" style={{ margin: "0 0 6px" }}>
            {cp.p < 0.05 ? (
              <>
                <b>Likely step change near {cp.year}</b> (Pettitt test, p = {cp.p.toFixed(3)}). The average moved from{" "}
                {cp.before.toFixed(2)} to {cp.after.toFixed(2)} {atlas?.variables[v]?.unit}. A straight trend line may
                describe this poorly. Check for a sensor or method change.
              </>
            ) : (
              <>No clear step change (Pettitt p = {cp.p.toFixed(2)}). The most likely break would be near {cp.year}.</>
            )}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cpData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} width={44} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine x={cp.year} stroke="var(--rust)" strokeDasharray="4 3" />
              <Line type="monotone" dataKey="value" name="Yearly value" stroke="var(--accent)" strokeWidth={1.5} dot={{ r: 2 }} />
              <Line type="stepAfter" dataKey="level" name="Average before / after" stroke="var(--rust)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="micro muted">
            Values in {atlas?.variables[v]?.unit}. The test finds the single most likely break point and gives an
            approximate p-value.
          </p>
        </div>
      )}

      {row && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Quality of this result</h3>
          <div className="kv-grid">
            <div className="stat"><div className="stat-value">{slopeText(row.sen_per_decade, v, atlas)}</div><div className="small muted">Sen's slope</div></div>
            <div className="stat"><div className="stat-value">{row.signal_to_noise?.toFixed(2) ?? "–"}</div>
              <div className="small muted">Signal-to-noise (decade change ÷ yearly scatter). Under 0.5 is a small effect even if significant.</div></div>
            <div className="stat"><div className="stat-value">{row.lag1_autocorr?.toFixed(2) ?? "–"}</div>
              <div className="small muted">Lag-1 autocorrelation. Past ±{(1.96 / Math.sqrt(row.n_years ?? 1)).toFixed(2)} the corrected test is used.</div></div>
            <div className="stat"><div className="stat-value">{row.p_method ?? "–"}</div>
              <div className="small muted">Test used. Tests agree with OLS: {row.tests_agree == null ? "–" : row.tests_agree ? "yes" : "no"}.</div></div>
            <div className="stat"><div className="stat-value">{VERDICT_LABEL[row.verdict]}</div>
              <div className="small muted">q = {row.q?.toFixed(3) ?? "–"} after FDR across parks.</div></div>
          </div>
        </div>
      )}

      <Validation />

      {data && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Reproduce it in your own tools</h3>
            <div className="row gap-8">
              {(["python", "r"] as const).map((l) => (
                <button key={l} className={`nav-tab${lang === l ? " active" : ""}`} onClick={() => setLang(l)}>
                  {l === "python" ? "Python" : "R"}
                </button>
              ))}
              <button className="btn" onClick={() => copy("code", snippet(lang, data, v, per))}>
                {copied === "code" ? "Copied" : "Copy code"}
              </button>
            </div>
          </div>
          <pre style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, overflowX: "auto", fontSize: 12, maxHeight: 260 }}>
            {snippet(lang, data, v, per)}
          </pre>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Methods</h3>
        <ul className="small" style={{ lineHeight: 1.6, paddingLeft: 18 }}>
          <li><b>Data:</b> NASA POWER daily values (about 50 km cells) for each park's centre point, 1981 to the latest full year. Months with under 28 days are dropped. Seasons and years must be complete.</li>
          <li><b>Trend:</b> Sen's slope per decade with the Mann-Kendall test. If the residuals are autocorrelated, the Hamed-Rao modified test supplies the p-value (Yue-Wang as a fallback).</li>
          <li><b>Multiple testing:</b> Benjamini-Hochberg false discovery rate across parks, separately for each variable and period. "Real" means q &lt; 0.05. "Possible" means p &lt; 0.05 but q ≥ 0.05.</li>
          <li><b>Minimum record:</b> fewer than 15 years gives "Too little data" and no verdict.</li>
          <li><b>Known limits:</b> POWER cells are coarse, so mountain parks read warm. Checked against NOAA stations for 12 parks only (see the station check above); results are mixed. Rain is MERRA-2-based, which is weaker than satellite rain. Sequoia and Kings Canyon share one boundary and one result.</li>
        </ul>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ margin: "8px 0" }}>Citations (BibTeX)</h4>
          <button className="btn-ghost" onClick={() => copy("bib", BIB)}>{copied === "bib" ? "Copied" : "Copy BibTeX"}</button>
        </div>
        <pre style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, overflowX: "auto", fontSize: 11, maxHeight: 200 }}>{BIB}</pre>
      </div>
    </div>
  );
}
