// Park families: parks grouped by HOW they are changing, not by what they are like.
import { useState } from "react";
import type { Atlas } from "../detective/model";
import { FAMILY_COLORS, useInsights, type FamilyInfo, type Insights, type ParkMeta } from "./lib";
import MiniMap from "./MiniMap";
import { Source, StationStyle, Tip } from "./station";
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
    <div className="panel-stack st-page">
      <StationStyle />
      <div className="card">
        <h2 className="section-title">🧬 Parks that change together</h2>
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
          <h3 style={{ marginTop: 0 }}>Do families follow ecoregions?<Tip text="EPA Level I and III ecoregions at each park's centre point. EPA covers the lower 48 only. ARI (adjusted Rand index) measures agreement between two groupings: 0 = chance, 1 = identical." /></h3>
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
        <h3 style={{ marginTop: 0 }}>Where each park sits</h3>
        <p className="small">
          Across: how fast the park is warming. Up and down: whether its rain is increasing or decreasing. Both are the trend
          per decade divided by the park's year-to-year swing, so 0.5 means the change per decade is half a typical yearly
          swing. Shaded areas group each family. Click a dot to open that park.
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
          const L = 62, R = 744, T = 12, B = 290;
          const pts = data.parks.map((p) => ({ p, f: fam.parks[p.id] })).filter((d) => d.f);
          const xv = pts.map((d) => d.f.warming), yv = pts.map((d) => d.f.rain);
          const ext = (v: number[]) => {
            const lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo) * 0.08 || 0.1;
            return [lo - pad, hi + pad] as const;
          };
          const [xa, xb] = ext(xv), [ya, yb] = ext(yv);
          const px = (v: number) => L + ((v - xa) / (xb - xa)) * (R - L);
          const py = (v: number) => B - ((v - ya) / (yb - ya)) * (B - T);
          const ticks = (lo: number, hi: number) => {
            const raw = (hi - lo) / 5;
            const mag = Math.pow(10, Math.floor(Math.log10(raw)));
            const step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? raw;
            const out: number[] = [];
            for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.round(t / step) * step);
            return out;
          };
          const fmt = (v: number) => (Math.abs(v) < 1e-9 ? "0" : (v > 0 ? "+" : "") + v.toFixed(1));
          const halo: React.CSSProperties = { paintOrder: "stroke", stroke: "#fff", strokeWidth: 3, strokeLinejoin: "round" };
          const sizeOf = (id: number) => fam.families.find((x) => x.id === id)?.size ?? 99;

          const labels: { id: string; name: string; x: number; y: number; dotY: number; right: boolean }[] = [];
          pts
            .filter((d) => sizeOf(d.f.family) <= 3)
            .sort((u, v) => py(u.f.rain) - py(v.f.rain))
            .forEach((d) => {
              const cx = px(d.f.warming);
              let y = py(d.f.rain) + 4;
              const right = cx < 560;
              while (labels.some((q) => Math.abs(q.y - y) < 14 && Math.abs(q.x - cx) < 150)) y += 14;
              labels.push({ id: d.p.id, name: d.p.name, x: cx, y, dotY: py(d.f.rain), right });
            });

          const hull = (arr: [number, number][]): [number, number][] => {
            const p = [...arr].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            if (p.length < 3) return p;
            const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
            const half = (q: [number, number][]) => {
              const h: [number, number][] = [];
              for (const z of q) {
                while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], z) <= 0) h.pop();
                h.push(z);
              }
              h.pop();
              return h;
            };
            return [...half(p), ...half([...p].reverse())];
          };
          const hulls = fam.families.filter((f) => f.size > 3).map((f) => {
            const q = f.parks.map((id) => fam.parks[id]).filter(Boolean).map((z) => [px(z.warming), py(z.rain)] as [number, number]);
            const h = hull(q);
            return { f, d: h.map((z, i) => `${i ? "L" : "M"}${z[0].toFixed(1)} ${z[1].toFixed(1)}`).join("") + "Z",
              top: Math.min(...q.map((z) => z[1])), cx: q.reduce((a, z) => a + z[0], 0) / q.length };
          });
          const xt = ticks(xa, xb), yt = ticks(ya, yb);
          const axisInk = "var(--text-muted)";
          return (
            <svg viewBox="0 0 760 350" style={{ width: "100%", height: "auto" }} role="img" aria-label="Warming speed against rain trend for each park">
              <rect x={L} y={T} width={R - L} height={B - T} fill="var(--surface-2)" rx={4} />
              {xt.map((t) => (
                <g key={"x" + t}>
                  <line x1={px(t)} x2={px(t)} y1={T} y2={B} stroke={Math.abs(t) < 1e-9 ? axisInk : "var(--grid)"} strokeDasharray={Math.abs(t) < 1e-9 ? "" : "3 4"} />
                  <line x1={px(t)} x2={px(t)} y1={B} y2={B + 5} stroke={axisInk} />
                  <text x={px(t)} y={B + 18} fontSize={11} fill={axisInk} textAnchor="middle">{fmt(t)}</text>
                </g>
              ))}
              {yt.map((t) => (
                <g key={"y" + t}>
                  <line x1={L} x2={R} y1={py(t)} y2={py(t)} stroke={Math.abs(t) < 1e-9 ? axisInk : "var(--grid)"} strokeDasharray={Math.abs(t) < 1e-9 ? "" : "3 4"} />
                  <line x1={L - 5} x2={L} y1={py(t)} y2={py(t)} stroke={axisInk} />
                  <text x={L - 9} y={py(t) + 4} fontSize={11} fill={axisInk} textAnchor="end">{fmt(t)}</text>
                </g>
              ))}
              <line x1={L} x2={R} y1={B} y2={B} stroke={axisInk} strokeWidth={1.5} />
              <line x1={L} x2={L} y1={T} y2={B} stroke={axisInk} strokeWidth={1.5} />

              {hulls.map(({ f, d }) => (
                <path key={f.id} d={d} fill={colorFor(f.id)} fillOpacity={0.12} stroke={colorFor(f.id)} strokeOpacity={0.12}
                  strokeWidth={26} strokeLinejoin="round" />
              ))}
              {hulls.map(({ f, top, cx }) => (
                <text key={"t" + f.id} x={cx} y={Math.max(T + 14, top - 20)} fontSize={13} fontWeight={800} textAnchor="middle"
                  fill={colorFor(f.id)} style={{ ...halo, pointerEvents: "none" }}>{f.title}</text>
              ))}
              {labels.map((q) => (
                <line key={"l" + q.id} x1={q.x} y1={q.dotY} x2={q.right ? q.x + 10 : q.x - 10} y2={q.y - 4} stroke={axisInk} strokeWidth={0.8} />
              ))}
              {pts.map(({ p, f }) => {
                const big = sizeOf(f.family) <= 3;
                return (
                  <circle key={p.id} cx={px(f.warming)} cy={py(f.rain)} r={big ? 7 : 5} fill={colorFor(f.family)} fillOpacity={0.92}
                    stroke="#fff" strokeWidth={1.5} style={{ cursor: "pointer" }} onClick={() => onOpenPark(p.id)}>
                    <title>{`${p.name}: warming ${fmt(f.warming)}, rain ${fmt(f.rain)}`}</title>
                  </circle>
                );
              })}
              {labels.map((q) => (
                <text key={q.id} x={q.right ? q.x + 14 : q.x - 14} y={q.y} fontSize={11} fontWeight={700} fill="var(--text)"
                  textAnchor={q.right ? "start" : "end"} style={{ ...halo, pointerEvents: "none" }}>{q.name}</text>
              ))}

              <text x={(L + R) / 2} y={B + 40} fontSize={12} fontWeight={700} fill="var(--text)" textAnchor="middle">
                Warming speed (average of 6 temperature trends)
              </text>
              <text x={L} y={B + 40} fontSize={11} fill={axisInk} textAnchor="start">← slower</text>
              <text x={R} y={B + 40} fontSize={11} fill={axisInk} textAnchor="end">faster →</text>
              <text transform={`rotate(-90 14 ${(T + B) / 2})`} x={14} y={(T + B) / 2} fontSize={12} fontWeight={700} fill="var(--text)" textAnchor="middle">
                Rain trend (average of 3)
              </text>
              <text transform={`rotate(-90 14 ${B})`} x={14} y={B} fontSize={11} fill={axisInk} textAnchor="start">↓ drier</text>
              <text transform={`rotate(-90 14 ${T})`} x={14} y={T} fontSize={11} fill={axisInk} textAnchor="end">wetter ↑</text>
            </svg>
          );
        })()}
        <p className="micro muted" style={{ margin: "6px 0 0" }}>
          The dark line on each axis marks zero, no change. Dots right of the vertical line are warming. Dots below the horizontal
          line are getting drier.
        </p>
      </div>
      <Source atlas={atlas} extra="Families: average-linkage clustering of standardised signal-to-noise trends, re-run 300 times on resampled columns to test how often parks stay together." />
    </div>
  );
}
