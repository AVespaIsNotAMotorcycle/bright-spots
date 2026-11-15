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
const MONTH_NAME = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SEASON_NAME: Record<string, string> = { DJF: "winter", MAM: "spring", JJA: "summer", SON: "autumn" };

function seedOf(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Builds a "did you know" line from the atlas. Every number comes from the atlas.
 * Each question gets a different kind of fact (fastest month, best season, how it compares
 * with the national middle, a look-alike park, its rain story...), picked by a seed, so
 * facts do not repeat from card to card.
 */
export function makeFact(step: Step, atlas: Atlas, variant: number): DataFact | null {
  const side = subjectSide(step, atlas);
  if (!side) return null;
  const meta = atlas.variables[side.variable];
  const cells = (atlas.atlas[side.variable]?.[side.period] ?? []).filter((c) => c.sen != null);
  const cell = cellOf(atlas, side);
  if (!meta || !cell || cell.sen == null || !cells.length) return null;
  const name = parkName(side.parkId);
  const temp = isTempVar(atlas, side.variable);
  const unit = temp ? "°F" : meta.unit;
  const conv = (x: number) => (temp ? x * 1.8 : x);
  const num = (x: number) => {
    const a = Math.abs(x);
    return a >= 10 ? a.toFixed(0) : a >= 1 ? a.toFixed(1) : a.toFixed(2);
  };
  const amt = (x: number) => (temp ? `${num(x)}°F` : `${num(x)} ${unit}`);
  const label = meta.label.toLowerCase();
  const per = PERIOD_LABEL[side.period] ?? side.period;
  const sen = (v: string, period: string, park = side.parkId) =>
    atlas.atlas[v]?.[period]?.find((c) => c.park_id === park)?.sen ?? null;

  const pool: (() => string | null)[] = [
    // Which month changes fastest at this park, for this variable.
    () => {
      const months = Array.from({ length: 12 }, (_, i) => ({ m: i, s: sen(side.variable, String(i + 1)) }))
        .filter((x): x is { m: number; s: number } => x.s != null);
      if (months.length < 6) return null;
      const top = months.reduce((a, b) => (Math.abs(b.s) > Math.abs(a.s) ? b : a));
      return `At ${name}, ${MONTH_NAME[top.m]} changes the most: ${label} there moves about ${amt(conv(top.s))} per decade.`;
    },
    // Which season changes fastest.
    () => {
      const seasons = Object.keys(SEASON_NAME)
        .map((k) => ({ k, s: sen(side.variable, k) }))
        .filter((x): x is { k: string; s: number } => x.s != null);
      if (seasons.length < 4) return null;
      const top = seasons.reduce((a, b) => (Math.abs(b.s) > Math.abs(a.s) ? b : a));
      const low = seasons.reduce((a, b) => (Math.abs(b.s) < Math.abs(a.s) ? b : a));
      return `${name} changes fastest in ${SEASON_NAME[top.k]} and slowest in ${SEASON_NAME[low.k]}.`;
    },
    // Compared with the national middle.
    () => {
      const sorted = cells.map((c) => c.sen!).sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)];
      if (!mid) return null;
      const ratio = cell.sen! / mid;
      if (!Number.isFinite(ratio) || ratio <= 0) return null;
      if (ratio >= 1.4) return `${name} is changing about ${ratio.toFixed(1)} times as fast as the middle park in the country.`;
      if (ratio <= 0.7) return `${name} is changing at about ${Math.round(ratio * 100)}% of the speed of the middle park in the country.`;
      return `${name} sits close to the national middle: about ${amt(conv(cell.sen!))} per decade, the middle park is ${amt(conv(mid))}.`;
    },
    // Total change since 1981.
    () => `Since 1981, ${per.toLowerCase()} ${label} at ${name} moved about ${amt(conv(cell.sen!) * (YEARS / 10))} in total.`,
    // A look-alike park.
    () => {
      const twin = cells
        .filter((c) => c.park_id !== side.parkId)
        .reduce((a, b) => (Math.abs(b.sen! - cell.sen!) < Math.abs(a.sen! - cell.sen!) ? b : a), cells.find((c) => c.park_id !== side.parkId)!);
      if (!twin) return null;
      return `Trend twin: ${parkName(twin.park_id)} changes almost exactly as fast as ${name} (${amt(conv(twin.sen!))} vs ${amt(conv(cell.sen!))} per decade).`;
    },
    // Its rain story, when the question was about heat (or its heat story, for rain questions).
    () => {
      const other = side.variable.startsWith("prcp") ? "tmax_c" : "prcp_mm";
      const o = sen(other, "annual");
      if (o == null) return null;
      if (other === "prcp_mm") {
        return `Rain check: ${name} gets about ${num(o)} mm ${o >= 0 ? "more" : "less"} rain each decade.`;
      }
      return `Heat check: the daytime high at ${name} moves about ${amt(o * 1.8)} per decade.`;
    },
    // National count for this question's variable.
    () => {
      const real = cells.filter((c) => c.verdict === "real").length;
      const up = cells.filter((c) => (c.sen ?? 0) > 0).length;
      return `Across ${cells.length} parks, ${up} lean upward for ${per.toLowerCase()} ${label}, and ${real} have a confirmed trend.`;
    },
    // Rank, with a word.
    () => {
      const sorted = [...cells].sort((a, b) => b.sen! - a.sen!);
      const r = sorted.findIndex((c) => c.park_id === side.parkId) + 1;
      const word = r <= 5 ? "top five" : r > cells.length - 5 ? "bottom five" : r <= cells.length / 2 ? "upper half" : "lower half";
      return `${name} ranks #${r} of ${cells.length} for ${per.toLowerCase()} ${label}, in the ${word}.`;
    },
  ];

  const seed = seedOf(`${step.heading}|${side.parkId}|${side.variable}|${side.period}`) + variant * 3;
  for (let i = 0; i < pool.length; i++) {
    const text = pool[(seed + i) % pool.length]();
    if (text) return { emoji: "💡", title: name, text };
  }
  return null;
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
