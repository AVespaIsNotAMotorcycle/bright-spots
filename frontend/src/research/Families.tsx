// Park families: parks grouped by HOW they are changing, not by what they are like.
import { useState } from "react";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL } from "../detective/model";
import { FAMILY_COLORS, useInsights, varLabel } from "./lib";
import ParkMap from "./MapSwitch";

export default function Families({
  atlas,
  onOpenPark,
}: {
  atlas: Atlas | null;
  onOpenPark: (id: string) => void;
}) {
  const { data, error } = useInsights();
  const [open, setOpen] = useState<number | null>(null);
  const [colorBy, setColorBy] = useState<"family" | "eco">("family");

  if (error) return <p className="error">Could not load families: {error}. Run step4_insights.py.</p>;
  if (!data) return <p className="muted">Loading families…</p>;

  const fam = data.families;
  const nameOf = (id: string) => data.parks.find((p) => p.id === id)?.name ?? id;
  const colorFor = (n: number) => FAMILY_COLORS[(n - 1) % FAMILY_COLORS.length];
  const eco = fam.ecoregions;
  const ecoNames = eco ? Array.from(new Set(Object.values(eco.parks).map((e) => e.l1).filter((x): x is string => !!x))).sort() : [];
  const ecoColor = (id: string) => {
    const l1 = eco?.parks[id]?.l1;
    return l1 ? FAMILY_COLORS.concat(["#6b8e23", "#a0522d", "#708090", "#c71585", "#2f4f4f"])[ecoNames.indexOf(l1)] : "#bbb";
  };
  const pretty = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const xs = Object.values(fam.parks).map((p) => p.x);
  const ys = Object.values(fam.parks).map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  return (
    <div className="panel-stack">
      <div className="card">
        <h2 className="section-title">Parks that change together</h2>
        <p className="panel-intro">
          Each park gets a change fingerprint: for {fam.features.length} variable and season pairs, the trend divided by
          the park's year-to-year scatter. Parks with similar fingerprints share a family (average-linkage clustering).
          Family names compare a family with the average park, so "slow-warming" still means warming, only slower.
        </p>
        {eco && (
          <div className="row gap-8" style={{ margin: "8px 0" }}>
            <span className="small muted">Colour dots by</span>
            {(["family", "eco"] as const).map((k) => (
              <button key={k} className={`nav-tab${colorBy === k ? " active" : ""}`} onClick={() => setColorBy(k)}>
                {k === "family" ? "Family" : "EPA ecoregion"}
              </button>
            ))}
          </div>
        )}
        <ParkMap
          parks={data.parks}
          colorOf={(id) => (colorBy === "eco" ? ecoColor(id) : colorFor(fam.parks[id]?.family ?? 1))}
          tip={(id) =>
            colorBy === "eco"
              ? pretty(eco?.parks[id]?.l1 ?? "no ecoregion found")
              : `Family ${fam.parks[id]?.family}, ${Math.round((fam.parks[id]?.agreement ?? 0) * 100)}% agreement`}
          onPick={onOpenPark}
          selected={open ? fam.families.find((f) => f.id === open)?.parks ?? [] : []}
        />
      </div>

      <div className="card-grid">
        {fam.families.map((f) => (
          <div className="card" key={f.id} style={{ borderTop: `4px solid ${colorFor(f.id)}` }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: 0 }}>Family {f.id}</h3>
              <span className="tag">{f.size} park{f.size === 1 ? "" : "s"}</span>
            </div>
            <p style={{ margin: "6px 0" }}><b>{f.name}</b></p>
            <p className="small" style={{ color: f.stable ? "var(--pine)" : "#b7791f", margin: "0 0 8px" }}>
              {f.stable ? "Stable" : "Not stable"}: parks stayed together in {Math.round(f.stability * 100)}% of{" "}
              {fam.bootstraps} re-runs (stable at {Math.round(fam.stable_at * 100)}%).
              {f.size <= 3 ? " Very small families are usually outliers." : ""}
            </p>
            <details onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? f.id : open === f.id ? null : open)}>
              <summary className="small" style={{ cursor: "pointer" }}>Fingerprint and parks</summary>
              <div style={{ margin: "8px 0" }}>
                {f.signature.map((s) => {
                  const w = Math.min(50, Math.abs(s.z) * 22);
                  return (
                    <div key={s.variable + s.period} className="row small" style={{ gap: 6, alignItems: "center" }}>
                      <span style={{ width: 150, flex: "none" }}>
                        {varLabel(atlas, s.variable)} · {PERIOD_LABEL[s.period] ?? s.period}
                      </span>
                      <span style={{ position: "relative", flex: 1, height: 10, background: "var(--surface-2)", borderRadius: 4 }}>
                        <span
                          style={{
                            position: "absolute",
                            top: 0,
                            height: 10,
                            borderRadius: 4,
                            width: `${w}%`,
                            left: s.z >= 0 ? "50%" : `${50 - w}%`,
                            background: s.z >= 0 ? "var(--rust)" : "var(--sky)",
                          }}
                        />
                      </span>
                    </div>
                  );
                })}
                <p className="micro muted" style={{ margin: "4px 0 0" }}>Right of centre: trends faster than the average park. Left: slower.</p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {f.parks.map((id) => (
                  <button key={id} className="chip" onClick={() => onOpenPark(id)}
                    title={`${Math.round((fam.parks[id]?.agreement ?? 0) * 100)}% agreement with its family`}>
                    {nameOf(id)}
                  </button>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>

      {eco && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Do families follow ecoregions?</h3>
          <p className="small">
            Partly. Matching families to EPA Level I ecoregions over {eco.n_with_ecoregion} parks and {eco.n_ecoregions}{" "}
            ecoregions gives an adjusted Rand index of <b>{eco.ari}</b> (0 is chance, 1 is identical groups). Shuffling the
            ecoregions 2,000 times beat that only {eco.p < 0.001 ? "about once in 2,000 tries" : `${(eco.p * 100).toFixed(1)}% of the time`}
            {" "}(p = {eco.p}). So where a park sits explains some of how it changes, but far from all. Alaska, Hawaiʻi and
            island parks are left out because the ecoregion layer has no polygon at their centre point. Elevation is not
            tested yet.
          </p>
          <div className="table-wrap">
            <table className="detail-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Family</th><th>Ecoregions of its parks</th></tr></thead>
              <tbody>
                {Object.entries(eco.by_family).sort().map(([f, byEco]) => (
                  <tr key={f}>
                    <td>Family {f}</td>
                    <td>
                      {Object.entries(byEco).sort((a, b) => b[1].length - a[1].length).map(([e, ps]) => (
                        <div key={e}><b>{pretty(e)}</b> ({ps.length}): <span className="muted">{ps.map(nameOf).join(", ")}</span></div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Fingerprint space</h3>
        <p className="small muted">A flat picture of the fingerprints (first two principal components). Close dots change alike.</p>
        <svg viewBox="0 0 600 300" style={{ width: "100%", height: "auto" }} role="img" aria-label="Park families scatter">
          <rect width={600} height={300} fill="var(--surface-2)" rx={8} />
          {data.parks.map((p) => {
            const f = fam.parks[p.id];
            if (!f) return null;
            const cx = 20 + ((f.x - x0) / (x1 - x0 || 1)) * 560;
            const cy = 280 - ((f.y - y0) / (y1 - y0 || 1)) * 260;
            return (
              <circle key={p.id} cx={cx} cy={cy} r={6} fill={colorFor(f.family)} stroke="var(--surface)" onClick={() => onOpenPark(p.id)}
                style={{ cursor: "pointer" }}>
                <title>{p.name}</title>
              </circle>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
