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
}

function FamilyCard({ f, fam, parks, nameOf, colorFor, onOpenPark, onHover }: CardProps) {
  const color = colorFor(f.id);
  const outlier = f.size <= 3;
  const clamp2: React.CSSProperties = {
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
  };
  const tag: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 12, whiteSpace: "nowrap" };
  return (
    <div
      className="card"
      style={{ borderTop: `4px solid ${color}`, display: "flex", flexDirection: "column", gap: 8 }}
      onMouseEnter={() => onHover(f.id)}
      onMouseLeave={() => onHover(null)}
    >
      <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, minHeight: 28 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: color, flex: "none" }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.title}>{f.title}</span>
      </h3>
      <p className="micro muted" style={{ margin: 0, minHeight: 32, ...clamp2 }} title={f.name}>{f.name}</p>

      <div className="row" style={{ gap: 6, flexWrap: "wrap", minHeight: 24 }}>
        <span
          title={`Parks stayed together in ${Math.round(f.stability * 100)}% of ${fam.bootstraps} re-runs. Stable is ${Math.round(fam.stable_at * 100)}% or more.`}
          style={{ ...tag, cursor: "help", background: f.stable ? "rgba(45,90,39,.14)" : "rgba(183,121,31,.16)", color: f.stable ? "var(--pine)" : "#8a5a10" }}
        >
          {f.stable ? "Stable" : "Loose"} · {Math.round(f.stability * 100)}%
        </span>
        <span style={{ ...tag, background: "var(--surface-2)", color: "var(--text)" }}>{f.size} park{f.size === 1 ? "" : "s"}</span>
        {outlier && <span style={{ ...tag, background: "rgba(139,58,26,.12)", color: "var(--rust)" }}>Outlier</span>}
      </div>

      <MiniMap parks={parks} ids={f.parks} color={color} />

      <div>
        <p className="small" style={{ fontWeight: 700, margin: "2px 0 4px" }}>Change against the average park</p>
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
              <span style={{ width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                {s.sn > 0 ? "+" : ""}{s.sn.toFixed(1)}
              </span>
            </div>
          );
        })}
        <p className="micro muted" style={{ margin: "4px 0 0" }}>Right of the line: faster than average. Left: slower.</p>
      </div>

      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, height: 118, overflowY: "auto", alignContent: "flex-start", paddingRight: 2 }}>
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
                  fontSize: 12, padding: "3px 9px", flex: "none",
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
        <p className="micro muted" style={{ margin: "4px 0 0" }}>Tinted: typical member. Dashed: borderline.</p>
      </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14, alignItems: "stretch" }}>
        {fam.families.map((f) => (
          <FamilyCard key={f.id} f={f} fam={fam} parks={data.parks} nameOf={nameOf} colorFor={colorFor}
            onOpenPark={onOpenPark} onHover={setOpen} />
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Families marked "Outlier" hold three parks or fewer. They change unlike the rest, often because of an extreme region,
        so read them as notes rather than groups.
      </p>

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
        <h3 style={{ marginTop: 0 }}>Fingerprint map</h3>
        <p className="small">
          Every park has 10 trend numbers. This picture squeezes them into two, keeping as much of the difference between
          parks as possible. Parks that sit close together change in similar ways. The two axes are described under and
          beside the plot.
        </p>
        <div className="row small" style={{ gap: 14, flexWrap: "wrap", margin: "6px 0" }}>
          {fam.families.map((f) => (
            <span key={f.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: colorFor(f.id) }} />
              {f.title} ({f.size}){f.size <= 3 ? ", outlier" : ""}
            </span>
          ))}
        </div>
        {(() => {
          const L = 64, R = 740, T = 14, B = 340;
          const px = (v: number) => L + 16 + ((v - x0) / (x1 - x0 || 1)) * (R - L - 32);
          const py = (v: number) => B - 16 - ((v - y0) / (y1 - y0 || 1)) * (B - T - 32);
          const [ax, ay] = fam.axes ?? [];
          const centroids = fam.families.filter((f) => f.size > 3).map((f) => {
            const m = f.parks.map((id) => fam.parks[id]).filter(Boolean);
            return { f, x: px(m.reduce((a, p) => a + p.x, 0) / m.length), y: py(m.reduce((a, p) => a + p.y, 0) / m.length) };
          });
          const halo: React.CSSProperties = { paintOrder: "stroke", stroke: "#fff", strokeWidth: 3, strokeLinejoin: "round" };
          return (
            <svg viewBox="0 0 760 420" style={{ width: "100%", height: "auto" }} role="img" aria-label="Park fingerprint map">
              <rect x={L} y={T} width={R - L} height={B - T} fill="var(--surface-2)" rx={8} />
              {[0.25, 0.5, 0.75].map((t) => (
                <g key={t} stroke="var(--grid)" strokeDasharray="3 4">
                  <line x1={L + t * (R - L)} x2={L + t * (R - L)} y1={T} y2={B} />
                  <line x1={L} x2={R} y1={T + t * (B - T)} y2={T + t * (B - T)} />
                </g>
              ))}
              {data.parks.map((p) => {
                const f = fam.parks[p.id];
                if (!f) return null;
                const cx = px(f.x), cy = py(f.y);
                const size = fam.families.find((x) => x.id === f.family)?.size ?? 99;
                return (
                  <g key={p.id} style={{ cursor: "pointer" }} onClick={() => onOpenPark(p.id)}>
                    <circle cx={cx} cy={cy} r={size <= 3 ? 8 : 6} fill={colorFor(f.family)} stroke="#fff" strokeWidth={1.5}>
                      <title>{p.name}</title>
                    </circle>
                    {size <= 3 && (
                      <text x={cx > 560 ? cx - 12 : cx + 12} y={cy + 4} fontSize={12} fontWeight={700} fill="var(--text)"
                        textAnchor={cx > 560 ? "end" : "start"} style={halo}>{p.name}</text>
                    )}
                  </g>
                );
              })}
              {centroids.map(({ f, x, y }) => (
                <text key={f.id} x={x} y={y - 16} fontSize={13} fontWeight={800} textAnchor="middle" fill={colorFor(f.id)} style={halo}>
                  {f.title}
                </text>
              ))}
              {ax && (
                <>
                  <text x={L} y={B + 22} fontSize={12} fill="var(--text)" textAnchor="start">← {ax.low}</text>
                  <text x={R} y={B + 22} fontSize={12} fill="var(--text)" textAnchor="end">{ax.high} →</text>
                  <text x={(L + R) / 2} y={B + 42} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
                    Left to right: {Math.round(ax.variance * 100)}% of the differences between parks
                  </text>
                </>
              )}
              {ay && (
                <>
                  <text transform={`rotate(-90 20 ${B})`} x={20} y={B} fontSize={12} fill="var(--text)" textAnchor="start">← {ay.low}</text>
                  <text transform={`rotate(-90 20 ${T})`} x={20} y={T} fontSize={12} fill="var(--text)" textAnchor="end">{ay.high} →</text>
                  <text transform={`rotate(-90 40 ${(T + B) / 2})`} x={40} y={(T + B) / 2} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
                    Bottom to top: {Math.round(ay.variance * 100)}%
                  </text>
                </>
              )}
            </svg>
          );
        })()}
        <p className="micro muted" style={{ margin: "6px 0 0" }}>
          Click a dot to open that park. Overlap between colours means those parks are borderline between families. Distances
          are approximate, because 10 numbers cannot be shown faithfully in 2.
        </p>
      </div>
    </div>
  );
}
