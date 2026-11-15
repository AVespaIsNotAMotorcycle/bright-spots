// Opposite-trend finder: the same variable and period rising in one park and falling in another.
import { useMemo, useState } from "react";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL, VERDICT_LABEL } from "../detective/model";
import { VERDICT_COLOR, slopeText, useInsights, varLabel, type OppGroup, type TrendRef } from "./lib";

function Ref({ r, v, atlas }: { r: TrendRef | null | undefined; v: string; atlas: Atlas | null }) {
  if (!r || r.sen == null) return <span className="muted">no data</span>;
  return (
    <span>
      {slopeText(r.sen, v, atlas)}{" "}
      <span style={{ color: VERDICT_COLOR[r.verdict ?? "none"] }}>({VERDICT_LABEL[r.verdict ?? "none"]})</span>
    </span>
  );
}

export default function Opposites({
  atlas,
  onCompare,
}: {
  atlas: Atlas | null;
  onCompare: (a: string, b: string, v: string, per: string) => void;
}) {
  const { data, error } = useInsights();
  const [strongOnly, setStrongOnly] = useState(true);
  const [sel, setSel] = useState(0);

  const groups: OppGroup[] = useMemo(
    () => (data?.opposites ?? []).filter((g) => !strongOnly || g.tier === "strong"),
    [data, strongOnly],
  );

  if (error) return <p className="error">Could not load: {error}. Run step4_insights.py.</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const name = (id: string) => data.parks.find((p) => p.id === id)?.name ?? id;
  const g = groups[Math.min(sel, groups.length - 1)];

  return (
    <div className="panel-stack">
      <div className="card">
        <h2 className="section-title">Opposite-trend finder</h2>
        <p className="panel-intro">
          The same process can push a variable up in one park and down in another. These are the variable and period
          pairs where parks go both ways. <b>Strong</b> means each side has a trend that passes the false-discovery-rate
          test. <b>Weak</b> means at least one side is only "possible".
        </p>
        <label className="check">
          <input type="checkbox" checked={strongOnly} onChange={(e) => { setStrongOnly(e.target.checked); setSel(0); }} /> Strong only
        </label>
      </div>

      {groups.length === 0 && <p className="muted">No opposite-trend groups at this setting.</p>}

      {groups.length > 0 && (
        <div className="layout" style={{ display: "grid", gridTemplateColumns: "minmax(220px, 300px) 1fr", gap: 14 }}>
          <div className="card" style={{ maxHeight: 560, overflowY: "auto" }}>
            {groups.map((x, i) => (
              <button
                key={x.variable + x.period}
                className="park-row"
                onClick={() => setSel(i)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "8px 6px",
                  border: 0, borderBottom: "1px solid var(--border)", cursor: "pointer",
                  background: i === sel ? "var(--selected-tint)" : "none", color: "var(--text)",
                }}
              >
                <b>{varLabel(atlas, x.variable)}</b> · {PERIOD_LABEL[x.period] ?? x.period}
                <br />
                <span className="small muted">
                  {x.up.length} up, {x.down.length} down · {x.tier}
                </span>
              </button>
            ))}
          </div>

          {g && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>
                {varLabel(atlas, g.variable)} · {PERIOD_LABEL[g.period] ?? g.period}
              </h3>
              <div className="row gap-16" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p className="small" style={{ color: "var(--rising)", fontWeight: 700, margin: "0 0 4px" }}>Rising ({g.up.length})</p>
                  {g.up.slice(0, 8).map((u) => (
                    <div key={u.park} className="small">{name(u.park)}: {slopeText(u.sen, g.variable, atlas)}{" "}
                      <span style={{ color: VERDICT_COLOR[u.verdict] }}>({VERDICT_LABEL[u.verdict]})</span></div>
                  ))}
                  {g.up.length > 8 && <div className="small muted">and {g.up.length - 8} more</div>}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p className="small" style={{ color: "var(--falling)", fontWeight: 700, margin: "0 0 4px" }}>Falling ({g.down.length})</p>
                  {g.down.slice(0, 8).map((u) => (
                    <div key={u.park} className="small">{name(u.park)}: {slopeText(u.sen, g.variable, atlas)}{" "}
                      <span style={{ color: VERDICT_COLOR[u.verdict] }}>({VERDICT_LABEL[u.verdict]})</span></div>
                  ))}
                  {g.down.length > 8 && <div className="small muted">and {g.down.length - 8} more</div>}
                </div>
              </div>

              <h4 style={{ marginBottom: 4 }}>Strongest pair: {name(g.pair[0])} vs {name(g.pair[1])}</h4>
              <p className="small muted" style={{ margin: "0 0 6px" }}>
                Possible drivers, side by side. These are hypotheses to test, not proof.
              </p>
              <div className="table-wrap">
                <table className="detail-table">
                  <thead>
                    <tr><th>Variable</th><th>{name(g.pair[0])}</th><th>{name(g.pair[1])}</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><b>{varLabel(atlas, g.variable)}</b></td>
                      <td>{slopeText(g.up[0].sen, g.variable, atlas)}</td>
                      <td>{slopeText(g.down[0].sen, g.variable, atlas)}</td>
                    </tr>
                    {Object.entries(g.drivers).map(([dv, byPark]) => (
                      <tr key={dv}>
                        <td>{varLabel(atlas, dv)}</td>
                        <td><Ref r={byPark[g.pair[0]]} v={dv} atlas={atlas} /></td>
                        <td><Ref r={byPark[g.pair[1]]} v={dv} atlas={atlas} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn" style={{ marginTop: 10 }}
                onClick={() => onCompare(g.pair[0], g.pair[1], g.variable, g.period)}>
                Compare these two parks →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
