// Park Explorer for explorers: start from a question, see the top 3, a plot twist,
// a map and a ranked list. Every number comes from the NASA POWER trend atlas.
import { useMemo, useState } from "react";
import type { Atlas, AtlasCell } from "./model";
import { PARK_NAMES } from "./parkNames";
import { photoOf } from "./photos";
import ParkMap from "../research/ParkMap";
import { useInsights } from "../research/lib";
import { E, RIDGE, TOPO } from "./theme";
import { WIDGET_CSS } from "./StudentWidgets";
import { play } from "./sound";

interface Question {
  id: string;
  emoji: string;
  ask: string;
  variable: string;
  period: string;
  /** Which way is the "headline" direction: up (hotter, more days) or both (rain). */
  dir: "up" | "both";
  noun: string;
}

const QUESTIONS: Question[] = [
  { id: "days", emoji: "☀️", ask: "Where are days getting hotter?", variable: "tmax_c", period: "annual", dir: "up", noun: "daytime high" },
  { id: "nights", emoji: "🌙", ask: "Where are nights warming fastest?", variable: "tmin_c", period: "annual", dir: "up", noun: "night-time low" },
  { id: "summer", emoji: "🔥", ask: "Where are summers heating up?", variable: "tmax_c", period: "JJA", dir: "up", noun: "summer daytime high" },
  { id: "winter", emoji: "❄️", ask: "Where are winters getting milder?", variable: "tmin_c", period: "DJF", dir: "up", noun: "winter night-time low" },
  { id: "hot", emoji: "🥵", ask: "Where are 90°F days piling up?", variable: "hot90_days", period: "annual", dir: "up", noun: "days above 90°F" },
  { id: "rain", emoji: "🌧️", ask: "Where is rain changing most?", variable: "prcp_mm", period: "annual", dir: "both", noun: "yearly rain and snow" },
];

const PILL: Record<string, { t: string; bg: string; c: string }> = {
  real: { t: "Confirmed trend", bg: "#dfe8cf", c: E.pine },
  possible: { t: "Possible trend", bg: "#f3e2c0", c: "#7a5a1c" },
  none: { t: "No clear trend", bg: "#e7e0d0", c: E.bark },
  short: { t: "Too little data", bg: "#e7e0d0", c: E.bark },
  flat: { t: "No change", bg: "#e7e0d0", c: E.bark },
};

const name = (id: string) => PARK_NAMES[id] ?? id;

/** Small round park photo. */
function Thumb({ id, size }: { id: string; size: number }) {
  const p = photoOf(id);
  if (!p) return <span style={{ width: size, display: "inline-block", textAlign: "center" }}>🏞️</span>;
  return (
    <img src={p.file} alt="" loading="lazy" title={`Photo: ${p.credit} (${p.license}), Wikimedia Commons`}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", verticalAlign: "middle", flexShrink: 0,
        border: `2px solid ${E.cream}`, boxShadow: "0 1px 3px rgba(38,30,20,.25)" }} />
  );
}

function Pill({ v }: { v: string }) {
  const p = PILL[v] ?? PILL.none;
  return (
    <span style={{ background: p.bg, color: p.c, borderRadius: 999, padding: "3px 10px", fontWeight: 700, fontSize: 11.5, whiteSpace: "nowrap" }}>
      {p.t}
    </span>
  );
}

export default function ExplorerHome({ atlas, onOpen }: { atlas: Atlas; onOpen: (parkId: string) => void }) {
  const [qid, setQid] = useState("days");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const { data: ins } = useInsights();
  const q = QUESTIONS.find((x) => x.id === qid)!;
  const span = atlas.coverage ? atlas.coverage.last_full_year - atlas.coverage.first_year : 44;
  const first = atlas.coverage?.first_year ?? 1981;
  const isTemp = (atlas.variables[q.variable]?.unit ?? "").includes("°");

  /** Change per 10 years, in the unit people read. */
  const per10 = (sen: number) => (isTemp ? sen * 1.8 : sen);
  const fmt = (x: number, digits = isTemp ? 2 : 1) => {
    const unit = isTemp ? "°F" : q.variable === "prcp_mm" ? " mm" : " days";
    return `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(digits)}${unit}`;
  };

  const cells = useMemo(
    () => (atlas.atlas[q.variable]?.[q.period] ?? []).filter((c): c is AtlasCell & { sen: number } => c.sen != null),
    [atlas, q],
  );
  const confirmed = cells.filter((c) => c.verdict === "real");
  const score = (c: { sen: number }) => (q.dir === "up" ? c.sen : Math.abs(c.sen));
  const top3 = [...confirmed].filter((c) => q.dir === "both" || c.sen > 0).sort((a, b) => score(b) - score(a)).slice(0, 3);
  // Plot twist: the strongest confirmed change the other way; else the park that barely changed.
  const twist = useMemo(() => {
    if (q.dir === "up") {
      const other = confirmed.filter((c) => c.sen < 0).sort((a, b) => a.sen - b.sen)[0];
      if (other) return { cell: other, kind: "opposite" as const };
    } else {
      const ups = confirmed.filter((c) => c.sen > 0).length;
      const downs = confirmed.length - ups;
      const minority = confirmed.filter((c) => (ups >= downs ? c.sen < 0 : c.sen > 0)).sort((a, b) => Math.abs(b.sen) - Math.abs(a.sen))[0];
      if (minority) return { cell: minority, kind: "opposite" as const };
    }
    const still = [...cells].filter((c) => c.verdict === "none").sort((a, b) => Math.abs(a.sen) - Math.abs(b.sen))[0];
    return still ? { cell: still, kind: "still" as const } : null;
  }, [cells, confirmed, q.dir]);

  // Every park, including ones with too little data (shown last, with no bar).
  const ranked = useMemo(() => {
    const order: Record<string, number> = { real: 0, possible: 1, none: 2, short: 3, flat: 4 };
    const all = atlas.atlas[q.variable]?.[q.period] ?? [];
    const sc = (c: AtlasCell) => (c.sen == null ? -Infinity : q.dir === "up" ? c.sen : Math.abs(c.sen));
    return [...all].sort((a, b) => (order[a.verdict] ?? 9) - (order[b.verdict] ?? 9) || sc(b) - sc(a));
  }, [atlas, q]);
  const maxAbs = Math.max(0.0001, ...cells.map((c) => Math.abs(c.sen)));
  const matches = search.trim()
    ? Object.entries(PARK_NAMES).filter(([, n]) => n.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 6)
    : [];

  const surprise = () => {
    const ids = Object.keys(PARK_NAMES);
    play("flip");
    onOpen(ids[Math.floor(Math.random() * ids.length)]);
  };
  const cellOf = useMemo(() => new Map(cells.map((c) => [c.park_id, c])), [cells]);
  const color = (id: string) => {
    const c = cellOf.get(id);
    if (!c || c.verdict !== "real") return E.sage;
    return c.sen > 0 ? E.rust : E.dusk;
  };
  const medals = ["🥇", "🥈", "🥉"];
  const list = showAll ? ranked : ranked.slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{WIDGET_CSS}</style>

      {/* Hero: search + surprise */}
      <section style={{ borderRadius: 22, overflow: "hidden", border: `2px solid ${E.sage}`,
        background: `${RIDGE} bottom / 100% 70px no-repeat, linear-gradient(180deg, #f0c98f 0%, #d9a066 45%, #8a9a5b 100%)`,
        padding: "24px 24px 64px", position: "relative" }}>
        <span aria-hidden className="sw-sway" style={{ position: "absolute", right: 24, top: 18, fontSize: 40 }}>🧭</span>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: E.bark }}>Park Explorer</div>
        <h2 style={{ margin: "6px 0 4px", fontFamily: "var(--font-display)", fontSize: 32, color: E.bark }}>
          {(atlas.atlas["tmax_c"]?.["annual"] ?? []).length} parks. {span + 1} years of NASA data. What will you find?
        </h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, position: "relative", maxWidth: 560 }}>
          <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔎 Find your park…"
              aria-label="Find a park"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 14, border: `2px solid ${E.bark}33`, background: E.cream,
                fontSize: 15, color: E.bark, boxSizing: "border-box" }} />
            {matches.length > 0 && (
              <div style={{ position: "absolute", zIndex: 20, top: "calc(100% + 4px)", left: 0, right: 0, background: E.cream,
                border: `1px solid ${E.sage}`, borderRadius: 12, boxShadow: "0 10px 24px rgba(38,30,20,.2)", overflow: "hidden" }}>
                {matches.map(([id, n]) => (
                  <button key={id} onClick={() => onOpen(id)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", border: 0, background: "none",
                      cursor: "pointer", color: E.bark, fontSize: 14 }}>
                    <Thumb id={id} size={26} /> {n}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="sw-pick" onClick={surprise}
            style={{ padding: "11px 16px", borderRadius: 14, border: `2px solid ${E.pine}`, background: E.pine, color: E.cream,
              fontWeight: 800, cursor: "pointer", fontSize: 15 }}>
            🎲 Surprise me
          </button>
        </div>
      </section>

      {/* Questions */}
      <section>
        <div style={{ fontWeight: 800, fontSize: 18, color: E.bark, marginBottom: 10 }}>Pick a question</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          {QUESTIONS.map((x) => {
            const on = x.id === qid;
            return (
              <button key={x.id} className="sw-pick" onClick={() => { setQid(x.id); setShowAll(false); play("flip"); }}
                aria-pressed={on}
                style={{ textAlign: "left", padding: "14px 14px", borderRadius: 16, cursor: "pointer",
                  border: `2px solid ${on ? E.pine : E.sage}`, background: on ? "#e6edd6" : E.cream, color: E.bark }}>
                <div style={{ fontSize: 28 }}>{x.emoji}</div>
                <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 4 }}>{x.ask}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Answer */}
      <section className="sw-reveal" key={qid}
        style={{ borderRadius: 22, border: `2px solid ${E.sage}`, background: `${TOPO} right -70px top -70px / 300px no-repeat, ${E.cream}`, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, color: E.pine }}>{q.emoji} {q.ask}</h3>
          <span style={{ color: E.bark, fontSize: 14 }}>
            <b style={{ color: E.pine, fontSize: 18 }}>{confirmed.length}</b> of {cells.length} parks have a confirmed change
          </span>
        </div>

        {/* Podium */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
          {top3.map((c, i) => (
            <button key={c.park_id} className="sw-pick" onClick={() => onOpen(c.park_id)}
              style={{ textAlign: "left", cursor: "pointer", borderRadius: 18, padding: 16, color: E.bark, overflow: "hidden",
                border: `2px solid ${i === 0 ? E.clay : E.sage}`,
                background: i === 0 ? "linear-gradient(150deg,#f6e3c4,#e9c79a)" : "linear-gradient(150deg,#f3ecd9,#e6dcc4)" }}>
              {photoOf(c.park_id) && (
                <div aria-hidden style={{ margin: "-16px -16px 10px", height: 110, position: "relative",
                  background: `url("${photoOf(c.park_id)!.file}") center / cover no-repeat` }}
                  title={`Photo: ${photoOf(c.park_id)!.credit} (${photoOf(c.park_id)!.license}), Wikimedia Commons`}>
                  <span style={{ position: "absolute", left: 10, bottom: -14, fontSize: 30 }}>{medals[i]}</span>
                </div>
              )}
              {!photoOf(c.park_id) && <div style={{ fontSize: 30 }}>{medals[i]}</div>}
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19 }}>{name(c.park_id)}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 28, color: c.sen > 0 ? E.rust : E.dusk, lineHeight: 1.1, marginTop: 4 }}>
                {fmt(per10(c.sen))}
              </div>
              <div style={{ fontSize: 12, color: E.moss, fontWeight: 700 }}>every 10 years</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                About <b>{fmt(per10(c.sen) * span / 10, isTemp ? 1 : 0)}</b> since {first}.
              </div>
            </button>
          ))}
        </div>

        {/* Plot twist */}
        {twist && (
          <button onClick={() => onOpen(twist.cell.park_id)} className="sw-pick"
            style={{ display: "flex", gap: 14, alignItems: "center", width: "100%", textAlign: "left", marginTop: 14, cursor: "pointer",
              borderRadius: 16, padding: "12px 16px", border: `2px dashed ${E.dusk}`, background: "#e9eef0", color: E.bark }}>
            <span style={{ position: "relative", flexShrink: 0 }}>
              <Thumb id={twist.cell.park_id} size={52} />
              <span style={{ position: "absolute", right: -6, bottom: -6, fontSize: 20 }}>🌀</span>
            </span>
            <span style={{ flex: 1 }}>
              <b style={{ color: E.dusk }}>Plot twist: </b>
              {twist.kind === "opposite"
                ? <>{name(twist.cell.park_id)}'s {q.noun} goes the other way: <b>{fmt(per10(twist.cell.sen))}</b> every 10 years, and it's a confirmed trend.</>
                : <>{name(twist.cell.park_id)}'s {q.noun} has barely moved since {first}. No clear trend.</>}
              {" "}How come? Tap to investigate.
            </span>
            <Pill v={twist.cell.verdict} />
          </button>
        )}

        {/* Map */}
        {ins && (
          <div style={{ marginTop: 16 }}>
            <ParkMap parks={ins.parks} colorOf={color} onPick={onOpen}
              tip={(id) => { const c = cellOf.get(id); return c ? `${fmt(per10(c.sen))} every 10 years · ${(PILL[c.verdict] ?? PILL.none).t}` : "no data"; }}
              radius={(id) => (cellOf.get(id)?.verdict === "real" ? 7 : 5)} />
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: E.bark, marginTop: 6 }}>
              <span><span style={{ color: E.rust }}>●</span> confirmed rise</span>
              <span><span style={{ color: E.dusk }}>●</span> confirmed fall</span>
              <span><span style={{ color: E.sage }}>●</span> no confirmed change</span>
              <span style={{ color: E.moss }}>Tap a park to open it.</span>
            </div>
          </div>
        )}

        {/* Ranked list */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, color: E.bark, marginBottom: 8 }}>Every park, ranked</div>
          <div style={{ display: "grid", gap: 6 }}>
            {list.map((c, i) => (
              <button key={c.park_id} onClick={() => onOpen(c.park_id)}
                style={{ display: "grid", gridTemplateColumns: "26px minmax(140px, 230px) 1fr auto", gap: 10, alignItems: "center",
                  border: 0, background: "none", padding: "3px 0", cursor: "pointer", color: E.bark, textAlign: "left" }}
                className="ph-lead">
                <span style={{ fontSize: 12, color: E.moss, textAlign: "right" }}>{i + 1}</span>
                <b style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
                  <Thumb id={c.park_id} size={26} />
                  {name(c.park_id)}
                </b>
                <span style={{ height: 12, borderRadius: 6, background: E.sand, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${(Math.abs(c.sen ?? 0) / maxAbs) * 100}%`, borderRadius: 6,
                    background: c.verdict !== "real" || c.sen == null ? E.sage : c.sen > 0 ? `linear-gradient(90deg, ${E.clay}, ${E.rust})` : `linear-gradient(90deg, #8fb0c4, ${E.dusk})` }} />
                </span>
                <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, whiteSpace: "nowrap" }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.sen == null ? "–" : fmt(per10(c.sen))}</span>
                  <Pill v={c.verdict} />
                </span>
              </button>
            ))}
          </div>
          {ranked.length > 10 && (
            <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show top 10" : `Show all ${ranked.length} parks`}
            </button>
          )}
          <p style={{ fontSize: 12, color: E.moss, margin: "10px 0 0" }}>
            Change per 10 years, NASA POWER data since {first}. "Confirmed" means the test says it is very unlikely to be luck.
          </p>
        </div>
      </section>
    </div>
  );
}
