// Season-shift finder: which months change fastest in each park.
import { useMemo, useState } from "react";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL } from "../detective/model";
import { isTemp, slopeText, useInsights, varLabel } from "./lib";
import { E, Source, StationStyle, Tag } from "./station";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

type Cells = Record<string, { sen: number | null; verdict: string }>;

/** 12 wedges, one per month. Longer wedge = faster change. Rust up, blue down, dark edge = confirmed. */
function Wheel({ cells, maxAbs, label }: { cells: Cells; maxAbs: number; label: string }) {
  const S = 300, c = S / 2, r0 = 34, r1 = 122;
  const wedge = (i: number, r: number) => {
    const a0 = ((i - 3) / 12) * 2 * Math.PI + 0.02, a1 = ((i - 2) / 12) * 2 * Math.PI - 0.02;
    const p = (a: number, rr: number) => `${(c + rr * Math.cos(a)).toFixed(1)} ${(c + rr * Math.sin(a)).toFixed(1)}`;
    return `M${p(a0, r0)} L${p(a0, r)} A${r} ${r} 0 0 1 ${p(a1, r)} L${p(a1, r0)} A${r0} ${r0} 0 0 0 ${p(a0, r0)}Z`;
  };
  return (
    <svg viewBox={`0 0 ${S} ${S}`} style={{ width: "100%", maxWidth: 320, display: "block", margin: "0 auto" }} role="img" aria-label={`Season wheel for ${label}`}>
      {[0.33, 0.66, 1].map((k) => (
        <circle key={k} cx={c} cy={c} r={r0 + (r1 - r0) * k} fill="none" stroke={E.bark} strokeOpacity={0.12} strokeDasharray="3 4" />
      ))}
      {MONTHS.map((m, i) => {
        const x = cells[m];
        const sen = x?.sen;
        const r = sen == null ? r0 + 2 : r0 + 4 + (r1 - r0 - 4) * Math.min(1, Math.abs(sen) / maxAbs);
        const real = x?.verdict === "real";
        const a = ((i - 2.5) / 12) * 2 * Math.PI;
        return (
          <g key={m}>
            <path d={wedge(i, r)} fill={sen == null ? E.sand : sen >= 0 ? E.rust : E.dusk}
              fillOpacity={real ? 0.9 : 0.4} stroke={real ? E.bark : "none"} strokeWidth={1.5}>
              <title>{`${PERIOD_LABEL[m]}: ${sen != null ? sen.toFixed(3) : "no data"} per decade${real ? ", confirmed" : ""}`}</title>
            </path>
            <text x={c + (r1 + 14) * Math.cos(a)} y={c + (r1 + 14) * Math.sin(a) + 4} fontSize={11} textAnchor="middle" fill={E.bark}>
              {PERIOD_LABEL[m]}
            </text>
          </g>
        );
      })}
      <circle cx={c} cy={c} r={r0 - 3} fill={E.cream} stroke={E.sage} />
      <text x={c} y={c + 4} fontSize={10} textAnchor="middle" fill={E.pine} fontWeight={700}>
        {label.length > 11 ? label.slice(0, 10) + "…" : label}
      </text>
    </svg>
  );
}

export default function Seasons({ atlas, onOpenPark }: { atlas: Atlas | null; onOpenPark: (id: string) => void }) {
  const { data: ins } = useInsights();
  const [v, setV] = useState("tmin_c");
  const [wheelPark, setWheelPark] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!atlas || !ins) return [];
    const by = new Map<string, Record<string, { sen: number | null; verdict: string }>>();
    for (const m of MONTHS)
      for (const c of atlas.atlas[v]?.[m] ?? []) {
        const r = by.get(c.park_id) ?? {};
        r[m] = { sen: c.sen, verdict: c.verdict };
        by.set(c.park_id, r);
      }
    return Array.from(by, ([id, cells]) => {
      const vals = MONTHS.map((m) => cells[m]?.sen).filter((x): x is number => x != null);
      const fastest = MONTHS.reduce((b, m) => ((cells[m]?.sen ?? -Infinity) > (cells[b]?.sen ?? -Infinity) ? m : b), "1");
      const slowest = MONTHS.reduce((b, m) => ((cells[m]?.sen ?? Infinity) < (cells[b]?.sen ?? Infinity) ? m : b), "1");
      return {
        id,
        name: ins.parks.find((p) => p.id === id)?.name ?? id,
        cells,
        fastest,
        slowest,
        spread: vals.length ? Math.max(...vals) - Math.min(...vals) : 0,
      };
    }).sort((a, b) => b.spread - a.spread);
  }, [atlas, ins, v]);

  if (!atlas || !ins) return <p className="muted">Loading…</p>;
  const f = isTemp(atlas, v) ? 1.8 : 1;
  const maxAbs = Math.max(0.01, ...rows.flatMap((r) => MONTHS.map((m) => Math.abs(r.cells[m]?.sen ?? 0))));
  const tally = (key: "fastest" | "slowest") => {
    const t: Record<string, number> = {};
    rows.forEach((r) => (t[r[key]] = (t[r[key]] ?? 0) + 1));
    return Object.entries(t)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, n]) => `${PERIOD_LABEL[m]} (${n} parks)`)
      .join(", ");
  };
  const cellBg = (sen: number | null | undefined) => {
    if (sen == null) return "transparent";
    const a = Math.min(1, Math.abs(sen) / maxAbs);
    return sen >= 0 ? `rgba(139,58,26,${0.1 + 0.75 * a})` : `rgba(26,58,92,${0.1 + 0.75 * a})`;
  };

  return (
    <div className="panel-stack">
      <div className="card">
        <h2 className="section-title">Season shifts</h2>
        <p className="panel-intro">
          Averages hide uneven change. Each row is a park and each column a month. Colour shows the trend per decade
          (rust up, blue down). A bold outline means the trend is real after the false-discovery-rate test. Rows are
          ordered by the gap between the fastest and slowest month.
        </p>
        <label className="field" style={{ maxWidth: 260 }}>
          <span className="small muted">Variable</span>
          <select className="text-input" value={v} onChange={(e) => setV(e.target.value)}>
            {Object.entries(atlas.variables).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
        </label>
        <p className="small" style={{ margin: "10px 0 0" }}>
          Fastest-rising month across parks: <b>{tally("fastest")}</b>. Slowest: <b>{tally("slowest")}</b>.
        </p>
      </div>
      {rows.length > 0 && (() => {
        const w = rows.find((r) => r.id === wheelPark) ?? rows[0];
        const fast = w.cells[w.fastest], slow = w.cells[w.slowest];
        return (
          <section className="st-card" style={{ padding: 16 }}>
            <StationStyle />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Tag>🌗 Season wheel</Tag>
              <select className="text-input" value={w.id} onChange={(e) => setWheelPark(e.target.value)} style={{ maxWidth: 260 }}>
                {[...rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, alignItems: "center", marginTop: 8 }}>
              <Wheel cells={w.cells} maxAbs={maxAbs} label={w.name} />
              <div style={{ color: E.bark }}>
                <h3 style={{ fontFamily: "var(--font-display)", color: E.pine, margin: "0 0 6px" }}>{w.name}</h3>
                <p className="small" style={{ margin: "0 0 4px" }}>
                  {(fast?.sen ?? 0) >= 0 ? "Fastest rise" : "Smallest fall"}: <b style={{ color: E.rust }}>{PERIOD_LABEL[w.fastest]}</b>, {slopeText(fast?.sen, v, atlas)}
                  {fast?.verdict === "real" ? " (confirmed)" : " (not confirmed)"}.
                </p>
                <p className="small" style={{ margin: "0 0 8px" }}>
                  {(slow?.sen ?? 0) < 0 ? "Fastest fall" : "Slowest rise"}: <b style={{ color: E.dusk }}>{PERIOD_LABEL[w.slowest]}</b>, {slopeText(slow?.sen, v, atlas)}
                  {slow?.verdict === "real" ? " (confirmed)" : " (not confirmed)"}.
                </p>
                <p className="micro" style={{ margin: 0 }}>
                  Longer wedge = faster change. Rust = rising, blue = falling. Solid with a dark edge = confirmed (q &lt; 0.05).
                  All wheels share one scale, so parks can be compared. Click a table row to show it here.
                </p>
                <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => onOpenPark(w.id)}>Open in atlas →</button>
              </div>
            </div>
            <Source />
          </section>
        );
      })()}

      <div className="card table-wrap">
        <table className="detail-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Park</th>
              {MONTHS.map((m) => (
                <th key={m}>{PERIOD_LABEL[m]}</th>
              ))}
              <th>Fastest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => { setWheelPark(r.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{ cursor: "pointer", background: r.id === wheelPark ? "var(--accent-tint)" : undefined }}>
                <td>
                  <button className="link-btn" onClick={(e) => { e.stopPropagation(); onOpenPark(r.id); }}>{r.name}</button>
                </td>
                {MONTHS.map((m) => {
                  const c = r.cells[m];
                  return (
                    <td
                      key={m}
                      title={c?.sen != null ? `${(c.sen * f).toFixed(2)} per decade, ${c.verdict}` : "no data"}
                      style={{
                        background: cellBg(c?.sen),
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                        outline: c?.verdict === "real" ? "2px solid var(--text)" : undefined,
                        outlineOffset: -2,
                        fontWeight: c?.verdict === "real" ? 700 : 400,
                      }}
                    >
                      {c?.sen != null ? (c.sen * f).toFixed(1) : "–"}
                    </td>
                  );
                })}
                <td>{PERIOD_LABEL[r.fastest]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="micro muted">
          {varLabel(atlas, v)}, change per decade in {isTemp(atlas, v) ? "°F" : atlas.variables[v]?.unit}.
        </p>
      </div>
    </div>
  );
}
