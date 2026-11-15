// Quizlet-style question card. The card pops out over a blurred page, the student answers
// within 5 seconds, and the card flips to say right or wrong. Every answer comes from the atlas.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Atlas, Verdict } from "./model";
import { PERIOD_LABEL } from "./model";
import TrendChart from "./TrendChart";
import type { Side, Step } from "./cases";
import { ANIMS, CARD_CSS, themeFor } from "./cardTheme";
import {
  QUESTION_SECONDS, cellOf, fmtRate, makeFact, parkName, shown, sideLabel, useTrends,
} from "./games";

export interface Answer {
  pts: number;
  max: number;
  ok: boolean;
  timeout?: boolean;
  /** The correct answer, in words. */
  answer: string;
  /** Optional extra (a chart or a list) for the back of the card. */
  extra?: ReactNode;
}

interface GameProps {
  step: Step;
  atlas: Atlas;
  timeUp: boolean;
  done: boolean;
  finish: (a: Answer) => void;
}

const explain = (step: Step, atlas: Atlas) =>
  typeof step.fact === "function" ? step.fact(atlas) : (step.fact ?? "");

const optBtn = (state: "idle" | "picked" | "good" | "bad"): React.CSSProperties => ({
  background: state === "good" ? "#d4edda" : state === "bad" ? "#f8d7da" : state === "picked" ? "#fff" : "rgba(255,255,255,.78)",
  color: state === "good" ? "#155724" : state === "bad" ? "#721c24" : "#1f2a24",
  border: `2px solid ${state === "good" ? "#2a7d4f" : state === "bad" ? "#c0392b" : state === "picked" ? "#1f2a24" : "rgba(0,0,0,.14)"}`,
  borderRadius: 14,
  padding: "14px 16px",
  cursor: "pointer",
  textAlign: "center",
  fontSize: 14,
  fontWeight: state === "idle" ? 500 : 700,
});

const lockBtn: React.CSSProperties = {
  background: "#1f2a24", color: "#fff", border: "none", borderRadius: 10,
  padding: "11px 22px", cursor: "pointer", fontWeight: 700, fontSize: 14, alignSelf: "flex-start",
};

// ── Games (front of the card) ─────────────────────────────────────────────

function Duel({ step, atlas, timeUp, done, finish }: GameProps) {
  const d = step.duel!;
  const [pick, setPick] = useState<"a" | "b" | "none" | null>(null);
  const va = shown(atlas, d.a.variable, cellOf(atlas, d.a)?.sen ?? null) ?? 0;
  const vb = shown(atlas, d.b.variable, cellOf(atlas, d.b)?.sen ?? null) ?? 0;
  const slower = d.pick === "slower";
  const winner: "a" | "b" = (va > vb) !== slower ? "a" : "b";
  const same = d.a.parkId === d.b.parkId;
  const tag = (s: Side) => (same ? (atlas.variables[s.variable]?.label ?? s.variable) : parkName(s.parkId));
  const end = (k: "a" | "b" | "none") => {
    if (pick || done) return;
    setPick(k);
    const w = winner === "a" ? d.a : d.b;
    const l = winner === "a" ? d.b : d.a;
    const wv = winner === "a" ? va : vb;
    const lv = winner === "a" ? vb : va;
    finish({
      pts: k === winner ? 1 : 0, max: 1, ok: k === winner, timeout: k === "none",
      answer: `${tag(w)} (${fmtRate(atlas, w.variable, wv)}) beats ${tag(l)} (${fmtRate(atlas, l.variable, lv)})`,
    });
  };
  useEffect(() => { if (timeUp) end("none"); }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "stretch" }}>
      {(["a", "b"] as const).map((k, i) => {
        const s = d[k];
        return (
          <div key={k} style={{ display: "contents" }}>
            {i === 1 && <div style={{ alignSelf: "center", fontWeight: 900, opacity: 0.6 }}>VS</div>}
            <button
              disabled={!!pick}
              onClick={() => end(k)}
              style={{ ...optBtn(!pick ? "idle" : k === pick ? (k === winner ? "good" : "bad") : "idle"), transition: "transform .12s" }}
            >
              <div style={{ fontSize: 28 }}>{same ? (k === "a" ? "☀️" : "🌙") : "🏞️"}</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{tag(s)}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                {same ? PERIOD_LABEL[s.period] ?? s.period : `${atlas.variables[s.variable]?.label} · ${PERIOD_LABEL[s.period] ?? s.period}`}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Hunt({ step, atlas, timeUp, done, finish }: GameProps) {
  const h = step.hunt!;
  const [pick, setPick] = useState<string | null>(null);
  const val = (p: string) => shown(atlas, h.variable, cellOf(atlas, { parkId: p, variable: h.variable, period: h.period })?.sen ?? null) ?? 0;
  const sorted = [...h.parks].sort((x, y) => (h.pick === "max" ? val(y) - val(x) : val(x) - val(y)));
  const winner = sorted[0];
  const end = (p: string) => {
    if (pick || done) return;
    setPick(p);
    finish({
      pts: p === winner ? 2 : 0, max: 2, ok: p === winner, timeout: p === "⏰",
      answer: `${parkName(winner)} (${fmtRate(atlas, h.variable, val(winner))})`,
      extra: (
        <div style={{ fontSize: 13, display: "grid", gap: 2 }}>
          {sorted.map((p2, i) => (
            <div key={p2} style={{ fontWeight: i === 0 ? 800 : 400 }}>
              {i + 1}. {parkName(p2)}: {fmtRate(atlas, h.variable, val(p2))}
            </div>
          ))}
        </div>
      ),
    });
  };
  useEffect(() => { if (timeUp) end("⏰"); }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
      {h.parks.map((p) => (
        <button
          key={p}
          disabled={!!pick}
          onClick={() => end(p)}
          style={optBtn(!pick ? "idle" : p === winner ? "good" : p === pick ? "bad" : "idle")}
        >
          <div style={{ fontSize: 26 }}>🏞️</div>
          <div style={{ fontWeight: 800 }}>{parkName(p)}</div>
        </button>
      ))}
    </div>
  );
}

function Guess({ step, atlas, timeUp, done, finish }: GameProps) {
  const g = step.guess!;
  const truth = shown(atlas, g.variable, cellOf(atlas, { parkId: g.parkId, variable: g.variable, period: g.period })?.sen ?? null) ?? 0;
  const [val, setVal] = useState((g.min + g.max) / 2);
  const [locked, setLocked] = useState(false);
  const range = g.max - g.min;
  const err = Math.abs(val - truth) / range;
  const pts = err <= 0.08 ? 3 : err <= 0.18 ? 2 : err <= 0.3 ? 1 : 0;
  const label = (v: number) => fmtRate(atlas, g.variable, v);
  const end = (timeout: boolean) => {
    if (locked || done) return;
    setLocked(true);
    finish({
      pts: timeout ? 0 : pts, max: 3, ok: !timeout && pts >= 2, timeout,
      answer: `Real answer: ${label(truth)}. ${timeout ? "No guess locked." : `You said ${label(val)}.`}`,
    });
  };
  useEffect(() => { if (timeUp) end(true); }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ textAlign: "center", fontSize: 26, fontWeight: 900 }}>{label(val)}</div>
      <input
        type="range" min={g.min} max={g.max} step={g.step} value={val} disabled={locked}
        onChange={(e) => setVal(Number(e.target.value))} style={{ width: "100%" }} aria-label="Your guess"
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
        <span>{label(g.min)}</span><span>{label(g.max)}</span>
      </div>
      {!locked && <button style={lockBtn} onClick={() => end(false)}>Lock in my guess</button>}
    </div>
  );
}

const V_OPTS: { v: Verdict; label: string; emoji: string }[] = [
  { v: "real", label: "Real trend", emoji: "📈" },
  { v: "possible", label: "Maybe", emoji: "🤔" },
  { v: "none", label: "Just noise", emoji: "🎲" },
];
const V_RANK: Record<string, number> = { none: 0, possible: 1, real: 2 };

function DotChart({ years, values }: { years: number[]; values: number[] }) {
  const W = 560, H = 170, P = 24;
  const lo = Math.min(...values), hi = Math.max(...values);
  const x = (y: number) => P + ((y - years[0]) / (years[years.length - 1] - years[0] || 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: "rgba(255,255,255,.6)", borderRadius: 12 }} role="img" aria-label="Yearly values, no trend line">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(0,0,0,.2)" />
      {values.map((v, i) => <circle key={i} cx={x(years[i])} cy={y(v)} r={4} fill="#1f2a24" opacity={0.8} />)}
      <text x={P} y={H - 6} fontSize="11" fill="#555">{years[0]}</text>
      <text x={W - P} y={H - 6} fontSize="11" textAnchor="end" fill="#555">{years[years.length - 1]}</text>
    </svg>
  );
}

function VerdictGame({ step, atlas, timeUp, done, finish }: GameProps) {
  const q = step.verdictQ!;
  const side: Side = { parkId: q.parkId, variable: q.variable, period: q.period };
  const data = useTrends(q.parkId);
  const [pick, setPick] = useState<Verdict | "late" | null>(null);
  const truth = cellOf(atlas, side)?.verdict ?? "none";
  const series = data?.series[q.variable]?.[q.period];
  const row = data?.trends.find((t) => t.variable === q.variable && t.period === q.period);
  const meta = atlas.variables[q.variable];
  const qv = cellOf(atlas, side)?.q;
  const end = (v: Verdict | "late") => {
    if (pick || done) return;
    setPick(v);
    const d = v === "late" ? 2 : Math.abs((V_RANK[v] ?? 0) - (V_RANK[truth] ?? 0));
    finish({
      pts: d === 0 ? 2 : d === 1 ? 1 : 0, max: 2, ok: d === 0, timeout: v === "late",
      answer: `${truth === "real" ? "Real trend" : truth === "possible" ? "Maybe (possible)" : "Just noise"}${qv != null ? `, q = ${qv.toFixed(3)}` : ""}`,
      extra: series && row && meta ? (
        <TrendChart series={series} trend={row} unit={meta.unit.includes("°") ? "°F" : meta.unit} label={`${meta.label} · ${PERIOD_LABEL[q.period] ?? q.period}`} />
      ) : undefined,
    });
  };
  useEffect(() => { if (timeUp) end("late"); }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{sideLabel(atlas, side)}</div>
      {series ? <DotChart years={series.years} values={series.values} /> : <div style={{ opacity: 0.7, fontSize: 13 }}>Loading the dots…</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {V_OPTS.map((o) => (
          <button
            key={o.v}
            disabled={!!pick || !series}
            onClick={() => end(o.v)}
            style={optBtn(!pick ? "idle" : o.v === truth ? "good" : o.v === pick ? "bad" : "idle")}
          >
            <div style={{ fontSize: 22 }}>{o.emoji}</div>{o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Rank({ step, atlas, timeUp, done, finish }: GameProps) {
  const r = step.rank!;
  const [order, setOrder] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const val = (p: string) => shown(atlas, r.variable, cellOf(atlas, { parkId: p, variable: r.variable, period: r.period })?.sen ?? null) ?? 0;
  const truth = [...r.parks].sort((a, b) => val(b) - val(a));
  const right = order.filter((p, i) => truth[i] === p).length;
  const end = (timeout: boolean) => {
    if (locked || done) return;
    setLocked(true);
    finish({
      pts: timeout ? 0 : right, max: r.parks.length, ok: !timeout && right === r.parks.length, timeout,
      answer: truth.map((p, i) => `${i + 1}. ${parkName(p)}`).join("   "),
      extra: (
        <div style={{ fontSize: 13, display: "grid", gap: 2 }}>
          {truth.map((p) => <div key={p}>{parkName(p)}: {fmtRate(atlas, r.variable, val(p))}</div>)}
        </div>
      ),
    });
  };
  useEffect(() => { if (timeUp) end(true); }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Tap in order: fastest first.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {r.parks.map((p) => {
          const idx = order.indexOf(p);
          return (
            <button
              key={p}
              disabled={locked || idx >= 0}
              onClick={() => setOrder((o) => [...o, p])}
              style={optBtn(locked ? (truth[idx] === p ? "good" : "bad") : idx >= 0 ? "picked" : "idle")}
            >
              <div style={{ fontSize: 24, fontWeight: 900 }}>{idx >= 0 ? `#${idx + 1}` : "🏞️"}</div>
              <div style={{ fontWeight: 800 }}>{parkName(p)}</div>
            </button>
          );
        })}
      </div>
      {!locked && (
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...lockBtn, opacity: order.length === r.parks.length ? 1 : 0.35 }} disabled={order.length !== r.parks.length} onClick={() => end(false)}>
            Lock in
          </button>
          <button onClick={() => setOrder([])} style={{ ...lockBtn, background: "transparent", color: "#1f2a24", border: "1px solid rgba(0,0,0,.25)" }}>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function Myth({ step, atlas, timeUp, done, finish }: GameProps) {
  const m = step.myth!;
  const [pick, setPick] = useState<boolean | "late" | null>(null);
  void atlas;
  const end = (b: boolean | "late") => {
    if (pick != null || done) return;
    setPick(b);
    finish({ pts: b === m.isTrue ? 1 : 0, max: 1, ok: b === m.isTrue, timeout: b === "late", answer: m.isTrue ? "FACT" : "MYTH" });
  };
  useEffect(() => { if (timeUp) end("late"); }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          background: "rgba(255,255,255,.7)", border: "2px dashed rgba(0,0,0,.3)", borderRadius: 16,
          padding: "20px 22px", fontSize: 20, fontWeight: 800, textAlign: "center", lineHeight: 1.35,
        }}
      >
        “{step.body}”
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[true, false].map((b) => (
          <button
            key={String(b)}
            disabled={pick != null}
            onClick={() => end(b)}
            style={{ ...optBtn(pick == null ? "idle" : b === m.isTrue ? "good" : b === pick ? "bad" : "idle"), fontSize: 17 }}
          >
            {b ? "✅ Fact" : "🚫 Myth"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── The flip card ─────────────────────────────────────────────────────────

const FLIP_CSS = `
@keyframes qz-fade { from { opacity: 0 } to { opacity: 1 } }
.qz-overlay { animation: qz-fade .25s ease-out both }
.qz-inner { display: grid; transform-style: preserve-3d; transition: transform .75s cubic-bezier(.4,.1,.2,1) }
.qz-inner.flipped { transform: rotateY(180deg) }
.qz-face { grid-area: 1 / 1; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 22px; overflow: hidden }
.qz-back { transform: rotateY(180deg) }
@media (prefers-reduced-motion: reduce) { .qz-inner, .qz-overlay { transition: none; animation: none } }
`;

function TimerBar({ ms }: { ms: number }) {
  const hot = ms <= 2000;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }} aria-label={`${Math.ceil(ms / 1000)} seconds left`}>
      <div style={{ flex: 1, height: 10, borderRadius: 6, background: "rgba(0,0,0,.14)", overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(0, ms / (QUESTION_SECONDS * 1000)) * 100}%`, height: "100%",
            background: hot ? "#d9473a" : "#2a7d4f", transition: "width .1s linear, background .3s",
          }}
        />
      </div>
      <div style={{ fontWeight: 900, minWidth: 40, textAlign: "right", color: hot ? "#d9473a" : "inherit" }}>
        ⏱ {Math.ceil(ms / 1000)}
      </div>
    </div>
  );
}

const BITS = ["🎉", "⭐", "✨", "🌟", "🍃", "🎊"];
function Confetti() {
  return (
    <div style={{ position: "absolute", left: "50%", top: 70, pointerEvents: "none" }} aria-hidden>
      <style>{`@keyframes qz-fly { from { transform: translate(0,0) scale(.4); opacity: 1 } to { transform: translate(var(--dx), var(--dy)) rotate(var(--r)) scale(1.1); opacity: 0 } }`}</style>
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const d = 90 + (i % 3) * 40;
        return (
          <span
            key={i}
            style={{
              position: "absolute", fontSize: 22,
              "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px`, "--r": `${(i * 53) % 360}deg`,
              animation: `qz-fly 1s ease-out ${(i % 4) * 40}ms forwards`,
            } as React.CSSProperties}
          >
            {BITS[i % BITS.length]}
          </span>
        );
      })}
    </div>
  );
}

export default function QuizCard({
  step, atlas, caseId, index, isLast, onScore, onNext,
}: {
  step: Step; atlas: Atlas; caseId: string; index: number; isLast: boolean;
  onScore: (pts: number, max: number) => void; onNext: () => void;
}) {
  const t = themeFor(step, caseId);
  const anim = ANIMS[(index + caseId.length) % ANIMS.length];
  const [started, setStarted] = useState(false);
  const [ms, setMs] = useState(QUESTION_SECONDS * 1000);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [flipped, setFlipped] = useState(false);
  const data = useTrends(step.verdictQ?.parkId);
  const ready = !step.verdictQ || !!data;

  // Start the clock once the card has finished popping in (and its data is there).
  useEffect(() => {
    const id = setTimeout(() => setStarted(true), 650);
    return () => clearTimeout(id);
  }, []);
  const running = started && ready && !answer;
  useEffect(() => {
    if (!running || ms <= 0) return;
    const id = setTimeout(() => setMs((m) => m - 100), 100);
    return () => clearTimeout(id);
  }, [running, ms]);

  // Let the student see which option they picked, then flip.
  useEffect(() => {
    if (!answer) return;
    const id = setTimeout(() => setFlipped(true), answer.timeout ? 250 : 600);
    return () => clearTimeout(id);
  }, [answer]);

  const finish = (a: Answer) => {
    setAnswer(a);
    onScore(a.pts, a.max);
  };
  const gp: GameProps = { step, atlas, timeUp: running && ms <= 0, done: !!answer, finish };
  const didYouKnow = answer?.ok ? makeFact(step, atlas, index) : null;
  const partial = !!answer && !answer.ok && !answer.timeout && answer.pts > 0;
  const back = !answer
    ? { bg: "#fff", edge: "#999", emoji: "", head: "" }
    : answer.ok
      ? { bg: "linear-gradient(145deg,#e6f7ea,#b9e6c4)", edge: "#2a7d4f", emoji: "✅", head: "Correct!" }
      : answer.timeout
        ? { bg: "linear-gradient(145deg,#fff3d6,#ffd98f)", edge: "#c98a12", emoji: "⏰", head: "Time's up! No point this round." }
        : partial
          ? { bg: "linear-gradient(145deg,#fff3d6,#ffe3a8)", edge: "#c98a12", emoji: "🟡", head: `So close! ${answer.pts} of ${answer.max} points.` }
          : { bg: "linear-gradient(145deg,#fde4e4,#f5b5b5)", edge: "#c0392b", emoji: "❌", head: "Not quite." };

  return createPortal(
    <div
      className="qz-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={step.heading}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,25,20,.42)",
        backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto",
      }}
    >
      <style>{CARD_CSS + FLIP_CSS}</style>
      <div className={`dc-card ${anim}`} style={{ width: "min(660px, 100%)", margin: "auto" }}>
        <div className={`qz-inner ${flipped ? "flipped" : ""}`}>
          {/* FRONT */}
          <div
            className="qz-face"
            style={{
              background: `linear-gradient(145deg, ${t.from}, ${t.to})`, border: `2px solid ${t.edge}`,
              boxShadow: `0 10px 0 -4px ${t.edge}55, 0 24px 48px rgba(0,0,0,.28)`, color: "#1f2a24",
              padding: "26px 24px", minHeight: 380, display: "flex", flexDirection: "column", gap: 16, position: "relative",
              pointerEvents: flipped ? "none" : "auto",
            }}
          >
            <span aria-hidden style={{ position: "absolute", right: 16, top: 44, fontSize: 70, opacity: 0.18 }}>{t.emoji[0]}</span>
            {!answer ? <TimerBar ms={ms} /> : <div style={{ height: 10 }} />}
            <div style={{ position: "relative" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>{step.heading}</h3>
              {step.kind !== "myth" && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{step.body}</p>}
            </div>
            <div style={{ position: "relative" }}>
              {step.kind === "duel" && <Duel {...gp} />}
              {step.kind === "hunt" && <Hunt {...gp} />}
              {step.kind === "guess" && <Guess {...gp} />}
              {step.kind === "verdict" && <VerdictGame {...gp} />}
              {step.kind === "rank" && <Rank {...gp} />}
              {step.kind === "myth" && <Myth {...gp} />}
            </div>
          </div>

          {/* BACK */}
          <div
            className="qz-face qz-back"
            style={{
              background: back.bg, border: `2px solid ${back.edge}`, color: "#1f2a24",
              boxShadow: "0 24px 48px rgba(0,0,0,.28)", padding: "26px 24px", minHeight: 380,
              display: "flex", flexDirection: "column", gap: 12, position: "relative",
              pointerEvents: flipped ? "auto" : "none",
            }}
          >
            {flipped && answer?.ok && <Confetti />}
            <div style={{ fontSize: 46, lineHeight: 1 }}>{back.emoji}</div>
            <h3 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>{back.head}</h3>
            {answer && (
              <div style={{ background: "rgba(255,255,255,.65)", borderRadius: 12, padding: "10px 14px", fontSize: 15 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.65 }}>
                  {answer.ok ? "The answer" : "The correct answer"}
                </div>
                <div style={{ fontWeight: 800 }}>{answer.answer}</div>
              </div>
            )}
            {answer?.extra}
            {answer && explain(step, atlas) && (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{explain(step, atlas)}</p>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onNext} style={lockBtn}>{isLast ? "Finish case 🏁" : "Next →"}</button>
            {didYouKnow && (
              <div style={{ borderTop: "1px solid rgba(0,0,0,.18)", paddingTop: 10, fontSize: 12.5, lineHeight: 1.5 }}>
                <b>💡 Did you know?</b> {didYouKnow.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

