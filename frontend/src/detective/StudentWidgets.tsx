// Student Home pieces: rank banner, next case (a trailhead sign), park of the day (a field guide card),
// sound switch, and the trail-themed streak words. Colours come from the park palette in styles.css.
import { useState } from "react";
import type { Atlas } from "./model";
import { CASES } from "./cases";
import type { Case } from "./cases";
import { bestAnswerStreak, dayStreak, loadProgress, parkName, rankTitle, useTrends } from "./games";
import { PhotoCredit, photoOf } from "./photos";
import { setSound, soundOn, play } from "./sound";
import TrendChart from "./TrendChart";

export { E, RIDGE, TOPO, trailWord, trees } from "./theme";
import { E, RIDGE, TOPO } from "./theme";

export const WIDGET_CSS = `
@keyframes sw-sway { 0%,100% { transform: rotate(-3deg) translateY(0) } 50% { transform: rotate(3deg) translateY(-6px) } }
@keyframes sw-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(107,127,58,.45), 0 10px 24px rgba(74,55,38,.20) } 50% { box-shadow: 0 0 0 9px rgba(107,127,58,0), 0 14px 30px rgba(74,55,38,.26) } }
@keyframes sw-sun { from { transform: translateX(-130%) skewX(-18deg) } to { transform: translateX(280%) skewX(-18deg) } }
@keyframes sw-pop { from { transform: scale(.85); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes sw-leaf { 0% { transform: translate(0,-10px) rotate(0); opacity: 0 } 15% { opacity: .9 } 100% { transform: translate(var(--dx), 150px) rotate(var(--r)); opacity: 0 } }
.sw-hero { position: relative; overflow: hidden; animation: sw-glow 3s ease-in-out infinite; transition: transform .18s }
.sw-hero:hover { transform: translateY(-3px) }
.sw-hero:active { transform: scale(.995) }
.sw-hero .sw-sun { position: absolute; top: 0; bottom: 0; width: 35%; background: linear-gradient(90deg, transparent, rgba(255,240,200,.45), transparent); animation: sw-sun 4.5s ease-in-out infinite; pointer-events: none }
.sw-hero:hover .sw-go { background: ${E.pine}; color: ${E.cream} }
.sw-sway { animation: sw-sway 3.6s ease-in-out infinite; transform-origin: 50% 90% }
.sw-pick { transition: transform .15s, box-shadow .15s }
.sw-pick:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(74,55,38,.22) }
.sw-reveal { animation: sw-pop .35s cubic-bezier(.2,1.3,.4,1) both }
.sw-leafy { position: absolute; top: 0; font-size: 20px; animation: sw-leaf 1.6s ease-in forwards; pointer-events: none }
@media (prefers-reduced-motion: reduce) { .sw-hero, .sw-sway, .sw-hero .sw-sun, .sw-reveal, .sw-leafy { animation: none } }
`;

/** A few leaves drifting down, for a right answer. */
export function Leaves({ count = 10 }: { count?: number }) {
  const bits = ["🍃", "🍂", "🌿", "🍁"];
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <style>{WIDGET_CSS}</style>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="sw-leafy"
          style={{
            left: `${(i * 37) % 95}%`,
            animationDelay: `${(i % 5) * 90}ms`,
            "--dx": `${((i * 29) % 60) - 30}px`,
            "--r": `${(i * 71) % 360}deg`,
          } as React.CSSProperties}
        >
          {bits[i % bits.length]}
        </span>
      ))}
    </div>
  );
}

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
      title={on ? "Nature sounds on" : "Nature sounds off"}
      style={{
        background: "rgba(247,241,227,.8)", border: `1px solid ${E.sage}`, borderRadius: 999,
        padding: "4px 10px", cursor: "pointer", fontSize: 13, color: E.bark, fontWeight: 600,
      }}
    >
      {on ? "🌿 Nature sounds on" : "🔇 Sounds off"}
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
  const stat = (emoji: string, n: number | string, label: string) => (
    <div style={{ textAlign: "center", minWidth: 64 }} title={label}>
      <div style={{ fontSize: 20, fontWeight: 800, color: E.bark }}>{emoji} {n}</div>
      <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: E.moss, fontWeight: 700 }}>{label}</div>
    </div>
  );
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        background: `${RIDGE} bottom / 100% 46px no-repeat, linear-gradient(135deg, ${E.cream}, ${E.sand})`,
        border: `1.5px solid ${E.sage}`, borderRadius: 18, padding: "14px 18px 30px",
      }}
    >
      <div
        style={{
          fontSize: 32, width: 58, height: 58, borderRadius: "50%", display: "grid", placeItems: "center",
          background: E.cream, border: `3px double ${E.pine}`,
        }}
      >
        {rank.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: E.rust, fontWeight: 700 }}>Ranger rank</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: E.pine }}>{rank.title}</div>
        <div style={{ fontSize: 12, color: E.bark, opacity: 0.8 }}>
          {solved} of {CASES.length} cases solved
          {rank.next != null ? ` · ${rank.next - totalStars} more ⭐ to the next rank` : " · top rank reached"}
        </div>
        {/* Trail progress: hiker walks toward the summit flag. */}
        <div style={{ position: "relative", height: 8, borderRadius: 4, background: "rgba(74,55,38,.14)", marginTop: 8 }} aria-hidden>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${E.moss}, ${E.pine})` }} />
          <span style={{ position: "absolute", top: -11, left: `calc(${pct}% - 9px)`, fontSize: 16 }}>🥾</span>
          <span style={{ position: "absolute", top: -13, right: -6, fontSize: 16 }}>🚩</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {stat("🏕️", days, "camp days")}
        {stat("🌲", best, "best trail")}
        {stat("⭐", totalStars, "stars")}
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

const DIFF = {
  easy: { t: "Easy trail", c: E.moss },
  medium: { t: "Moderate trail", c: E.clay },
  hard: { t: "Strenuous trail", c: E.rust },
} as const;

/** The next case, drawn as a trailhead sign. */
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
  const d = DIFF[n.c.difficulty];
  const chip = (bg: string, fg: string): React.CSSProperties => ({
    background: bg, color: fg, borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 700,
  });
  return (
    <button
      className="sw-hero"
      onClick={() => onPlay(n.c)}
      style={{
        background: `${RIDGE} bottom / 100% 70px no-repeat, ${TOPO} right -40px top -30px / 260px no-repeat, linear-gradient(140deg, #f3e6c8, #e3c99a 60%, #d6ae7b)`,
        border: `3px solid ${E.bark}`, outline: `2px dashed ${E.cream}`, outlineOffset: -9,
        color: E.bark, borderRadius: 22, padding: "24px 26px 44px", cursor: "pointer", textAlign: "left",
        display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap", width: "100%",
      }}
    >
      <style>{WIDGET_CSS}</style>
      <span className="sw-sun" aria-hidden />
      <span
        className="sw-sway"
        style={{
          fontSize: 60, width: 104, height: 104, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
          background: E.cream, border: `4px solid ${E.pine}`, boxShadow: "inset 0 0 0 3px #e9dcc0, 0 6px 14px rgba(74,55,38,.25)",
        }}
      >
        {n.c.emoji}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 220, position: "relative" }}>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={chip(E.pine, E.cream)}>{n.replay ? "⭐ Go for 3 stars" : "🧭 Next trail"}</span>
          <span style={chip("rgba(247,241,227,.85)", d.c)}>● {d.t}</span>
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, lineHeight: 1.15, color: E.pine }}>{n.c.title}</span>
        <span style={{ fontSize: 15, lineHeight: 1.5 }}>{n.c.subtitle}</span>
        {n.c.badge && <span style={{ fontSize: 13, fontWeight: 700, color: E.rust }}>🏅 Earn the patch: {n.c.badge}</span>}
      </span>
      <span
        className="sw-go"
        aria-hidden
        style={{
          width: 50, height: 50, borderRadius: "50%", border: `2px solid ${E.pine}`, color: E.pine, background: "rgba(247,241,227,.85)",
          display: "grid", placeItems: "center", fontSize: 22, fontWeight: 800, flexShrink: 0, transition: "background .15s, color .15s",
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
const GUESSES: { id: Guess; emoji: string; text: string; bg: string; edge: string }[] = [
  { id: "warming", emoji: "☀️", text: "Warming", bg: "linear-gradient(150deg,#f3d9b8,#d99a62)", edge: E.rust },
  { id: "flat", emoji: "🪨", text: "No change", bg: "linear-gradient(150deg,#ece4d2,#c9bca0)", edge: E.bark },
  { id: "cooling", emoji: "🏔️", text: "Cooling", bg: "linear-gradient(150deg,#dbe5e6,#9fb6bf)", edge: E.dusk },
];

/** Park of the day, drawn as a field-guide card with a quick guess. */
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
  const photo = photoOf(cell.park_id);
  const right = guess === truth;
  const pick = (g: Guess) => {
    setGuess(g);
    play(g === truth ? "right" : "wrong");
  };
  const verdictPill =
    cell.verdict === "real" ? { t: "Confirmed trend", tip: "The test says this change is real.", bg: "#dfe8cf", c: E.pine }
    : cell.verdict === "possible" ? { t: "Possible trend", tip: "It might be real. We need more years to be sure.", bg: "#f3e2c0", c: "#7a5a1c" }
    : { t: "No clear trend", tip: "The ups and downs look like normal weather.", bg: "#e7e0d0", c: E.bark };

  return (
    <section
      style={{
        borderRadius: 22, overflow: "hidden", border: `2px solid ${E.sage}`, background: E.cream,
        boxShadow: "0 12px 28px rgba(74,55,38,.12)", position: "relative",
      }}
    >
      <style>{WIDGET_CSS}</style>
      <div
        style={{
          background: photo
            ? `linear-gradient(180deg, rgba(31,42,36,.15) 0%, rgba(31,42,36,.7) 100%), url("${photo.file}") center / cover no-repeat`
            : `${RIDGE} bottom / 100% 60px no-repeat, linear-gradient(180deg, #f0c98f 0%, #d9a066 45%, #8a9a5b 100%)`,
          color: E.cream, padding: photo ? "96px 24px 18px" : "20px 24px 54px", position: "relative",
        }}
      >
        {!photo && <span aria-hidden style={{ position: "absolute", right: 22, top: 14, fontSize: 34 }}>🌄</span>}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: photo ? E.cream : E.bark }}>
          Field guide · Park of the day
        </div>
        <h3
          style={{
            margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 32, color: photo ? "#fff" : E.bark,
            textShadow: photo ? "0 2px 8px rgba(0,0,0,.55)" : "0 1px 0 rgba(255,255,255,.4)",
          }}
        >
          {name}
        </h3>
        {photo && <PhotoCredit photo={photo} style={{ position: "absolute", right: 12, top: 10, color: "rgba(255,255,255,.85)", textShadow: "0 1px 3px rgba(0,0,0,.7)" }} />}
      </div>

      {!guess ? (
        <div style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 14, background: `${TOPO} right -60px bottom -60px / 280px no-repeat` }}>
          <div style={{ fontWeight: 800, fontSize: 19, color: E.bark }}>Ranger's quick guess: since 1981, is {name} getting…</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {GUESSES.map((g) => (
              <button
                key={g.id}
                className="sw-pick"
                onClick={() => pick(g.id)}
                style={{
                  background: g.bg, border: `2px solid ${g.edge}`, borderRadius: 16, padding: "16px 10px",
                  cursor: "pointer", color: E.bark, fontWeight: 800, fontSize: 16,
                }}
              >
                <div style={{ fontSize: 38 }}>{g.emoji}</div>
                {g.text}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: E.moss, fontWeight: 600 }}>Tap one to see what 45 years of NASA data say.</div>
        </div>
      ) : (
        <div className="sw-reveal" style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
          {right && <Leaves />}
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div style={{ fontSize: 44 }}>{right ? "🦌" : "🦉"}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: right ? E.pine : E.rust }}>
                {right ? "Sharp eyes, ranger!" : "Whoo-ops, not quite!"}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: E.bark }}>
                {truth === "flat"
                  ? `${name} shows no clear change in its daytime high.`
                  : `${name} is ${truth === "warming" ? "warming" : "cooling"}.`}{" "}
                It ranks #{rank} of {cells.length} parks.
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 38, color: per > 0 ? E.rust : E.dusk, lineHeight: 1 }}>
                {per > 0 ? "+" : ""}{per.toFixed(2)}°F
              </div>
              <div style={{ fontSize: 11, color: E.moss, fontWeight: 700 }}>every 10 years</div>
            </div>
            <span
              title={verdictPill.tip}
              style={{
                background: verdictPill.bg, color: verdictPill.c, border: `1px solid ${verdictPill.c}33`,
                borderRadius: 999, padding: "5px 12px", fontWeight: 700, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: verdictPill.c }} />
              {verdictPill.t}
            </span>
          </div>
          {series && trend ? (
            <TrendChart series={series} trend={trend} unit="°F" label="Daytime high · Annual" parkName={name} parkId={cell.park_id} />
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
