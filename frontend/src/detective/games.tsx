// Interactive mini-games used inside detective cases.
// Every answer is computed from the live atlas, so the reveal can never drift from the data.
import { Fragment, useEffect, useState } from "react";
import type { Atlas, AtlasCell, ParkTrends, Verdict } from "./model";
import { PERIOD_LABEL } from "./model";
import { PARK_NAMES } from "./Detective";
import TrendChart from "./TrendChart";
import type { Side, Step } from "./cases";

// ── Data helpers ───────────────────────────────────────────────────────────

export function cellOf(atlas: Atlas, s: Side): AtlasCell | null {
  return atlas.atlas[s.variable]?.[s.period]?.find((c) => c.park_id === s.parkId) ?? null;
}

const isTempVar = (atlas: Atlas, v: string) => (atlas.variables[v]?.unit ?? "").includes("°");

/** Slope per decade in the unit the student sees (°F for temperatures). */
export function shown(atlas: Atlas, variable: string, sen: number | null): number | null {
  if (sen == null) return null;
  return isTempVar(atlas, variable) ? sen * 1.8 : sen;
}

export function fmtRate(atlas: Atlas, variable: string, v: number | null): string {
  if (v == null) return "no data";
  const sign = v > 0 ? "+" : "";
  if (isTempVar(atlas, variable)) return `${sign}${v.toFixed(2)} °F per decade`;
  const unit = atlas.variables[variable]?.unit ?? "";
  return `${sign}${Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)} ${unit} per decade`;
}

export const parkName = (id: string) => PARK_NAMES[id] ?? id;

export const sideLabel = (atlas: Atlas, s: Side) =>
  `${parkName(s.parkId)} · ${atlas.variables[s.variable]?.label ?? s.variable} · ${PERIOD_LABEL[s.period] ?? s.period}`;

const trendCache: Record<string, ParkTrends> = {};
function useTrends(parkId: string): ParkTrends | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (trendCache[parkId]) return;
    let live = true;
    fetch(`/api/trends/parks/${parkId}`)
      .then((r) => r.json() as Promise<ParkTrends>)
      .then((d) => {
        trendCache[parkId] = d;
        if (live) tick((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [parkId]);
  return trendCache[parkId] ?? null;
}

// ── Shared bits ────────────────────────────────────────────────────────────

const CSS = `
@keyframes dg-pop { 0% { transform: scale(.6); opacity: 0 } 60% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
@keyframes dg-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }
@keyframes dg-fly { 0% { transform: translate(0,0) scale(.4); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--r)) scale(1.1); opacity: 0 } }
.dg-pop { animation: dg-pop .35s ease-out both }
.dg-shake { animation: dg-shake .35s ease-in-out }
.dg-btn { transition: transform .12s, box-shadow .12s, border-color .12s }
.dg-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(0,0,0,.12) }
.dg-confetti { position: relative; height: 0; overflow: visible; pointer-events: none }
.dg-confetti span { position: absolute; left: 50%; top: 0; font-size: 20px; animation: dg-fly 1s ease-out forwards }
@media (prefers-reduced-motion: reduce) { .dg-pop,.dg-shake,.dg-confetti span { animation: none } }
`;

function Styles() {
  return <style>{CSS}</style>;
}

const BITS = ["🎉", "⭐", "✨", "🌟", "🍃", "🎊", "🔥", "💎"];
function Confetti() {
  return (
    <div className="dg-confetti" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const d = 70 + (i % 3) * 30;
        return (
          <span
            key={i}
            style={
              {
                "--dx": `${Math.cos(a) * d}px`,
                "--dy": `${Math.sin(a) * d - 20}px`,
                "--r": `${(i * 47) % 360}deg`,
                animationDelay: `${(i % 4) * 40}ms`,
              } as React.CSSProperties
            }
          >
            {BITS[i % BITS.length]}
          </span>
        );
      })}
    </div>
  );
}

function Reveal({ ok, head, children }: { ok: boolean; head: string; children?: React.ReactNode }) {
  return (
    <>
      {ok && <Confetti />}
      <div
        className={`dg-pop ${ok ? "" : "dg-shake"}`}
        style={{
          background: ok ? "#d4edda" : "#fff3cd",
          border: `1px solid ${ok ? "#2a7d4f" : "#b8860b"}`,
          color: "#222",
          borderRadius: 10,
          padding: "14px 16px",
          fontSize: 14,
          lineHeight: 1.6,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <strong>{head}</strong>
        {children}
      </div>
    </>
  );
}

const primary: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--on-accent)",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
  alignSelf: "flex-start",
};

const optBtn = (state: "idle" | "picked" | "good" | "bad"): React.CSSProperties => ({
  background: state === "good" ? "#d4edda" : state === "bad" ? "#f8d7da" : state === "picked" ? "var(--accent-tint)" : "var(--surface)",
  color: state === "good" ? "#155724" : state === "bad" ? "#721c24" : "inherit",
  border: `2px solid ${state === "good" ? "#2a7d4f" : state === "bad" ? "#c0392b" : state === "picked" ? "var(--accent)" : "var(--border)"}`,
  borderRadius: 12,
  padding: "14px 16px",
  cursor: "pointer",
  textAlign: "left",
  fontSize: 14,
  fontWeight: state === "idle" ? 400 : 600,
});

function factText(step: Step, atlas: Atlas): string {
  const f = step.fact;
  return typeof f === "function" ? f(atlas) : (f ?? "");
}

interface GameProps {
  step: Step;
  atlas: Atlas;
  /** Called once when the student locks an answer. */
  onScore: (pts: number, max: number) => void;
  onNext: () => void;
  nextLabel: string;
}

function NextBtn({ onNext, label }: { onNext: () => void; label: string }) {
  return (
    <button onClick={onNext} style={primary}>
      {label}
    </button>
  );
}

// ── Duel: which side is moving faster? ─────────────────────────────────────

function Duel({ step, atlas, onScore, onNext, nextLabel }: GameProps) {
  const d = step.duel!;
  const [pick, setPick] = useState<"a" | "b" | null>(null);
  const va = shown(atlas, d.a.variable, cellOf(atlas, d.a)?.sen ?? null) ?? 0;
  const vb = shown(atlas, d.b.variable, cellOf(atlas, d.b)?.sen ?? null) ?? 0;
  const slower = d.pick === "slower";
  const winner: "a" | "b" = (va > vb) !== slower ? "a" : "b";
  const ok = pick === winner;

  function choose(s: "a" | "b") {
    if (pick) return;
    setPick(s);
    onScore(s === winner ? 1 : 0, 1);
  }
  const sides = [
    { k: "a" as const, s: d.a, v: va },
    { k: "b" as const, s: d.b, v: vb },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Styles />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{step.body}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "stretch" }}>
        {sides.map(({ k, s, v }, i) => (
          <Fragment key={k}>
            {i === 1 && (
              <div style={{ alignSelf: "center", fontWeight: 800, color: "var(--text-muted)" }}>
                VS
              </div>
            )}
            <button
              className="dg-btn"
              disabled={!!pick}
              onClick={() => choose(k)}
              style={{ ...optBtn(!pick ? "idle" : k === winner ? "good" : k === pick ? "bad" : "idle"), textAlign: "center" }}
            >
              <div style={{ fontSize: 17, fontWeight: 700 }}>{parkName(s.parkId)}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {atlas.variables[s.variable]?.label} · {PERIOD_LABEL[s.period] ?? s.period}
              </div>
              {pick && <div style={{ marginTop: 8, fontSize: 13 }}>{fmtRate(atlas, s.variable, v)}</div>}
            </button>
          </Fragment>
        ))}
      </div>
      {pick && (
        <Reveal ok={ok} head={ok ? "✓ Sharp eye!" : "✗ Close, but no."}>
          <span>{factText(step, atlas)}</span>
        </Reveal>
      )}
      {pick && <NextBtn onNext={onNext} label={nextLabel} />}
    </div>
  );
}

// ── Hunt: pick the park that wins from a line-up ──────────────────────────

function Hunt({ step, atlas, onScore, onNext, nextLabel }: GameProps) {
  const h = step.hunt!;
  const [pick, setPick] = useState<string | null>(null);
  const side = (p: string): Side => ({ parkId: p, variable: h.variable, period: h.period });
  const val = (p: string) => shown(atlas, h.variable, cellOf(atlas, side(p))?.sen ?? null) ?? 0;
  const sorted = [...h.parks].sort((x, y) => (h.pick === "max" ? val(y) - val(x) : val(x) - val(y)));
  const winner = sorted[0];
  const ok = pick === winner;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Styles />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{step.body}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {h.parks.map((p) => (
          <button
            key={p}
            className="dg-btn"
            disabled={!!pick}
            onClick={() => {
              setPick(p);
              onScore(p === winner ? 2 : 0, 2);
            }}
            style={{ ...optBtn(!pick ? "idle" : p === winner ? "good" : p === pick ? "bad" : "idle"), textAlign: "center" }}
          >
            <div style={{ fontSize: 22 }}>🏞️</div>
            <div style={{ fontWeight: 700 }}>{parkName(p)}</div>
            {pick && <div style={{ fontSize: 12, marginTop: 4 }}>{fmtRate(atlas, h.variable, val(p))}</div>}
          </button>
        ))}
      </div>
      {pick && (
        <Reveal ok={ok} head={ok ? `✓ ${parkName(winner)}!` : `✗ It was ${parkName(winner)}.`}>
          <span>{factText(step, atlas)}</span>
        </Reveal>
      )}
      {pick && <NextBtn onNext={onNext} label={nextLabel} />}
    </div>
  );
}

// ── Guess: slide to your estimate ─────────────────────────────────────────

function Guess({ step, atlas, onScore, onNext, nextLabel }: GameProps) {
  const g = step.guess!;
  const side: Side = { parkId: g.parkId, variable: g.variable, period: g.period };
  const truth = shown(atlas, g.variable, cellOf(atlas, side)?.sen ?? null) ?? 0;
  const [val, setVal] = useState((g.min + g.max) / 2);
  const [locked, setLocked] = useState(false);
  const range = g.max - g.min;
  const err = Math.abs(val - truth) / range;
  const pts = err <= 0.08 ? 3 : err <= 0.18 ? 2 : err <= 0.3 ? 1 : 0;
  const label = (v: number) => fmtRate(atlas, g.variable, v);
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - g.min) / range) * 100))}%`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Styles />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{step.body}</p>
      <div style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: "var(--accent)" }}>{label(val)}</div>
      <div style={{ position: "relative", padding: "10px 0" }}>
        <input
          type="range"
          min={g.min}
          max={g.max}
          step={g.step}
          value={val}
          disabled={locked}
          onChange={(e) => setVal(Number(e.target.value))}
          style={{ width: "100%" }}
          aria-label="Your guess"
        />
        {locked && (
          <div
            className="dg-pop"
            style={{ position: "absolute", left: pct(truth), top: -8, transform: "translateX(-50%)", fontSize: 22 }}
            title="Real answer"
          >
            🎯
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
        <span>{label(g.min)}</span>
        <span>{label(g.max)}</span>
      </div>
      {!locked && (
        <button
          style={primary}
          onClick={() => {
            setLocked(true);
            onScore(pts, 3);
          }}
        >
          Lock in my guess
        </button>
      )}
      {locked && (
        <Reveal
          ok={pts >= 2}
          head={`${"⭐".repeat(pts) || "·"}  Real answer: ${label(truth)}. You said ${label(val)}.`}
        >
          <span>{factText(step, atlas)}</span>
        </Reveal>
      )}
      {locked && <NextBtn onNext={onNext} label={nextLabel} />}
    </div>
  );
}

// ── Verdict: real, maybe, or just noise? ──────────────────────────────────

function DotChart({ years, values }: { years: number[]; values: number[] }) {
  const W = 560, H = 190, P = 28;
  const lo = Math.min(...values), hi = Math.max(...values);
  const x = (y: number) => P + ((y - years[0]) / (years[years.length - 1] - years[0] || 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Yearly values, no trend line">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--border)" />
      {values.map((v, i) => (
        <circle key={i} cx={x(years[i])} cy={y(v)} r={4} fill="var(--accent)" opacity={0.85} />
      ))}
      <text x={P} y={H - 8} fontSize="11" fill="var(--text-muted)">{years[0]}</text>
      <text x={W - P} y={H - 8} fontSize="11" textAnchor="end" fill="var(--text-muted)">{years[years.length - 1]}</text>
    </svg>
  );
}

const V_OPTS: { v: Verdict; label: string; emoji: string }[] = [
  { v: "real", label: "Real trend", emoji: "📈" },
  { v: "possible", label: "Maybe, not sure", emoji: "🤔" },
  { v: "none", label: "Just noise", emoji: "🎲" },
];
const V_RANK: Record<string, number> = { none: 0, possible: 1, real: 2 };

function VerdictGame({ step, atlas, onScore, onNext, nextLabel }: GameProps) {
  const q = step.verdictQ!;
  const side: Side = { parkId: q.parkId, variable: q.variable, period: q.period };
  const data = useTrends(q.parkId);
  const [pick, setPick] = useState<Verdict | null>(null);
  const truth = cellOf(atlas, side)?.verdict ?? "none";
  const series = data?.series[q.variable]?.[q.period];
  const row = data?.trends.find((t) => t.variable === q.variable && t.period === q.period);
  const diff = pick ? Math.abs((V_RANK[pick] ?? 0) - (V_RANK[truth] ?? 0)) : 0;
  const ok = pick === truth;
  const meta = atlas.variables[q.variable];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Styles />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{step.body}</p>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{sideLabel(atlas, side)}</div>
        {!series && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading the dots…</div>}
        {series && !pick && <DotChart years={series.years} values={series.values} />}
        {series && pick && row && meta && (
          <TrendChart
            series={series}
            trend={row}
            unit={meta.unit.includes("°") ? "°F" : meta.unit}
            label={`${meta.label} · ${PERIOD_LABEL[q.period] ?? q.period}`}
          />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {V_OPTS.map((o) => (
          <button
            key={o.v}
            className="dg-btn"
            disabled={!!pick || !series}
            onClick={() => {
              setPick(o.v);
              const d = Math.abs((V_RANK[o.v] ?? 0) - (V_RANK[truth] ?? 0));
              onScore(d === 0 ? 2 : d === 1 ? 1 : 0, 2);
            }}
            style={{ ...optBtn(!pick ? "idle" : o.v === truth ? "good" : o.v === pick ? "bad" : "idle"), textAlign: "center" }}
          >
            <div style={{ fontSize: 24 }}>{o.emoji}</div>
            {o.label}
          </button>
        ))}
      </div>
      {pick && (
        <Reveal
          ok={ok}
          head={ok ? "✓ Verdict matches." : diff === 1 ? "~ Half right." : "✗ Missed it."}
        >
          <span>
            The test says <b>{truth === "real" ? "real" : truth === "possible" ? "possible" : "no trend"}</b>
            {cellOf(atlas, side)?.q != null && <> (q = {cellOf(atlas, side)!.q!.toFixed(3)})</>}. {factText(step, atlas)}
          </span>
        </Reveal>
      )}
      {pick && <NextBtn onNext={onNext} label={nextLabel} />}
    </div>
  );
}

// ── Rank: tap in order, highest first ─────────────────────────────────────

function Rank({ step, atlas, onScore, onNext, nextLabel }: GameProps) {
  const r = step.rank!;
  const [order, setOrder] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const side = (p: string): Side => ({ parkId: p, variable: r.variable, period: r.period });
  const val = (p: string) => shown(atlas, r.variable, cellOf(atlas, side(p))?.sen ?? null) ?? 0;
  const truth = [...r.parks].sort((a, b) => val(b) - val(a));
  const right = order.filter((p, i) => truth[i] === p).length;
  const ok = right === r.parks.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Styles />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{step.body}</p>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tap the parks in order: fastest first.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {r.parks.map((p) => {
          const idx = order.indexOf(p);
          const good = locked && truth[idx] === p;
          return (
            <button
              key={p}
              className="dg-btn"
              disabled={locked || idx >= 0}
              onClick={() => setOrder((o) => [...o, p])}
              style={{ ...optBtn(locked ? (good ? "good" : "bad") : idx >= 0 ? "picked" : "idle"), textAlign: "center" }}
            >
              <div style={{ fontSize: 22 }}>{idx >= 0 ? `#${idx + 1}` : "🏞️"}</div>
              <div style={{ fontWeight: 700 }}>{parkName(p)}</div>
              {locked && <div style={{ fontSize: 12, marginTop: 4 }}>{fmtRate(atlas, r.variable, val(p))}</div>}
            </button>
          );
        })}
      </div>
      {!locked && (
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{ ...primary, opacity: order.length === r.parks.length ? 1 : 0.4 }}
            disabled={order.length !== r.parks.length}
            onClick={() => {
              setLocked(true);
              onScore(right, r.parks.length);
            }}
          >
            Lock in my ranking
          </button>
          <button
            onClick={() => setOrder([])}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 14 }}
          >
            Start over
          </button>
        </div>
      )}
      {locked && (
        <Reveal ok={ok} head={ok ? "✓ Perfect order!" : `${right} of ${r.parks.length} in the right spot.`}>
          <span>Right order: {truth.map(parkName).join(" › ")}. {factText(step, atlas)}</span>
        </Reveal>
      )}
      {locked && <NextBtn onNext={onNext} label={nextLabel} />}
    </div>
  );
}

// ── Myth: true or false? ──────────────────────────────────────────────────

function Myth({ step, atlas, onScore, onNext, nextLabel }: GameProps) {
  const m = step.myth!;
  const [pick, setPick] = useState<boolean | null>(null);
  const ok = pick === m.isTrue;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Styles />
      <div
        style={{
          background: "var(--accent-tint)",
          border: "2px dashed var(--accent)",
          borderRadius: 14,
          padding: "18px 20px",
          fontSize: 18,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        “{step.body}”
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[true, false].map((b) => (
          <button
            key={String(b)}
            className="dg-btn"
            disabled={pick != null}
            onClick={() => {
              setPick(b);
              onScore(b === m.isTrue ? 1 : 0, 1);
            }}
            style={{ ...optBtn(pick == null ? "idle" : b === m.isTrue ? "good" : b === pick ? "bad" : "idle"), textAlign: "center", fontSize: 16 }}
          >
            {b ? "✅ Fact" : "🚫 Myth"}
          </button>
        ))}
      </div>
      {pick != null && (
        <Reveal ok={ok} head={ok ? "✓ Myth-buster!" : "✗ Fooled you."}>
          <span>{factText(step, atlas)}</span>
        </Reveal>
      )}
      {pick != null && <NextBtn onNext={onNext} label={nextLabel} />}
    </div>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────

export const GAME_KINDS = ["duel", "hunt", "guess", "verdict", "rank", "myth"] as const;

export function GameStep(props: GameProps) {
  switch (props.step.kind) {
    case "duel": return <Duel {...props} />;
    case "hunt": return <Hunt {...props} />;
    case "guess": return <Guess {...props} />;
    case "verdict": return <VerdictGame {...props} />;
    case "rank": return <Rank {...props} />;
    case "myth": return <Myth {...props} />;
    default: return null;
  }
}

// ── Progress (stars, XP, rank title), kept in localStorage ────────────────

export interface CaseResult { pts: number; max: number; stars: number }
const KEY = "detective.progress";

export function loadProgress(): Record<string, CaseResult> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveResult(caseId: string, pts: number, max: number): CaseResult {
  const pct = max ? pts / max : 1;
  const stars = pct >= 0.85 ? 3 : pct >= 0.6 ? 2 : 1;
  const all = loadProgress();
  const prev = all[caseId];
  if (!prev || stars * 1000 + pts > prev.stars * 1000 + prev.pts) all[caseId] = { pts, max, stars };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode: ignore */
  }
  return { pts, max, stars };
}

export function rankTitle(totalStars: number): { title: string; emoji: string; next: number | null } {
  const tiers: [number, string, string][] = [
    [0, "Trail Rookie", "🥾"],
    [4, "Data Tracker", "🧭"],
    [10, "Park Ranger", "🦌"],
    [18, "Climate Sleuth", "🔎"],
    [28, "Chief Detective", "🏅"],
  ];
  let cur = tiers[0], nxt: number | null = tiers[1][0];
  tiers.forEach((t, i) => {
    if (totalStars >= t[0]) {
      cur = t;
      nxt = tiers[i + 1]?.[0] ?? null;
    }
  });
  return { title: cur[1], emoji: cur[2], next: nxt };
}
