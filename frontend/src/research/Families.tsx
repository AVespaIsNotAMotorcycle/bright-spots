// Park families: parks grouped by HOW they are changing, not by what they are like.
import { useState } from "react";
import type { Atlas } from "../detective/model";
import { FAMILY_COLORS, useInsights, type FamilyInfo, type Insights, type ParkMeta } from "./lib";
import MiniMap from "./MiniMap";
import ParkMap from "./ParkMap";

const FEATURE_LABEL: Record<string, string> = {
  "tmax_c|annual": "Daytime highs, year",
  "tmin_c|annual": "Night lows, year",
  "tmax_c|JJA": "Summer highs",
  "tmin_c|DJF": "Winter nights",
  "tmax_c|MAM": "Spring highs",
  "tmax_c|SON": "Autumn highs",
  "prcp_mm|annual": "Rain, year",
  "prcp_mm|DJF": "Winter rain",
  "prcp_mm|JJA": "Summer rain",
  "hot90_days|annual": "Days over 90°F",
};

interface CardProps {
  f: FamilyInfo;
  fam: Insights["families"];
  parks: ParkMeta[];
  nameOf: (id: string) => string;
  colorFor: (n: number) => string;
  onOpenPark: (id: string) => void;
  onHover: (id: number | null) => void;
  compact?: boolean;
}

function FamilyCard({ f, fam, parks, nameOf, colorFor, onOpenPark, onHover, compact }: CardProps) {
  const color = colorFor(f.id);
  return (
    <div
      className="card"
      style={{ borderTop: `4px solid ${color}`, opacity: compact ? 0.92 : 1 }}
      onMouseEnter={() => onHover(f.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>
          <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 6, background: color, marginRight: 8 }} />
          {f.title}
        </h3>
        <span className="tag">{f.size} park{f.size === 1 ? "" : "s"}</span>
      </div>
      <p className="micro muted" style={{ margin: "4px 0 8px" }}>
        {f.name} (compared with the average park)
      </p>
      <p style={{ margin: "0 0 8px" }}>
        <span
          title={`Parks stayed together in ${Math.round(f.stability * 100)}% of ${fam.bootstraps} re-runs. Stable is ${Math.round(fam.stable_at * 100)}% or more.`}
          style={{
            fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 12, cursor: "help",
            background: f.stable ? "rgba(45,90,39,.14)" : "rgba(183,121,31,.16)",
            color: f.stable ? "var(--pine)" : "#8a5a10",
          }}
        >
          {f.stable ? "Stable group" : "Loose group"} · {Math.round(f.stability * 100)}%
        </span>
      </p>
      <MiniMap parks={parks} ids={f.parks} color={color} />

      {!compact && (
        <div style={{ margin: "10px 0" }}>
          <p className="small" style={{ fontWeight: 700, margin: "0 0 4px" }}>How its parks change, against the average park</p>
          {f.signature.map((s) => {
            const w = Math.min(50, Math.abs(s.z) * 22);
            return (
              <div key={s.variable + s.period} className="row small" style={{ gap: 6, alignItems: "center", margin: "3px 0" }}>
                <span style={{ width: 118, flex: "none", fontSize: 12 }}>{FEATURE_LABEL[`${s.variable}|${s.period}`] ?? s.variable}</span>
                <span style={{ position: "relative", flex: 1, height: 12, background: "var(--surface-2)", borderRadius: 5 }}>
                  <span style={{ position: "absolute", left: "50%", top: -2, width: 1, height: 16, background: "var(--text-faint)" }} />
                  <span
                    style={{
                      position: "absolute", top: 0, height: 12, borderRadius: 5, width: `${w}%`,
                      left: s.z >= 0 ? "50%" : `${50 - w}%`,
                      background: s.z >= 0 ? "var(--rust)" : "var(--sky)",
                    }}
                  />
                </span>
                <span style={{ width: 38, textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                  {s.sn > 0 ? "+" : ""}{s.sn.toFixed(1)}
                </span>
              </div>
            );
          })}
          <p className="micro muted" style={{ margin: "4px 0 0" }}>
            Bar to the right: changing faster than the average park. Left: slower. The number is the trend per decade divided by the
            year-to-year scatter.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
        {f.parks.map((id) => {
          const ag = fam.parks[id]?.agreement ?? 1;
          const typical = ag >= 0.8;
          const edge = ag < 0.6;
          return (
            <button
              key={id}
              className="chip"
              onClick={() => onOpenPark(id)}
              title={`${Math.round(ag * 100)}% agreement with its family${edge ? " (borderline member)" : typical ? " (typical member)" : ""}`}
              style={{
                background: typical ? `${color}22` : undefined,
                borderStyle: edge ? "dashed" : undefined,
                borderColor: edge ? "#b7791f" : typical ? color : undefined,
              }}
            >
              {nameOf(id)}
            </button>
          );
        })}
      </div>
      <p className="micro muted" style={{ margin: "6px 0 0" }}>Tinted chip: typical member. Dashed chip: borderline, it often lands in another family.</p>
    </div>
  );
}

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
  const titleOf = (n?: number) => fam.families.find((x) => x.id === n)?.title ?? `Family ${n}`;
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
          Almost every park is warming, so the family titles compare each group with the average park.
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
              : `${titleOf(fam.parks[id]?.family)}, ${Math.round((fam.parks[id]?.agreement ?? 0) * 100)}% agreement`}
          onPick={onOpenPark}
          selected={open ? fam.families.find((f) => f.id === open)?.parks ?? [] : []}
        />
      </div>

      {(() => {
        const main = fam.families.filter((f) => f.size > 3);
        const outliers = fam.families.filter((f) => f.size <= 3);
        const cardProps = { fam, parks: data.parks, nameOf, colorFor, onOpenPark, onHover: setOpen };
        return (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14, alignItems: "start" }}>
              {main.map((f) => <FamilyCard key={f.id} f={f} {...cardProps} />)}
            </div>
            {outliers.length > 0 && (
              <>
                <h3 style={{ margin: "6px 0 0" }}>Outliers</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  Families of three parks or fewer. They change unlike the rest, often because of an extreme region, so treat them as notes rather than groups.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, alignItems: "start" }}>
                  {outliers.map((f) => <FamilyCard key={f.id} f={f} compact {...cardProps} />)}
                </div>
              </>
            )}
          </>
        );
      })()}

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
                    <td>{titleOf(Number(f))} ({f})</td>
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
