// Researcher Home pieces: station hero, anomaly of the week, tool tiles, campfire preview.
import { useEffect, useMemo, useState } from "react";
import { PARK_NAMES } from "../detective/Detective";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL } from "../detective/model";
import { anomalyOfWeek } from "./insights";
import { slopeText, usePark, varLabel } from "./lib";
import { E, Source, StationStyle, Tag } from "./station";
import { KIND, ago, fetchPosts, type Post } from "./Community";

const pname = (id: string) => PARK_NAMES[id] ?? id;

/** Small line of the yearly values with Sen's slope drawn through the middle. */
export function Sparkline({ years, values, color = E.rust }: { years: number[]; values: number[]; color?: string }) {
  if (values.length < 3) return null;
  const W = 300, H = 90, pad = 6;
  const x0 = years[0], x1 = years[years.length - 1];
  const lo = Math.min(...values), hi = Math.max(...values);
  const sx = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const d = values.map((v, i) => `${i ? "L" : "M"}${sx(years[i]).toFixed(1)} ${sy(v).toFixed(1)}`).join("");
  // Sen's slope line through the median point, from the same numbers.
  const slopes: number[] = [];
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++) slopes.push((values[j] - values[i]) / (years[j] - years[i]));
  slopes.sort((a, b) => a - b);
  const m = slopes[slopes.length >> 1];
  const med = (a: number[]) => [...a].sort((p, q) => p - q)[a.length >> 1];
  const b = med(values.map((v, i) => v - m * years[i]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 90, display: "block" }} role="img" aria-label="Yearly values">
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeOpacity={0.8} />
      <line x1={sx(x0)} y1={sy(m * x0 + b)} x2={sx(x1)} y2={sy(m * x1 + b)} stroke={E.bark} strokeWidth={2} strokeDasharray="5 4" />
      <text x={pad} y={H - 1} fontSize={10} fill={E.bark}>{x0}</text>
      <text x={W - pad} y={H - 1} fontSize={10} fill={E.bark} textAnchor="end">{x1}</text>
    </svg>
  );
}

export function StationHero({ name, atlas }: { name: string; atlas: Atlas | null }) {
  const t = useMemo(() => {
    let tests = 0, real = 0, possible = 0;
    const parks = new Set<string>();
    for (const byPeriod of Object.values(atlas?.atlas ?? {}))
      for (const cells of Object.values(byPeriod))
        for (const c of cells) {
          tests++;
          parks.add(c.park_id);
          if (c.verdict === "real") real++;
          else if (c.verdict === "possible") possible++;
        }
    return { tests, real, possible, parks: parks.size };
  }, [atlas]);
  const stat = (n: string, label: string) => (
    <div style={{ background: "rgba(247,241,227,.85)", border: `1px solid ${E.sage}`, borderRadius: 10, padding: "8px 12px", minWidth: 110 }}>
      <div className="st-num">{n}</div>
      <div className="micro" style={{ color: E.bark }}>{label}</div>
    </div>
  );
  return (
    <section className="st-card st-hero">
      <StationStyle />
      <Tag>🔬 Field research station</Tag>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: E.pine, margin: "8px 0 2px" }}>
        {name ? `Welcome back, ${name}` : "Welcome to the station"}
      </h2>
      <p style={{ margin: "0 0 14px", color: E.bark }}>Every trend test, every park, ready for your questions.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {stat(t.parks.toString(), "parks")}
        {stat(t.tests.toLocaleString(), "trend tests")}
        {stat(t.real.toLocaleString(), "confirmed (q < 0.05)")}
        {stat(t.possible.toLocaleString(), "possible (p < 0.05)")}
        {stat("1981–2025", "years of NASA data")}
      </div>
    </section>
  );
}

export function AnomalyOfWeek({
  atlas, onRobust, onCompare, onDiscuss,
}: {
  atlas: Atlas;
  onRobust: (park: string, v: string, per: string) => void;
  onCompare: (park: string, v: string, per: string) => void;
  onDiscuss: (park: string, v: string, per: string) => void;
}) {
  const a = useMemo(() => anomalyOfWeek(atlas), [atlas]);
  const park = usePark(a?.cell.park_id ?? null);
  if (!a) return null;
  const s = park.data?.series[a.variable]?.[a.period];
  const up = (a.cell.sen ?? 0) > 0;
  const per = PERIOD_LABEL[a.period] ?? a.period;
  return (
    <section className="st-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <Tag>📌 Anomaly of the week</Tag>
        <span className="micro" style={{ color: E.moss }}>new pick every Monday</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(240px, 1.2fr)", gap: 16, marginTop: 10, alignItems: "center" }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", color: E.pine, margin: "0 0 4px", fontSize: 22 }}>{pname(a.cell.park_id)}</h3>
          <div className="small" style={{ color: E.bark }}>{varLabel(atlas, a.variable)} · {per}</div>
          <div className="st-num" style={{ color: up ? E.rust : E.dusk, margin: "8px 0" }}>
            {up ? "▲" : "▼"} {slopeText(a.cell.sen, a.variable, atlas)}
          </div>
          <p className="small" style={{ margin: 0, color: E.bark }}>
            {a.against
              ? <>Confirmed trend going the other way to <b>{a.crowd} of {a.confirmed}</b> parks with a confirmed trend here.</>
              : <>One of the strongest confirmed trends for this measure (of {a.confirmed} confirmed parks).</>}
            {a.cell.q != null && <> q = {a.cell.q.toFixed(4)}.</>}
          </p>
        </div>
        <div style={{ background: "#fffdf7", border: `1px solid ${E.sage}`, borderRadius: 10, padding: 8 }}>
          {s ? <Sparkline years={s.years} values={s.values} color={up ? E.rust : E.dusk} /> : <p className="small muted">Loading the yearly values…</p>}
          <div className="micro" style={{ color: E.moss }}>— yearly value · - - Sen's slope</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button className="st-btn" onClick={() => onRobust(a.cell.park_id, a.variable, a.period)}>🧪 Test if it holds up</button>
        <button className="st-btn ghost" onClick={() => onCompare(a.cell.park_id, a.variable, a.period)}>⚖ Head-to-head</button>
        <button className="st-btn ghost" onClick={() => onDiscuss(a.cell.park_id, a.variable, a.period)}>🔥 Discuss at the Campfire</button>
      </div>
      <Source extra="An anomaly here is a statistical outlier, not a cause." />
    </section>
  );
}

export interface ToolInfo {
  tab: string;
  icon: string;
  title: string;
  text: string;
  color: string;
}

export function ToolTiles({ tools, onGo }: { tools: ToolInfo[]; onGo: (tab: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
      {tools.map((t) => (
        <button key={t.tab} className="st-tile" style={{ ["--tile" as string]: t.color }} onClick={() => onGo(t.tab)}>
          <span className="st-ico">{t.icon}</span>
          <b style={{ fontFamily: "var(--font-display)", fontSize: 16, color: E.pine }}>{t.title}</b>
          <div className="small" style={{ marginTop: 4, color: E.bark }}>{t.text}</div>
        </button>
      ))}
    </div>
  );
}

export function CampfirePreview({ onOpen }: { onOpen: () => void }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  useEffect(() => {
    fetchPosts({ sort: "top", limit: 3 }).then(setPosts).catch(() => setPosts([]));
  }, []);
  return (
    <section className="st-card" style={{ padding: 18, background: `linear-gradient(160deg, #3b2d20, ${E.bark})`, color: E.cream, borderColor: E.bark }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>🔥 The Campfire</b>
        <button className="st-btn" style={{ background: E.clay, borderColor: E.clay }} onClick={onOpen}>Join the talk →</button>
      </div>
      <p className="small" style={{ margin: "4px 0 10px", color: E.sand }}>Researchers share notes, questions and hunches about the trends.</p>
      {posts === null && <p className="small" style={{ color: E.sand }}>Loading notes…</p>}
      {posts?.length === 0 && <p className="small" style={{ color: E.sand }}>No notes yet. Be the first to share one.</p>}
      {posts?.map((p) => (
        <div key={p.id} style={{ borderTop: "1px solid rgba(233,220,192,.2)", padding: "8px 0" }}>
          <div className="micro" style={{ color: E.sage }}>
            {KIND[p.kind].icon} {KIND[p.kind].label} · {p.author} · {ago(p.created)} · ▲ {p.votes}
          </div>
          <div className="small" style={{ marginTop: 2 }}>{p.text.length > 160 ? p.text.slice(0, 160) + "…" : p.text}</div>
        </div>
      ))}
    </section>
  );
}
