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

const WIDGET_CSS = `
.sw-next { transition: transform .15s, border-color .15s, box-shadow .15s }
.sw-next:hover { transform: translateY(-2px); border-color: var(--pine); box-shadow: var(--shadow-md) }
.sw-next:hover .sw-go { background: var(--pine); color: var(--on-pine) }
.sw-pick { transition: transform .15s, border-color .15s, background .15s }
.sw-pick:hover { transform: translateY(-2px); border-color: var(--pine); background: var(--pine-tint) }
@keyframes sw-fade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.sw-reveal { animation: sw-fade .3s ease-out both }
@media (prefers-reduced-motion: reduce) { .sw-next, .sw-pick { transition: none } .sw-reveal { animation: none } }
`;

const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

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
  const chip: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: 999, padding: "2px 10px", fontSize: 12, color: "var(--text-muted)", background: "var(--surface)",
  };
  return (
    <button
      className="card sw-next"
      onClick={() => onPlay(n.c)}
      style={{
        display: "flex", gap: 18, alignItems: "center", textAlign: "left", cursor: "pointer", width: "100%",
        borderLeft: "5px solid var(--pine)", color: "var(--text)",
      }}
    >
      <style>{WIDGET_CSS}</style>
      <span
        style={{
          fontSize: 44, width: 76, height: 76, borderRadius: 16, display: "grid", placeItems: "center", flexShrink: 0,
          background: `linear-gradient(145deg, ${t.from}, ${t.to})`, border: "1px solid var(--border)",
        }}
      >
        {n.c.emoji}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
        <span className="section-title">{n.replay ? "Go for 3 stars" : "Next case"}</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--pine)", lineHeight: 1.2 }}>
          {n.c.title}
        </span>
        <span className="small muted">{n.c.subtitle}</span>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <span style={chip}>{DIFF_LABEL[n.c.difficulty]}</span>
          <span style={chip}>⏱ 5 seconds a question</span>
          {n.c.badge && <span style={chip}>🏅 {n.c.badge}</span>}
        </span>
      </span>
      <span
        className="sw-go"
        aria-hidden
        style={{
          width: 40, height: 40, borderRadius: "50%", border: "1.5px solid var(--pine)", color: "var(--pine)",
          display: "grid", placeItems: "center", fontSize: 18, flexShrink: 0, transition: "background .15s, color .15s",
        }}
      >
        →
      </span>
    </button>
  );
}

/** Same park all day, a new one tomorrow. Local date decides it. */
function dayIndex(now = new Date()) {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
}

type Guess = "warming" | "cooling" | "flat";
const GUESSES: { id: Guess; emoji: string; text: string }[] = [
  { id: "warming", emoji: "🔥", text: "Warming" },
  { id: "flat", emoji: "➖", text: "No change" },
  { id: "cooling", emoji: "❄️", text: "Cooling" },
];

export function ParkOfTheDay({ atlas, onExplore }: { atlas: Atlas; onExplore: (parkId: string) => void }) {
  const cells = (atlas.atlas["tmax_c"]?.["annual"] ?? [])
    .filter((c) => c.sen != null)
    .sort((a, b) => a.park_id.localeCompare(b.park_id));
  const cell = cells.length ? cells[dayIndex() % cells.length] : null;
  const data = useTrends(cell?.park_id);
  const [guess, setGuess] = useState<Guess | null>(null);
  if (!cell) return null;

  const truth: Guess = cell.verdict === "none" || cell.verdict === "short" || cell.verdict === "flat" ? "flat" : cell.sen! > 0 ? "warming" : "cooling";
  const rank = [...cells].sort((a, b) => b.sen! - a.sen!).findIndex((c) => c.park_id === cell.park_id) + 1;
  const trend = data?.trends.find((t) => t.variable === "tmax_c" && t.period === "annual");
  const series = data?.series["tmax_c"]?.["annual"];
  const per = cell.sen! * 1.8;
  const name = parkName(cell.park_id);
  const pick = (g: Guess) => {
    setGuess(g);
    play(g === truth ? "right" : "wrong");
  };
  const verdictPill =
    cell.verdict === "real" ? { t: "Real, not luck", bg: "#d4edda", c: "#155724" }
    : cell.verdict === "possible" ? { t: "Possible, not proven", bg: "#fff3cd", c: "#856404" }
    : { t: "No clear change", bg: "var(--surface-2)", c: "var(--text-muted)" };

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{WIDGET_CSS}</style>
      <div className="section-title">🌲 Park of the day</div>
      <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 26, color: "var(--pine)" }}>{name}</h3>

      {!guess ? (
        <>
          <div style={{ fontSize: 15 }}>Quick guess: since 1981, is its daytime high getting…</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {GUESSES.map((g) => (
              <button
                key={g.id}
                className="sw-pick"
                onClick={() => pick(g.id)}
                style={{
                  background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "10px 18px",
                  cursor: "pointer", color: "var(--text)", fontWeight: 600, fontSize: 14, display: "flex", gap: 8, alignItems: "center",
                }}
              >
                <span style={{ fontSize: 20 }}>{g.emoji}</span>
                {g.text}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="sw-reveal" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, color: guess === truth ? "var(--pine)" : "var(--rust)" }}>
                {guess === truth ? "✓ You got it." : "Not quite."}
              </div>
              <div className="small muted">
                {truth === "flat" ? "No clear change in its daytime high." : `It is ${truth === "warming" ? "warming" : "cooling"}.`}{" "}
                Ranks #{rank} of {cells.length} parks.
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, color: per > 0 ? "var(--rust)" : "var(--sky)", lineHeight: 1 }}>
                {per > 0 ? "+" : ""}{per.toFixed(2)}°F
              </div>
              <div className="micro muted">every 10 years</div>
            </div>
            <span style={{ background: verdictPill.bg, color: verdictPill.c, borderRadius: 999, padding: "3px 12px", fontWeight: 600, fontSize: 12 }}>
              {verdictPill.t}
            </span>
          </div>
          {series && trend ? (
            <TrendChart series={series} trend={trend} unit="°F" label="Daytime high · Annual" parkName={name} />
          ) : (
            <div className="small muted">Loading the chart…</div>
          )}
          <div>
            <button className="btn" onClick={() => onExplore(cell.park_id)}>Open in the Park Explorer →</button>
          </div>
        </div>
      )}
    </section>
  );
}
