// Compare two parks: overlaid yearly series and side-by-side statistics.
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL, VERDICT_LABEL } from "../detective/model";
import { headToHead } from "./insights";
import { VERDICT_COLOR, findRow, slopeText, useInsights, usePark } from "./lib";
import { E, Source, StationStyle, Tag } from "./station";

export function Pickers({
  atlas, v, per, setV, setPer,
}: {
  atlas: Atlas | null; v: string; per: string; setV: (v: string) => void; setPer: (p: string) => void;
}) {
  return (
    <>
      <label className="field">
        <span className="small muted">Variable</span>
        <select className="text-input" value={v} onChange={(e) => setV(e.target.value)}>
          {Object.entries(atlas?.variables ?? {}).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="small muted">Period</span>
        <select className="text-input" value={per} onChange={(e) => setPer(e.target.value)}>
          {(atlas?.periods ?? []).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p] ?? p}</option>)}
        </select>
      </label>
    </>
  );
}

export function ParkSelect({
  label, value, onChange, parks,
}: {
  label: string; value: string; onChange: (id: string) => void; parks: { id: string; name: string }[];
}) {
  return (
    <label className="field">
      <span className="small muted">{label}</span>
      <select className="text-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {[...parks].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </label>
  );
}

export default function Compare({
  atlas, a, b, v: v0, per: per0, onChange,
}: {
  atlas: Atlas | null;
  a?: string | null; b?: string | null; v?: string | null; per?: string | null;
  onChange: (a: string, b: string, v: string, per: string) => void;
}) {
  const { data: ins } = useInsights();
  const [anomaly, setAnomaly] = useState(true);
  const pa = a ?? "crla";
  const pb = b ?? "zion";
  const v = v0 ?? "tmax_c";
  const per = per0 ?? "annual";
  const A = usePark(pa);
  const B = usePark(pb);

  const data = useMemo(() => {
    const sa = A.data?.series[v]?.[per];
    const sb = B.data?.series[v]?.[per];
    if (!sa || !sb) return [];
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const ma = anomaly ? mean(sa.values) : 0;
    const mb = anomaly ? mean(sb.values) : 0;
    const years = Array.from(new Set([...sa.years, ...sb.years])).sort((x, y) => x - y);
    return years.map((y) => {
      const ia = sa.years.indexOf(y), ib = sb.years.indexOf(y);
      return { year: y, a: ia >= 0 ? +(sa.values[ia] - ma).toFixed(2) : null, b: ib >= 0 ? +(sb.values[ib] - mb).toFixed(2) : null };
    });
  }, [A.data, B.data, v, per, anomaly]);

  if (!ins) return <p className="muted">Loading…</p>;
  const nameA = ins.parks.find((p) => p.id === pa)?.name ?? pa;
  const nameB = ins.parks.find((p) => p.id === pb)?.name ?? pb;
  const ra = findRow(A.data, v, per);
  const rb = findRow(B.data, v, per);
  const set = (na: string, nb: string, nv: string, np: string) => onChange(na, nb, nv, np);
  const unit = atlas?.variables[v]?.unit ?? "";
  const opposite = ra?.sen_per_decade != null && rb?.sen_per_decade != null &&
    Math.sign(ra.sen_per_decade) !== Math.sign(rb.sen_per_decade) &&
    ra.verdict !== "none" && rb.verdict !== "none";

  const rows: [string, (r: typeof ra) => string][] = [
    ["Trend (Sen's slope)", (r) => slopeText(r?.sen_per_decade, v, atlas)],
    ["Verdict", (r) => (r ? VERDICT_LABEL[r.verdict] : "–")],
    ["p (primary test)", (r) => (r?.p != null ? r.p.toFixed(4) : "–")],
    ["q (FDR-adjusted)", (r) => (r?.q != null ? r.q.toFixed(4) : "–")],
    ["Signal-to-noise", (r) => (r?.signal_to_noise != null ? r.signal_to_noise.toFixed(2) : "–")],
    ["Lag-1 autocorrelation", (r) => (r?.lag1_autocorr != null ? r.lag1_autocorr.toFixed(2) : "–")],
    ["Test used", (r) => r?.p_method ?? "–"],
    ["Years", (r) => (r ? `${r.first_year}–${r.last_year} (${r.n_years})` : "–")],
  ];

  return (
    <div className="panel-stack">
      <div className="card">
        <h2 className="section-title">Compare two parks</h2>
        <div className="row gap-12" style={{ flexWrap: "wrap", margin: "8px 0" }}>
          <ParkSelect label="Park A" value={pa} parks={ins.parks} onChange={(id) => set(id, pb, v, per)} />
          <ParkSelect label="Park B" value={pb} parks={ins.parks} onChange={(id) => set(pa, id, v, per)} />
          <Pickers atlas={atlas} v={v} per={per} setV={(x) => set(pa, pb, x, per)} setPer={(x) => set(pa, pb, v, x)} />
          <label className="check" style={{ alignSelf: "end" }}>
            <input type="checkbox" checked={anomaly} onChange={(e) => setAnomaly(e.target.checked)} /> Show change from each park's average
          </label>
        </div>
        {opposite && (
          <p className="small" style={{ color: "var(--rust)", fontWeight: 600 }}>
            These parks trend in opposite directions here. Look at the driver variables next.
          </p>
        )}
        {(A.error || B.error) && <p className="error">Could not load a park's data.</p>}
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} width={44} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Legend />
            <Line type="monotone" dataKey="a" name={nameA} stroke="var(--pine)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            <Line type="monotone" dataKey="b" name={nameB} stroke="var(--rust)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <p className="micro muted">Values in {unit}{anomaly ? ", minus each park's own long-run average" : ""}.</p>
      </div>

      {ra && rb && (() => {
        const h = headToHead(ra, rb, (x) => slopeText(x, v, atlas).replace(/^\+/, ""));
        const lead = h.a === h.b ? null : h.a > h.b ? nameA : nameB;
        const side = (w: "a" | "b" | "tie", me: "a" | "b") =>
          w === me ? { background: E.pine, color: E.cream, fontWeight: 700 } : { color: E.bark };
        return (
          <section className="st-card" style={{ padding: 16 }}>
            <StationStyle />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Tag>⚖ Head-to-head</Tag>
              <button className="st-btn ghost" onClick={() => set(pb, pa, v, per)}>⇄ Swap</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10, margin: "12px 0" }}>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 19, color: E.pine, textAlign: "right" }}>{nameA}</b>
              <span className="st-num" style={{ fontSize: 30 }}>{h.a} – {h.b}</span>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 19, color: E.rust }}>{nameB}</b>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {h.rounds.map((r) => (
                <div key={r.name} style={{ display: "grid", gridTemplateColumns: "1fr 150px 1fr", gap: 8, alignItems: "center" }}>
                  <span className="small" style={{ ...side(r.winner, "a"), textAlign: "right", padding: "4px 10px", borderRadius: 8 }}>{r.a}</span>
                  <span className="micro" style={{ textAlign: "center", color: E.moss }}>{r.name}{r.winner === "tie" ? " · tie" : ""}</span>
                  <span className="small" style={{ ...side(r.winner, "b"), padding: "4px 10px", borderRadius: 8 }}>{r.b}</span>
                </div>
              ))}
            </div>
            <p className="small" style={{ color: E.bark, margin: "12px 0 0" }}>
              {lead
                ? <>{lead} has the stronger trend evidence here: it wins more rounds.</>
                : <>Even match: neither park's trend evidence is clearly stronger.</>}
              {" "}A stronger trend is not a better or worse park.
            </p>
            <Source />
          </section>
        );
      })()}

      <div className="card">
        <div className="table-wrap">
          <table className="detail-table">
            <thead><tr><th /><th>{nameA}</th><th>{nameB}</th></tr></thead>
            <tbody>
              {rows.map(([label, fn]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td style={label === "Verdict" && ra ? { color: VERDICT_COLOR[ra.verdict], fontWeight: 700 } : undefined}>{fn(ra)}</td>
                  <td style={label === "Verdict" && rb ? { color: VERDICT_COLOR[rb.verdict], fontWeight: 700 } : undefined}>{fn(rb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
