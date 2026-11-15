// Interactive mini-games used inside detective cases.
// Every answer is computed from the live atlas, so the reveal can never drift from the data.
import { useEffect, useState } from "react";
import type { Atlas, AtlasCell, ParkTrends } from "./model";
import { PERIOD_LABEL } from "./model";
import { PARK_NAMES } from "./Detective";
import type { Side, Step } from "./cases";

// ── Data helpers ───────────────────────────────────────────────────────────

export function cellOf(atlas: Atlas, s: Side): AtlasCell | null {
  return atlas.atlas[s.variable]?.[s.period]?.find((c) => c.park_id === s.parkId) ?? null;
}

export const isTempVar = (atlas: Atlas, v: string) => (atlas.variables[v]?.unit ?? "").includes("°");

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
export function useTrends(parkId: string | undefined): ParkTrends | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!parkId || trendCache[parkId]) return;
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
  return parkId ? (trendCache[parkId] ?? null) : null;
}

export const GAME_KINDS = ["duel", "hunt", "guess", "verdict", "rank", "myth"] as const;
export const QUESTION_SECONDS = 5;

// ── Data facts shown between questions ────────────────────────────────────

export interface DataFact { emoji: string; title: string; text: string }

function subjectSide(step: Step, atlas: Atlas): Side | null {
  const best = (sides: Side[], max = true) => {
    const v = (s: Side) => shown(atlas, s.variable, cellOf(atlas, s)?.sen ?? null) ?? 0;
    return [...sides].sort((a, b) => (max ? v(b) - v(a) : v(a) - v(b)))[0] ?? null;
  };
  if (step.duel) return best([step.duel.a, step.duel.b], step.duel.pick !== "slower");
  if (step.hunt) {
    const h = step.hunt;
    return best(h.parks.map((p) => ({ parkId: p, variable: h.variable, period: h.period })), h.pick === "max");
  }
  if (step.rank) {
    const r = step.rank;
    return best(r.parks.map((p) => ({ parkId: p, variable: r.variable, period: r.period })));
  }
  if (step.guess) return { parkId: step.guess.parkId, variable: step.guess.variable, period: step.guess.period };
  if (step.verdictQ) return step.verdictQ;
  return null;
}

const YEARS = 45;

/** Builds a "did you know" card from the atlas. `variant` alternates park facts and nationwide facts. */
export function makeFact(step: Step, atlas: Atlas, variant: number): DataFact | null {
  const side = subjectSide(step, atlas);
  if (!side) return null;
  const meta = atlas.variables[side.variable];
  const cells = (atlas.atlas[side.variable]?.[side.period] ?? []).filter((c) => c.sen != null);
  const cell = cellOf(atlas, side);
  if (!meta || !cell || cell.sen == null || !cells.length) return null;
  const per = PERIOD_LABEL[side.period] ?? side.period;
  const label = meta.label.toLowerCase();
  const temp = isTempVar(atlas, side.variable);
  const v = shown(atlas, side.variable, cell.sen)!;
  const total = v * (YEARS / 10);
  const unit = temp ? "°F" : meta.unit;
  const amt = (x: number) => `${x > 0 ? "+" : ""}${Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(1)} ${unit}`;

  if (variant % 2 === 0) {
    const sorted = [...cells].sort((a, b) => (b.sen ?? 0) - (a.sen ?? 0));
    const rank = sorted.findIndex((c) => c.park_id === side.parkId) + 1;
    const real = cell.verdict === "real" ? "a statistically real trend" : cell.verdict === "possible" ? "a possible trend" : "no confirmed trend";
    return {
      emoji: "💡",
      title: `${parkName(side.parkId)}, in numbers`,
      text:
        `Since 1981, ${per.toLowerCase()} ${label} at ${parkName(side.parkId)} moved about ${amt(total)}. ` +
        `That ranks #${rank} of ${cells.length} parks, and the test calls it ${real}.`,
    };
  }
  const real = cells.filter((c) => c.verdict === "real").length;
  const poss = cells.filter((c) => c.verdict === "possible").length;
  const up = cells.filter((c) => (c.sen ?? 0) > 0).length;
  return {
    emoji: "🌎",
    title: "Across all parks",
    text:
      `For ${per.toLowerCase()} ${label}, ${real} of ${cells.length} parks show a real trend and ${poss} more show a possible one. ` +
      `${up} lean upward, ${cells.length - up} lean downward. Source: NASA satellite and climate records, 1981 to now.`,
  };
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

// ── Streaks: days in a row, and best run of right answers ─────────────────

const DAYS_KEY = "detective.days";
const BEST_KEY = "detective.bestStreak";
const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

interface DaysState { last: string; count: number }

function readDays(): DaysState {
  try {
    return JSON.parse(localStorage.getItem(DAYS_KEY) ?? "") as DaysState;
  } catch {
    return { last: "", count: 0 };
  }
}

/** Days in a row the student has played. Zero once a day has been missed. */
export function dayStreak(now = new Date()): number {
  const s = readDays();
  return s.last === dayStr(now) || s.last === dayStr(addDays(now, -1)) ? s.count : 0;
}

/** Call after any answer. Counts today once. */
export function touchToday(now = new Date()) {
  const s = readDays();
  const today = dayStr(now);
  if (s.last === today) return;
  const count = s.last === dayStr(addDays(now, -1)) ? s.count + 1 : 1;
  try {
    localStorage.setItem(DAYS_KEY, JSON.stringify({ last: today, count }));
  } catch {
    /* private mode: ignore */
  }
}

export const bestAnswerStreak = (): number => Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;

export function noteAnswerStreak(n: number) {
  try {
    if (n > bestAnswerStreak()) localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* private mode: ignore */
  }
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
