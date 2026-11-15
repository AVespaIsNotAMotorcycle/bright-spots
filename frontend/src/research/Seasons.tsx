// Season-shift finder: which months change fastest in each park.
import { useMemo, useState } from "react";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL } from "../detective/model";
import { isTemp, useInsights, varLabel } from "./lib";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

export default function Seasons({ atlas, onOpenPark }: { atlas: Atlas | null; onOpenPark: (id: string) => void }) {
  const { data: ins } = useInsights();
  const [v, setV] = useState("tmin_c");

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
              <tr key={r.id}>
                <td>
                  <button className="link-btn" onClick={() => onOpenPark(r.id)}>{r.name}</button>
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
