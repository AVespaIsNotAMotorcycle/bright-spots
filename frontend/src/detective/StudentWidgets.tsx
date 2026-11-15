// Student Home pieces: rank banner, next case, park of the day, sound switch.
import { useState } from "react";
import type { Atlas } from "./model";
import { CASES } from "./cases";
import type { Case } from "./cases";
import { bestAnswerStreak, dayStreak, loadProgress, parkName, rankTitle, useTrends } from "./games";
import { setSound, soundOn, play } from "./sound";
import { themeFor } from "./cardTheme";
import TrendChart from "./TrendChart";

export function SoundToggle() {
  const [on, setOn] = useState(soundOn());
  return (
    <button
      onClick={() => {
        setSound(!on);
        setOn(!on);
        if (!on) play("right");
      }}
      aria-pressed={on}
      title={on ? "Sound on" : "Sound off"}
      style={{ background: "none", border: "1px solid var(--border)", borderRadius: 999, padding: "4px 10px", cursor: "pointer", fontSize: 14 }}
    >
      {on ? "🔊" : "🔇"}
    </button>
  );
}

export function RankBanner() {
  const progress = loadProgress();
  const totalStars = CASES.reduce((n, c) => n + (progress[c.id]?.stars ?? 0), 0);
  const solved = CASES.filter((c) => progress[c.id]).length;
  const rank = rankTitle(totalStars);
  const days = dayStreak();
  const best = bestAnswerStreak();
  const pct = rank.next == null ? 100 : Math.min(100, Math.round((totalStars / rank.next) * 100));
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        background: "var(--accent-tint)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 16px",
      }}
    >
      <div style={{ fontSize: 34 }}>{rank.emoji}</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{rank.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {solved} of {CASES.length} cases solved
          {rank.next != null ? ` · ${rank.next - totalStars} more ⭐ to level up` : " · top rank reached"}
        </div>
        <div style={{ height: 6, borderRadius: 4, background: "rgba(0,0,0,.1)", marginTop: 6, overflow: "hidden" }} aria-hidden>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", fontWeight: 800 }}>
        <span title="Days in a row">🔥 {days}</span>
        {best > 1 && <span title="Best run of right answers">🎯 {best}</span>}
        <span>⭐ {totalStars}</span>
        <SoundToggle />
      </div>
    </div>
  );
}

/** First case never played, else the first one without 3 stars. */
export function nextCase(): { c: Case; replay: boolean } | null {
  const p = loadProgress();
  const fresh = CASES.find((c) => !p[c.id]);
  if (fresh) return { c: fresh, replay: false };
  const better = CASES.find((c) => (p[c.id]?.stars ?? 0) < 3);
  return better ? { c: better, replay: true } : null;
}

export function NextCase({ onPlay }: { onPlay: (c: Case) => void }) {
  const n = nextCase();
  if (!n) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 34 }}>🏅</div>
        <strong>Every case has 3 stars. You are a Chief Detective!</strong>
      </div>
    );
  }
  const t = themeFor(n.c.steps[0], n.c.id);
  return (
    <button
      onClick={() => onPlay(n.c)}
      style={{
        background: `linear-gradient(145deg, ${t.from}, ${t.to})`, border: `2px solid ${t.edge}`, color: "#1f2a24",
        borderRadius: 18, padding: "18px 20px", cursor: "pointer", textAlign: "left",
        display: "flex", gap: 16, alignItems: "center",
      }}
    >
      <span style={{ fontSize: 44 }}>{n.c.emoji}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7 }}>
          {n.replay ? "Go for 3 stars" : "Next case"}
        </span>
        <span style={{ fontWeight: 800, fontSize: 18 }}>{n.c.title}</span>
        <span style={{ fontSize: 13, opacity: 0.85 }}>{n.c.subtitle}</span>
      </span>
    </button>
  );
}

/** Same park all day, a new one tomorrow. Local date decides it. */
function dayIndex(now = new Date()) {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
}

export function ParkOfTheDay({ atlas, onExplore }: { atlas: Atlas; onExplore: (parkId: string) => void }) {
  const cells = (atlas.atlas["tmax_c"]?.["annual"] ?? [])
    .filter((c) => c.sen != null)
    .sort((a, b) => a.park_id.localeCompare(b.park_id));
  const cell = cells.length ? cells[dayIndex() % cells.length] : null;
  const data = useTrends(cell?.park_id);
  if (!cell) return null;
  const rank = [...cells].sort((a, b) => b.sen! - a.sen!).findIndex((c) => c.park_id === cell.park_id) + 1;
  const trend = data?.trends.find((t) => t.variable === "tmax_c" && t.period === "annual");
  const series = data?.series["tmax_c"]?.["annual"];
  const perDecade = (cell.sen! * 1.8).toFixed(2);
  const verdict =
    cell.verdict === "real" ? "The test says this is real, not luck."
    : cell.verdict === "possible" ? "The test says it might be real."
    : "The test finds no clear change.";
  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="section-title">🌲 Park of the day</div>
      <h3 style={{ margin: 0 }}>{parkName(cell.park_id)}</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
        Its daytime high changes about {Number(perDecade) > 0 ? "+" : ""}{perDecade}°F every 10 years.
        That ranks #{rank} of {cells.length} parks. {verdict}
      </p>
      {series && trend ? (
        <TrendChart series={series} trend={trend} unit="°F" label="Daytime high · Annual" parkName={parkName(cell.park_id)} />
      ) : (
        <div className="small muted">Loading the chart…</div>
      )}
      <div>
        <button className="btn" onClick={() => onExplore(cell.park_id)}>Open in the Park Explorer →</button>
      </div>
    </section>
  );
}
