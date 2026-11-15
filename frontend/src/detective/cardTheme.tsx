// Quizlet-style flashcard wrapper: each question gets a theme (colours + floating emoji)
// and an entrance animation, so every card arrives differently.
import type { ReactNode } from "react";
import type { Step } from "./cases";

interface Theme { from: string; to: string; edge: string; emoji: string[] }

const T: Record<string, Theme> = {
  hot:    { from: "#ffe9cc", to: "#ffb9a3", edge: "#B5643C", emoji: ["🔥", "☀️", "🌵"] },
  night:  { from: "#e3defa", to: "#b7c2f2", edge: "#4F6A7A", emoji: ["🌙", "✨", "⭐"] },
  rain:   { from: "#dcf0ff", to: "#a8d2f4", edge: "#4F6A7A", emoji: ["🌧️", "💧", "☔"] },
  winter: { from: "#eaf6ff", to: "#cde0f5", edge: "#4F6A7A", emoji: ["❄️", "⛄", "🧣"] },
  spring: { from: "#e6f7d6", to: "#c3e8a8", edge: "#5B6B3A", emoji: ["🌱", "🌷", "🦋"] },
  island: { from: "#d3f6f0", to: "#9fe0dc", edge: "#5B6B3A", emoji: ["🌴", "🌊", "🐚"] },
  arctic: { from: "#e6f3fc", to: "#cfe3f5", edge: "#4F6A7A", emoji: ["🐻‍❄️", "🧊", "❄️"] },
  volcano:{ from: "#fbe2c8", to: "#f2b99a", edge: "#B5643C", emoji: ["🌋", "🪨", "🔥"] },
  forest: { from: "#e0efd9", to: "#bddcb2", edge: "#5B6B3A", emoji: ["🌲", "🦌", "🍃"] },
  mystery:{ from: "#efe6d6", to: "#dccdb0", edge: "#6B5D4F", emoji: ["🔍", "🕵️", "❓"] },
};

const CASE_THEME: Record<string, string> = {
  "crater-lake-warming": "volcano",
  "opposite-rain": "rain",
  "hottest-park": "hot",
  "desert-fever": "hot",
  "night-shift": "night",
  "cold-spot": "island",
  "big-number-trap": "mystery",
  "winter-shrink": "winter",
  "july-crater": "volcano",
  "yosemite-nights": "night",
  "arctic-sprint": "arctic",
  "spring-sprint": "spring",
  "island-thirst": "island",
  "hawaii-twins": "island",
  "lightning-round": "hot",
  "real-maybe-noise": "mystery",
  "chief-detective": "forest",
};

const ISLANDS = new Set(["hale", "havo", "viis", "npsa", "drto", "chis", "bisc"]);
const ARCTIC = new Set(["kova", "dena", "gaar", "glba", "katm", "wrst", "lacl", "kefj"]);

export function themeFor(step: Step, caseId: string): Theme {
  const sides = [step.duel?.a, step.duel?.b, step.guess, step.verdictQ, step.hunt, step.rank].filter(Boolean) as {
    variable?: string; period?: string; parkId?: string; parks?: string[];
  }[];
  if (step.variable) sides.push({ variable: step.variable, period: step.period, parkId: step.parkId });
  const s = sides[0];
  let key: string | undefined;
  if (s?.variable === "prcp_mm") key = "rain";
  else if (s?.variable === "tmin_c") key = "night";
  else if (s?.variable?.startsWith("hot")) key = "hot";
  else if (s?.period && ["DJF", "1", "2", "12"].includes(s.period)) key = "winter";
  else if (s?.period === "MAM") key = "spring";
  else {
    const p = s?.parkId ?? s?.parks?.[0];
    if (p && ISLANDS.has(p)) key = "island";
    else if (p && ARCTIC.has(p)) key = "arctic";
  }
  if (step.kind === "myth" || step.kind === "intro") key = CASE_THEME[caseId];
  return T[key ?? CASE_THEME[caseId] ?? "forest"];
}

export const ANIMS = ["dc-flip", "dc-slide", "dc-drop", "dc-zoom", "dc-swing", "dc-curtain", "dc-tilt"];

export const CARD_CSS = `
@keyframes dc-flip   { from { transform: perspective(900px) rotateY(-90deg); opacity: 0 } to { transform: perspective(900px) rotateY(0); opacity: 1 } }
@keyframes dc-slide  { from { transform: translateX(80px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes dc-drop   { 0% { transform: translateY(-90px); opacity: 0 } 60% { transform: translateY(10px); opacity: 1 } 80% { transform: translateY(-4px) } 100% { transform: none } }
@keyframes dc-zoom   { from { transform: scale(.5) rotate(-6deg); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes dc-swing  { from { transform: perspective(900px) rotateX(70deg); transform-origin: top; opacity: 0 } to { transform: perspective(900px) rotateX(0); transform-origin: top; opacity: 1 } }
@keyframes dc-curtain{ from { clip-path: inset(0 50% 0 50% round 22px); opacity: .2 } to { clip-path: inset(0 0 0 0 round 22px); opacity: 1 } }
@keyframes dc-tilt   { from { transform: translate(-60px, 30px) rotate(-8deg); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes dc-bob    { 0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-10px) rotate(6deg) } }
.dc-card { animation-duration: .6s; animation-timing-function: cubic-bezier(.2,.8,.2,1); animation-fill-mode: both }
.dc-flip { animation-name: dc-flip } .dc-slide { animation-name: dc-slide } .dc-drop { animation-name: dc-drop }
.dc-zoom { animation-name: dc-zoom } .dc-swing { animation-name: dc-swing } .dc-curtain { animation-name: dc-curtain }
.dc-tilt { animation-name: dc-tilt }
.dc-deco { position: absolute; pointer-events: none; user-select: none; opacity: .28; animation: dc-bob 4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .dc-card, .dc-deco { animation: none } }
`;

const DECO: React.CSSProperties[] = [
  { top: 10, right: 18, fontSize: 64 },
  { bottom: 12, left: 14, fontSize: 52, animationDelay: "-1.3s" },
  { bottom: 20, right: 40, fontSize: 40, animationDelay: "-2.4s" },
];

export default function FlashCard({
  step, caseId, index, children,
}: { step: Step; caseId: string; index: number; children: ReactNode }) {
  const t = themeFor(step, caseId);
  const anim = ANIMS[(index + caseId.length) % ANIMS.length];
  return (
    <div
      key={`${caseId}-${index}`}
      className={`dc-card ${anim}`}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--paper)",
        border: "1px solid var(--stone)",
        borderTop: `4px solid ${t.edge}`,
        borderRadius: "var(--radius)",
        padding: "30px 26px",
        minHeight: 340,
        color: "var(--bark)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <style>{CARD_CSS}</style>
      {DECO.map((d, i) => (
        <span key={i} className="dc-deco" style={d} aria-hidden>
          {t.emoji[i % t.emoji.length]}
        </span>
      ))}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </div>
  );
}
