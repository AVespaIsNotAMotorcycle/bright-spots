// Researcher Home pieces: station hero, anomaly of the week, tool tiles, mini map, leaderboard,
// saved views and the campfire preview.
import { useEffect, useMemo, useState } from "react";
import { PARK_NAMES } from "../detective/Detective";
import type { Atlas, AtlasCell } from "../detective/model";
import { PERIOD_LABEL, fmtQ } from "../detective/model";
import { anomalyOfWeek, findTwins, weekNumber } from "./insights";
import { slopeText, useInsights, usePark, varLabel } from "./lib";
import ParkMap from "./ParkMap";
import { E, StationStyle, Tag, Tip, VAR_TIP, coverageText, freshText, loadSaved, storeSaved, type SavedView } from "./station";
import { KIND, ago, fetchPosts, type Kind, type Post } from "./Community";

const pname = (id: string) => PARK_NAMES[id] ?? id;

/** Yearly values with Sen's slope through them. Stretches to the box; labels stay crisp in HTML. */
export function Sparkline({ years, values, color = E.rust, unit = "" }: { years: number[]; values: number[]; color?: string; unit?: string }) {
  if (values.length < 3) return null;
  const W = 600, H = 120;
  const x0 = years[0], x1 = years[years.length - 1];
  const lo = Math.min(...values), hi = Math.max(...values);
  const sx = (x: number) => ((x - x0) / (x1 - x0 || 1)) * W;
  const sy = (y: number) => H - 6 - ((y - lo) / (hi - lo || 1)) * (H - 12);
  const d = values.map((v, i) => `${i ? "L" : "M"}${sx(years[i]).toFixed(1)} ${sy(v).toFixed(1)}`).join("");
  // Sen's slope line through the median intercept, from the same numbers.
  const slopes: number[] = [];
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++) slopes.push((values[j] - values[i]) / (years[j] - years[i]));
  slopes.sort((a, b) => a - b);
  const m = slopes.length % 2 ? slopes[slopes.length >> 1] : (slopes[slopes.length / 2 - 1] + slopes[slopes.length / 2]) / 2;
  const ints = values.map((v, i) => v - m * years[i]).sort((a, b) => a - b);
  const b = ints[ints.length >> 1];
  const fmt = (v: number) => `${v.toFixed(1)}${unit}`;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 }}>
        <div className="micro" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", color: E.bark, textAlign: "right" }}>
          <span>{fmt(hi)}</span>
          <span>{fmt(lo)}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 120, display: "block" }} role="img"
          aria-label="Yearly values with the long-term trend">
          {[0.25, 0.5, 0.75].map((k) => <line key={k} x1={0} x2={W} y1={H * k} y2={H * k} stroke={E.sage} strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />)}
          <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeOpacity={0.85} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={sy(m * x0 + b)} x2={W} y2={sy(m * x1 + b)} stroke={E.bark} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="micro" style={{ display: "flex", justifyContent: "space-between", color: E.bark, marginLeft: 36 }}>
        <span>{x0}</span>
        <span style={{ color: E.moss }}>— yearly value · - - Sen's slope</span>
        <span>{x1}</span>
      </div>
    </div>
  );
}

type Go = (tab: string, extra?: Record<string, string>) => void;

export function StationHero({ name, atlas, onGo }: { name: string; atlas: Atlas | null; onGo: Go }) {
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
  const stat = (n: string, label: React.ReactNode, tab?: string) => (
    <button onClick={tab ? () => onGo(tab) : undefined} disabled={!tab}
      style={{ background: "rgba(247,241,227,.88)", border: `1px solid ${E.sage}`, borderRadius: 10, padding: "8px 12px", minWidth: 120,
        textAlign: "left", cursor: tab ? "pointer" : "default", color: E.bark }}
      className={tab ? "st-tile" : undefined}>
      <div className="st-num">{n}</div>
      <div className="micro">{label}{tab ? " →" : ""}</div>
    </button>
  );
  const fresh = freshText(atlas);
  return (
    <section className="st-card st-hero">
      <StationStyle />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <Tag>🔬 Field research station</Tag>
        {fresh && <span className="micro" style={{ color: E.moss }}>🛰️ NASA data up to {fresh}<Tip term="grid" /></span>}
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: E.pine, margin: "8px 0 2px" }}>
        {name ? `Welcome back, ${name}` : "Welcome to the station"}
      </h2>
      <p style={{ margin: "0 0 14px", color: E.bark }}>Every trend test, every park, ready for your questions.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {stat(t.parks.toString(), "parks", "atlas")}
        {stat(t.tests.toLocaleString(), "trend tests", "atlas")}
        {stat(t.real.toLocaleString(), <>confirmed (q &lt; 0.05)<Tip term="confirmed" /></>, "map")}
        {stat(t.possible.toLocaleString(), <>possible (p &lt; 0.05)<Tip term="possible" /></>, "map")}
        {stat(coverageText(atlas).replace(" to ", "–"), "NASA POWER record")}
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
  const [back, setBack] = useState(0); // 0 = this week, 1 = last week...
  const a = useMemo(() => anomalyOfWeek(atlas, weekNumber() - back), [atlas, back]);
  const park = usePark(a?.cell.park_id ?? null);
  if (!a) return null;
  const s = park.data?.series[a.variable]?.[a.period];
  const up = (a.cell.sen ?? 0) > 0;
  const per = PERIOD_LABEL[a.period] ?? a.period;
  const unit = atlas.variables[a.variable]?.unit ?? "";
  const when = back === 0 ? "This week" : back === 1 ? "Last week" : `${back} weeks ago`;
  const name = pname(a.cell.park_id);
  const arrow = (label: string, disabled: boolean, onClick: () => void) => (
    <button className="st-btn ghost" style={{ padding: "4px 10px" }} disabled={disabled} onClick={onClick} aria-label={label}>
      {label === "Older pick" ? "◀" : "▶"}
    </button>
  );
  return (
    <section className="st-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Tag>📌 Anomaly of the week</Tag>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {arrow("Older pick", back >= 11, () => setBack((b) => b + 1))}
          <span className="micro" style={{ color: E.bark, minWidth: 82, textAlign: "center" }}>{when}</span>
          {arrow("Newer pick", back === 0, () => setBack((b) => b - 1))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 10, alignItems: "center" }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", color: E.pine, margin: "0 0 4px", fontSize: 22 }}>{name}</h3>
          <div className="small" style={{ color: E.bark }}>
            {varLabel(atlas, a.variable)}<Tip term={VAR_TIP[a.variable]} /> · {per}
          </div>
          <div className="st-num" style={{ color: up ? E.rust : E.dusk, margin: "8px 0" }}>
            {up ? "▲" : "▼"} {slopeText(a.cell.sen, a.variable, atlas)}<Tip term="sen" />
          </div>
          <p className="small" style={{ margin: 0, color: E.bark }}>
            {a.against
              ? <><b>{a.crowd} of {a.confirmed}</b> parks with a confirmed trend here {up ? "fall" : "rise"}. {name} {up ? "rises" : "falls"}.</>
              : <>One of the strongest confirmed {up ? "rises" : "falls"} for this measure. {a.confirmed} parks have a confirmed trend here.</>}
            {" "}q {fmtQ(a.cell.q).startsWith("<") ? fmtQ(a.cell.q) : `= ${fmtQ(a.cell.q)}`}<Tip term="q" />
          </p>
        </div>
        <div style={{ background: "#fffdf7", border: `1px solid ${E.sage}`, borderRadius: 10, padding: 10 }}>
          {s ? (
            <Sparkline years={s.years} color={up ? E.rust : E.dusk}
              values={unit.startsWith("°") ? s.values.map((v) => v * 1.8 + 32) : s.values}
              unit={unit.startsWith("°") ? "°F" : ` ${unit}`} />
          )
            : <p className="small muted">Loading the yearly values…</p>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button className="st-btn" onClick={() => onRobust(a.cell.park_id, a.variable, a.period)}>🧪 Test if it holds up</button>
        <button className="st-btn ghost" onClick={() => onCompare(a.cell.park_id, a.variable, a.period)}>🥊 Head-to-head</button>
        <button className="st-btn ghost" onClick={() => onDiscuss(a.cell.park_id, a.variable, a.period)}>🔥 Discuss at the Campfire</button>
      </div>
      <p className="micro" style={{ margin: "8px 0 0", color: E.moss }}>An anomaly here is a statistical outlier, not a cause.</p>
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
    <div className="st-grid4">
      {tools.map((t) => (
        <button key={t.tab} className="st-tile" style={{ ["--tile" as string]: t.color }} onClick={() => onGo(t.tab)}>
          <span className="st-badge" aria-hidden="true">{t.icon}</span>
          <b style={{ fontFamily: "var(--font-display)", fontSize: 16, color: E.pine, display: "block" }}>{t.title}</b>
          <div className="small" style={{ marginTop: 4, color: E.bark }}>{t.text}</div>
        </button>
      ))}
    </div>
  );
}

/** Strongest confirmed yearly warming of the daily high, as bars. */
export function Leaderboard({ atlas, onOpen }: { atlas: Atlas; onOpen: (park: string) => void }) {
  const top = useMemo(
    () => (atlas.atlas["tmax_c"]?.["annual"] ?? [])
      .filter((c): c is AtlasCell & { sen: number } => c.verdict === "real" && c.sen != null && c.sen > 0)
      .sort((a, b) => b.sen - a.sen)
      .slice(0, 5),
    [atlas],
  );
  if (!top.length) return null;
  const max = top[0].sen;
  const medal = ["🥇", "🥈", "🥉", "4", "5"];
  return (
    <section className="st-card" style={{ padding: 18 }}>
      <Tag>🏔️ Fastest warming daytime highs</Tag>
      <p className="small" style={{ color: E.bark, margin: "8px 0 10px" }}>
        Yearly average daily high<Tip term="tmax" />, confirmed trends only. Bar = Sen's slope<Tip term="sen" />.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {top.map((c, i) => (
          <button key={c.park_id} onClick={() => onOpen(c.park_id)}
            style={{ display: "grid", gridTemplateColumns: "32px minmax(120px, 190px) 1fr auto", gap: 10, alignItems: "center",
              border: 0, background: "none", cursor: "pointer", padding: 0, color: E.bark, textAlign: "left" }}>
            <span style={{ fontSize: i < 3 ? 20 : 13, textAlign: "center", fontWeight: 700 }}>{medal[i]}</span>
            <b className="small" style={{ color: E.pine }}>{pname(c.park_id)}</b>
            <span style={{ height: 14, borderRadius: 7, background: E.sand, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${(c.sen / max) * 100}%`, borderRadius: 7,
                background: `linear-gradient(90deg, ${E.clay}, ${E.rust})` }} />
            </span>
            <span className="small" style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {slopeText(c.sen, "tmax_c", atlas)} · q {fmtQ(c.q).startsWith("<") ? fmtQ(c.q) : `= ${fmtQ(c.q)}`}
            </span>
          </button>
        ))}
      </div>
      <p className="micro" style={{ margin: "8px 0 0", color: E.moss }}>q<Tip term="q" /> is the many-parks-corrected p-value.</p>
    </section>
  );
}

/** Small topo map on Home: click a park to find its twins. */
export function MiniMap({ atlas, onTwins }: { atlas: Atlas; onTwins: (park: string) => void }) {
  const { data: ins } = useInsights();
  const cells = useMemo(() => new Map((atlas.atlas["tmax_c"]?.["annual"] ?? []).map((c) => [c.park_id, c])), [atlas]);
  const max = useMemo(() => Math.max(0.01, ...[...cells.values()].map((c) => Math.abs(c.sen ?? 0))), [cells]);
  if (!ins) return null;
  const color = (id: string) => {
    const c = cells.get(id);
    if (!c || c.sen == null || c.verdict !== "real") return E.sage;
    return c.sen > 0 ? E.rust : E.dusk;
  };
  const rings = (id: string) => {
    const c = cells.get(id);
    if (!c || c.verdict !== "real" || c.sen == null) return 0;
    const t = Math.abs(c.sen) / max;
    return t >= 0.75 ? 3 : t >= 0.5 ? 2 : 1;
  };
  return (
    <section className="st-card" style={{ padding: 18, overflow: "visible" }}>
      <Tag>🗺️ Pick a park, find its analog sites</Tag>
      <p className="small" style={{ color: E.bark, margin: "8px 0 10px" }}>
        Yearly daily high. Rust = confirmed rise, blue = confirmed fall, sage = no confirmed trend. Rings = stronger trend.
        Click a park, then "Open this park" to see its analog sites.
      </p>
      <ParkMap parks={ins.parks} colorOf={color} rings={rings}
        tip={(id) => { const c = cells.get(id); return c ? `${slopeText(c.sen, "tmax_c", atlas)}, q ${fmtQ(c.q)}` : "no data"; }}
        radius={(id) => (cells.get(id)?.verdict === "real" ? 7 : 5)} onPick={onTwins} />
    </section>
  );
}

export function SavedViews() {
  const [list, setList] = useState<SavedView[]>(loadSaved);
  if (!list.length) return null;
  const remove = (h: string) => {
    const next = list.filter((s) => s.hash !== h);
    storeSaved(next);
    setList(next);
  };
  return (
    <section className="st-card" style={{ padding: 16 }}>
      <Tag>★ Your saved views</Tag>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {list.map((s) => (
          <span key={s.hash} style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${E.sage}`, borderRadius: 20, background: E.cream }}>
            <a href={s.hash} style={{ padding: "6px 4px 6px 12px", color: E.pine, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
              {s.title}{s.detail ? <span style={{ color: E.bark, fontWeight: 400 }}> · {s.detail}</span> : null}
            </a>
            <button onClick={() => remove(s.hash)} aria-label={`Remove ${s.title}`}
              style={{ border: 0, background: "none", cursor: "pointer", color: E.bark, padding: "0 10px 0 6px", fontSize: 15 }}>×</button>
          </span>
        ))}
      </div>
    </section>
  );
}

interface Example {
  kind: Kind;
  text: string;
}

/** Starter notes written by the app from the data itself, shown only while the board is empty. */
export function exampleNotes(atlas: Atlas): Example[] {
  const out: Example[] = [];
  const a = anomalyOfWeek(atlas);
  if (a) {
    const up = (a.cell.sen ?? 0) > 0;
    out.push({
      kind: "question",
      text: a.against
        ? `${pname(a.cell.park_id)}: ${varLabel(atlas, a.variable).toLowerCase()} in ${PERIOD_LABEL[a.period] ?? a.period} ${up ? "rises" : "falls"} ${slopeText(a.cell.sen, a.variable, atlas)}, while ${a.crowd} of ${a.confirmed} confirmed parks go the other way. What could make it different?`
        : `${pname(a.cell.park_id)} has one of the strongest confirmed trends in ${varLabel(atlas, a.variable).toLowerCase()} (${PERIOD_LABEL[a.period] ?? a.period}): ${slopeText(a.cell.sen, a.variable, atlas)}. Does it hold for other start years?`,
    });
  }
  const t = findTwins(atlas, "zion").twins[0];
  if (t) out.push({
    kind: "hypothesis",
    text: `Zion's closest analog site is ${pname(t.park)} (similarity ${t.score.toFixed(2)}). Do their plant and animal records show the same changes? A good pair for a comparison study.`,
  });
  const top = (atlas.atlas["tmax_c"]?.["annual"] ?? []).filter((c) => c.verdict === "real" && (c.sen ?? 0) > 0)
    .sort((x, y) => (y.sen ?? 0) - (x.sen ?? 0))[0];
  if (top) out.push({
    kind: "insight",
    text: `${pname(top.park_id)} has the fastest confirmed rise in the yearly daily high: ${slopeText(top.sen, "tmax_c", atlas)} (q ${fmtQ(top.q)}).`,
  });
  return out;
}

export function CampfirePreview({ atlas, onOpen }: { atlas: Atlas | null; onOpen: () => void }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  useEffect(() => {
    fetchPosts({ sort: "top", limit: 3 }).then(setPosts).catch(() => setPosts([]));
  }, []);
  const examples = posts?.length === 0 && atlas ? exampleNotes(atlas) : [];
  return (
    <section className="st-card" style={{ padding: 18, background: `linear-gradient(160deg, #3b2d20, ${E.bark})`, color: E.cream, borderColor: E.bark }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>🔥 The Campfire</b>
        <button className="st-btn" style={{ background: E.clay, borderColor: E.clay }} onClick={onOpen}>Join the talk →</button>
      </div>
      <p className="small" style={{ margin: "4px 0 10px", color: E.sand }}>Researchers share notes, questions and hunches about the trends.</p>
      {posts === null && <p className="small" style={{ color: E.sand }}>Loading notes…</p>}
      {posts?.map((p) => (
        <div key={p.id} style={{ borderTop: "1px solid rgba(233,220,192,.2)", padding: "8px 0" }}>
          <div className="micro" style={{ color: E.sage }}>
            {KIND[p.kind].icon} {KIND[p.kind].label} · {p.author} · {ago(p.created)} · ▲ {p.votes}
          </div>
          <div className="small" style={{ marginTop: 2 }}>{p.text.length > 160 ? p.text.slice(0, 160) + "…" : p.text}</div>
        </div>
      ))}
      {examples.map((x, i) => (
        <div key={i} style={{ borderTop: "1px solid rgba(233,220,192,.2)", padding: "8px 0" }}>
          <div className="micro" style={{ color: E.sage }}>
            {KIND[x.kind].icon} {KIND[x.kind].label} · <i>Example, written by the app from the data</i>
          </div>
          <div className="small" style={{ marginTop: 2 }}>{x.text}</div>
        </div>
      ))}
    </section>
  );
}
