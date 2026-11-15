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
@keyframes sw-float { 0%,100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-10px) rotate(4deg) } }
@keyframes sw-glow { 0%,100% { box-shadow: 0 0 0 0 var(--glow), 0 12px 28px rgba(0,0,0,.18) } 50% { box-shadow: 0 0 0 10px transparent, 0 16px 34px rgba(0,0,0,.22) } }
@keyframes sw-shine { from { transform: translateX(-120%) skewX(-18deg) } to { transform: translateX(260%) skewX(-18deg) } }
@keyframes sw-pop { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
.sw-hero { position: relative; overflow: hidden; animation: sw-glow 2.6s ease-in-out infinite; transition: transform .18s }
.sw-hero:hover { transform: translateY(-4px) scale(1.01) }
.sw-hero:active { transform: scale(.99) }
.sw-hero .sw-shine { position: absolute; top: 0; bottom: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); animation: sw-shine 3.4s ease-in-out infinite }
.sw-emoji { animation: sw-float 3.2s ease-in-out infinite }
.sw-pick { transition: transform .15s, box-shadow .15s }
.sw-pick:hover { transform: translateY(-4px) rotate(-1deg); box-shadow: 0 10px 22px rgba(0,0,0,.2) }
.sw-reveal { animation: sw-pop .4s cubic-bezier(.2,1.4,.4,1) both }
@media (prefers-reduced-motion: reduce) { .sw-hero, .sw-emoji, .sw-hero .sw-shine, .sw-reveal { animation: none } }
`;

const DIFF_LABEL = { easy: "😊 Easy", medium: "🤔 Medium", hard: "🔥 Hard" } as const;

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
      className="sw-hero"
      onClick={() => onPlay(n.c)}
      style={{
        "--glow": `${t.edge}88`,
        background: `radial-gradient(circle at 12% 20%, ${t.from}, ${t.to})`, border: `3px solid ${t.edge}`, color: "#1f2a24",
        borderRadius: 24, padding: "26px 28px", cursor: "pointer", textAlign: "left",
        display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap", width: "100%",
      } as React.CSSProperties}
    >
      <style>{WIDGET_CSS}</style>
      <span className="sw-shine" aria-hidden />
      <span aria-hidden style={{ position: "absolute", right: -10, bottom: -34, fontSize: 170, opacity: 0.14 }}>{t.emoji[0]}</span>
      <span className="sw-emoji" style={{ fontSize: 76, lineHeight: 1, filter: "drop-shadow(0 8px 8px rgba(0,0,0,.25))" }}>{n.c.emoji}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 220, position: "relative" }}>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ background: "#1f2a24", color: "#fff", borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>
            {n.replay ? "⭐ Go for 3 stars" : "🕵️ New mystery"}
          </span>
          <span style={{ background: "rgba(255,255,255,.7)", borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
            {DIFF_LABEL[n.c.difficulty]}
          </span>
          <span style={{ background: "rgba(255,255,255,.7)", borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
            ⏱ 5 seconds a question
          </span>
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 30, lineHeight: 1.15 }}>{n.c.title}</span>
        <span style={{ fontSize: 15, lineHeight: 1.5, opacity: 0.88 }}>{n.c.subtitle}</span>
        {n.c.badge && <span style={{ fontSize: 13, fontWeight: 700 }}>🏅 Win the badge: {n.c.badge}</span>}
      </span>
    </button>
  );
}

/** Same park all day, a new one tomorrow. Local date decides it. */
function dayIndex(now = new Date()) {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
}

type Guess = "warming" | "cooling" | "flat";
const GUESSES: { id: Guess; emoji: string; text: string; bg: string }[] = [
  { id: "warming", emoji: "🔥", text: "Warming", bg: "linear-gradient(145deg,#ffe0cf,#ffb08a)" },
  { id: "flat", emoji: "😐", text: "No change", bg: "linear-gradient(145deg,#eef0e4,#cfd6b8)" },
  { id: "cooling", emoji: "❄️", text: "Cooling", bg: "linear-gradient(145deg,#dff0ff,#a9d4f5)" },
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
    cell.verdict === "real" ? { t: "✅ Real, not luck", bg: "#d4edda", c: "#155724" }
    : cell.verdict === "possible" ? { t: "🤔 Maybe real", bg: "#fff3cd", c: "#856404" }
    : { t: "〰️ Just wiggles", bg: "#e9e6da", c: "#5b5646" };

  return (
    <section
      style={{
        borderRadius: 24, overflow: "hidden", border: "2px solid var(--border)", background: "var(--surface)",
        boxShadow: "0 14px 30px rgba(0,0,0,.10)",
      }}
    >
      <style>{WIDGET_CSS}</style>
      <div
        style={{
          background: "linear-gradient(135deg,#2e5e32,#5f9a4f 55%,#e3b04b)", color: "#fff", padding: "20px 24px",
          position: "relative", overflow: "hidden",
        }}
      >
        <span aria-hidden style={{ position: "absolute", right: 14, top: -6, fontSize: 96, opacity: 0.22 }}>🌲</span>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.9 }}>
          🌄 Park of the day
        </div>
        <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 32 }}>{name}</h3>
      </div>

      {!guess ? (
        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Quick guess: since 1981, is {name} getting…</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {GUESSES.map((g) => (
              <button
                key={g.id}
                className="sw-pick"
                onClick={() => pick(g.id)}
                style={{
                  background: g.bg, border: "2px solid rgba(0,0,0,.14)", borderRadius: 18, padding: "18px 10px",
                  cursor: "pointer", color: "#1f2a24", fontWeight: 800, fontSize: 16,
                }}
              >
                <div style={{ fontSize: 40 }}>{g.emoji}</div>
                {g.text}
              </button>
            ))}
          </div>
          <div className="small muted">Tap one to see what NASA data says.</div>
        </div>
      ) : (
        <div className="sw-reveal" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div style={{ fontSize: 48 }}>{guess === truth ? "🎉" : "🤷"}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 900, fontSize: 22 }}>{guess === truth ? "You got it!" : "Not quite!"}</div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                {truth === "flat"
                  ? `${name} shows no clear change in its daytime high.`
                  : `${name} is ${truth === "warming" ? "warming" : "cooling"}.`}{" "}
                It ranks #{rank} of {cells.length} parks.
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 40, color: per > 0 ? "#b5532a" : "#2b6aa3", lineHeight: 1 }}>
                {per > 0 ? "+" : ""}{per.toFixed(2)}°F
              </div>
              <div className="micro muted">every 10 years</div>
            </div>
            <span style={{ background: verdictPill.bg, color: verdictPill.c, borderRadius: 999, padding: "6px 14px", fontWeight: 800, fontSize: 13 }}>
              {verdictPill.t}
            </span>
          </div>
          {series && trend ? (
            <TrendChart series={series} trend={trend} unit="°F" label="Daytime high · Annual" parkName={name} />
          ) : (
            <div className="small muted">Loading the chart…</div>
          )}
          <div>
            <button className="btn" onClick={() => onExplore(cell.park_id)}>🧭 Explore {name}</button>
          </div>
        </div>
      )}
    </section>
  );
}
