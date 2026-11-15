// Trip planner model: seasons, feel bands, chips, moods, state <-> URL, and the API call.
// Backend: GET /api/parks/trip (backend/app/parks/trip.py).
import type { Park } from "../model";

export type Level = "nice" | "must";
export type HorizonKey = "this_year" | "next_year" | "y2050";
export type Unit = "F" | "C";

export interface Reason {
  key: string;
  kind: "feel" | "want" | "avoid" | "base";
  level: Level;
  score: number | null;
  value: number | null;
  /** Weight in the score: daytime high 2, must 1.5, nice 1. */
  weight?: number;
  /** "See change happen": the FDR q-value and verdict behind it. */
  q?: number | null;
  verdict?: string | null;
}

export interface TripPark {
  park: Park;
  ok: boolean;
  best_month: number;
  score: number | null;
  failed: string[];
  relax: string[];
  reasons: Reason[];
  scores: Record<HorizonKey, number | null>;
  values: Record<HorizonKey, Record<string, number | null>>;
  month_scores: { score: number | null; ok: boolean }[];
  best_now: number | null;
  best_2050: number | null;
  change_2050: number | null;
  day_length: number;
  night_glow?: { glow: number; level: "low" | "medium" | "high"; why: string } | null;
  fire_source: string | null;
  /** 0-1 fit of each factor (temperature, rain, gray, muggy, and any picked chip) in the best month, per horizon. */
  fits?: Record<HorizonKey, Record<string, number>>;
}

export interface Trip {
  months: number[];
  horizon: HorizonKey;
  this_year: number;
  next_year: number;
  scenario: string;
  matches: number;
  relax: { key: string; parks: number }[];
  new_moons: Record<string, number[]>;
  sources: Record<string, string>;
  parks: TripPark[];
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface Season { id: string; label: string; emoji: string; months: number[]; color: string; tint: string; ink: string }
export const SEASONS: Season[] = [
  { id: "winter", label: "Winter", emoji: "❄️", months: [12, 1, 2], color: "#5b7f99", tint: "#dfe9f0", ink: "#24465e" },
  { id: "spring", label: "Spring", emoji: "🌱", months: [3, 4, 5], color: "#5f8f3e", tint: "#e3eed4", ink: "#2f5419" },
  { id: "summer", label: "Summer", emoji: "☀️", months: [6, 7, 8], color: "#c99a2e", tint: "#f6ebcc", ink: "#6b4e0c" },
  { id: "autumn", label: "Autumn", emoji: "🍁", months: [9, 10, 11], color: "#b5562a", tint: "#f4dfd2", ink: "#6e2c10" },
];
export const seasonOf = (m: number): Season => SEASONS.find((s) => s.months.includes(m))!;

export interface Feel { id: string; label: string; emoji: string; lo: number; hi: number }
export const FEELS: Feel[] = [
  { id: "cool", label: "Cool", emoji: "🧥", lo: 0, hi: 15 },
  { id: "mild", label: "Mild", emoji: "🌤️", lo: 15, hi: 24 },
  { id: "warm", label: "Warm", emoji: "😎", lo: 24, hi: 30 },
  { id: "hot", label: "Hot", emoji: "🔥", lo: 30, hi: 40 },
];

/** Where a chip's number comes from, shown on every chip and reason. */
export type Source = "nasa" | "estimate" | "maths" | "fires" | "visitors" | "cases";
export const SOURCE_LABEL: Record<Source, string> = {
  nasa: "NASA POWER",
  estimate: "Estimate from NASA POWER weather",
  maths: "NASA POWER + sun and moon maths",
  fires: "NASA FIRMS fire satellites",
  visitors: "2025 visitor counts (yearly, not by month)",
  cases: "Canopy mysteries",
};

export interface Chip {
  key: string;
  emoji: string;
  label: string;
  /** One line under the label on hover: what it checks. */
  hint: string;
  source: Source;
}

export const WANTS: Chip[] = [
  { key: "stars", emoji: "🌌", label: "Stargazing", hint: "Clear skies, long nights and low light pollution (estimated from NASA Black Marble imagery). New moon dates shown.", source: "maths" },
  { key: "waterfalls", emoji: "💦", label: "Roaring waterfalls", hint: "The month the snow melts, plus heavy rain.", source: "nasa" },
  { key: "wildflowers", emoji: "🌸", label: "Wildflower bloom", hint: "A month after snowmelt, or warm spring rain.", source: "estimate" },
  { key: "fall", emoji: "🍁", label: "Fall colours", hint: "First cold nights in leafy forest parks.", source: "estimate" },
  { key: "snow_play", emoji: "⛷️", label: "Snow play", hint: "Snow on the ground.", source: "nasa" },
  { key: "camping", emoji: "🏕️", label: "Comfy camping", hint: "Night lows of 5 to 15 °C (41 to 59 °F).", source: "nasa" },
  { key: "calm", emoji: "🛶", label: "Calm water", hint: "Light wind for kayaks and canoes.", source: "nasa" },
  { key: "sunny", emoji: "☀️", label: "Sunny days", hint: "Lots of sunlight reaching the ground.", source: "nasa" },
  { key: "hikes", emoji: "🥾", label: "Long hike days", hint: "Long daylight, mild highs, no heat stress.", source: "maths" },
  { key: "witness", emoji: "📈", label: "See change happen", hint: "Parks where this month warmed or cooled most since 1981.", source: "nasa" },
  { key: "mystery", emoji: "🔍", label: "Has a mystery", hint: "Parks with a mystery you have not solved yet.", source: "cases" },
];

export const AVOIDS: Chip[] = [
  { key: "bugs", emoji: "🦟", label: "Bugs", hint: "Warm, humid and wet: mosquito weather.", source: "estimate" },
  { key: "heat", emoji: "🥵", label: "Heat stress", hint: "Days at 32 °C (90 °F) or very muggy heat.", source: "nasa" },
  { key: "freezing", emoji: "🥶", label: "Freezing nights", hint: "Nights below 0 °C (32 °F).", source: "nasa" },
  { key: "rain", emoji: "🌧️", label: "Rainy days", hint: "Days with at least 1 mm of rain.", source: "nasa" },
  { key: "muggy", emoji: "💧", label: "Muggy air", hint: "Dew point above 16 °C (61 °F).", source: "nasa" },
  { key: "gray", emoji: "☁️", label: "Gray skies", hint: "Lots of cloud.", source: "nasa" },
  { key: "windy", emoji: "💨", label: "Windy days", hint: "Strong average wind.", source: "nasa" },
  { key: "uv", emoji: "🔆", label: "Strong UV", hint: "High daily UV from NASA POWER.", source: "nasa" },
  { key: "snow_trails", emoji: "❄️", label: "Snow on trails", hint: "Snow on the ground.", source: "nasa" },
  { key: "crowds", emoji: "👥", label: "Crowds", hint: "Parks with fewer visitors a year.", source: "visitors" },
  { key: "fire", emoji: "🔥", label: "Fire season", hint: "Fire heat spots seen by satellite within 25 km, 2015-2024. Lava also shows up (Hawaiʻi Volcanoes).", source: "fires" },
  { key: "smoke", emoji: "🌫️", label: "Hazy or smoky air", hint: "Days with lots of smoke, dust or haze in the air.", source: "nasa" },
];

export const CHIP: Record<string, Chip> = Object.fromEntries([...WANTS, ...AVOIDS].map((c) => [c.key, c]));

export interface TripState {
  months: number[];
  feels: string[];
  /** Custom ideal daytime high, °C; replaces the feel chips when set. */
  custom: [number, number] | null;
  want: Record<string, Level>;
  avoid: Record<string, Level>;
  horizon: HorizonKey;
  scenario: "ssp245" | "ssp585";
}

export const DEFAULT_STATE: TripState = {
  months: [new Date().getMonth() + 1],
  feels: ["mild", "warm"],
  custom: null,
  want: {},
  avoid: { bugs: "nice" },
  horizon: "next_year",
  scenario: "ssp245",
};

export interface Mood { id: string; emoji: string; label: string; state: Partial<TripState> }
export const MOODS: Mood[] = [
  { id: "warm", emoji: "☀️", label: "Warm escape", state: { months: [12, 1, 2], feels: ["warm"], want: { sunny: "nice" }, avoid: { rain: "nice", bugs: "nice" } } },
  { id: "hike", emoji: "🌲", label: "Cool hike", state: { feels: ["cool", "mild"], want: { hikes: "must" }, avoid: { heat: "must", bugs: "nice", snow_trails: "nice" } } },
  { id: "stars", emoji: "🌌", label: "Dark-sky trip", state: { feels: ["cool", "mild", "warm"], want: { stars: "must" }, avoid: { gray: "nice", smoke: "nice" } } },
  { id: "falls", emoji: "💦", label: "Waterfall chase", state: { months: [4, 5, 6], feels: ["cool", "mild", "warm"], want: { waterfalls: "must", wildflowers: "nice" }, avoid: {} } },
  { id: "leaves", emoji: "🍁", label: "Leaf peeping", state: { months: [9, 10, 11], feels: ["cool", "mild"], want: { fall: "must" }, avoid: { rain: "nice" } } },
  { id: "snow", emoji: "⛷️", label: "Snow days", state: { months: [12, 1, 2], feels: ["cool"], custom: [-15, 5], want: { snow_play: "must" }, avoid: { windy: "nice" } } },
  { id: "camp", emoji: "🏕️", label: "Camping weekend", state: { months: [5, 6, 7, 8, 9], feels: ["mild", "warm"], want: { camping: "must", stars: "nice" }, avoid: { bugs: "nice", rain: "nice", fire: "nice" } } },
  { id: "family", emoji: "🧒", label: "Easy family trip", state: { feels: ["mild", "warm"], want: { hikes: "nice" }, avoid: { heat: "must", freezing: "must", bugs: "nice", uv: "nice" } } },
  { id: "witness", emoji: "📈", label: "Climate witness", state: { feels: ["cool", "mild", "warm", "hot"], want: { witness: "must", mystery: "nice" }, avoid: {} } },
];

export function applyMood(s: TripState, m: Mood): TripState {
  return { ...s, custom: null, want: {}, avoid: {}, ...m.state };
}

/** Feel chips (or the custom range) as lo:hi bands in °C. */
/** No warmth picked: rank for comfy highs, Mild + Warm (15–30 °C). */
export const DEFAULT_BANDS: [number, number][] = [[15, 24], [24, 30]];

export function bandsOf(s: TripState): [number, number][] {
  if (s.custom) return [s.custom];
  const b = FEELS.filter((f) => s.feels.includes(f.id)).map((f) => [f.lo, f.hi] as [number, number]);
  return b.length ? b : DEFAULT_BANDS;
}

const chipStr = (c: Record<string, Level>) =>
  Object.entries(c).map(([k, l]) => (l === "must" ? `${k}!` : k)).join(",");

/** The picked months, or all 12 for "Any time". */
export const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const monthsOrAll = (s: TripState): number[] => (s.months.length ? s.months : ALL_MONTHS);

export function tripQuery(s: TripState, mystery: string[] = []): URLSearchParams {
  const q = new URLSearchParams({
    months: monthsOrAll(s).join(","),
    bands: bandsOf(s).map(([a, b]) => `${a}:${b}`).join(","),
    horizon: s.horizon,
    scenario: s.scenario,
  });
  if (Object.keys(s.want).length) q.set("want", chipStr(s.want));
  if (Object.keys(s.avoid).length) q.set("avoid", chipStr(s.avoid));
  if (s.want.mystery && mystery.length) q.set("mystery", mystery.join(","));
  return q;
}

export async function fetchTrip(s: TripState, mystery: string[], signal?: AbortSignal): Promise<Trip> {
  const r = await fetch(`/api/parks/trip?${tripQuery(s, mystery)}`, { signal });
  if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
  return r.json();
}

const parseChips = (v: string | null, known: Chip[]): Record<string, Level> => {
  const out: Record<string, Level> = {};
  for (const raw of (v ?? "").split(",")) {
    const k = raw.replace(/!$/, "");
    if (known.some((c) => c.key === k)) out[k] = raw.endsWith("!") ? "must" : "nice";
  }
  return out;
};

/** Compact string for the URL: m=9.10&f=mild.warm&w=stars!&a=bugs&h=next_year */
export function encodeState(s: TripState): string {
  const p = new URLSearchParams();
  p.set("m", s.months.join("."));
  if (s.custom) p.set("t", s.custom.join("_"));
  else p.set("f", s.feels.join("."));
  if (Object.keys(s.want).length) p.set("w", chipStr(s.want).replace(/,/g, "."));
  if (Object.keys(s.avoid).length) p.set("a", chipStr(s.avoid).replace(/,/g, "."));
  if (s.horizon !== "next_year") p.set("h", s.horizon);
  if (s.scenario !== "ssp245") p.set("s", s.scenario);
  return p.toString();
}

export function decodeState(str: string | null | undefined): TripState | null {
  if (!str) return null;
  const p = new URLSearchParams(str);
  if (!p.has("m")) return null;
  // Empty "m" = Any time.
  const raw = (p.get("m") ?? "").split(".").filter(Boolean);
  const months = raw.map(Number).filter((m) => m >= 1 && m <= 12);
  if (raw.length && !months.length) return null; // garbage like m=13
  const t = (p.get("t") ?? "").split("_").map(Number);
  const h = p.get("h");
  return {
    months: [...new Set(months)],
    feels: (p.get("f") ?? "").split(".").filter((f) => FEELS.some((x) => x.id === f)),
    custom: t.length === 2 && t.every(Number.isFinite) && t[0] <= t[1] ? [t[0], t[1]] : null,
    want: parseChips((p.get("w") ?? "").replace(/\./g, ","), WANTS),
    avoid: parseChips((p.get("a") ?? "").replace(/\./g, ","), AVOIDS),
    horizon: h === "this_year" || h === "y2050" ? h : "next_year",
    scenario: p.get("s") === "ssp585" ? "ssp585" : "ssp245",
  };
}

/** Next level when a chip is tapped: off -> nice -> must -> off. */
export const nextLevel = (l: Level | undefined): Level | undefined => (l === undefined ? "nice" : l === "nice" ? "must" : undefined);

// ── Formatting ─────────────────────────────────────────────────────────────

export const temp = (c: number, u: Unit, digits = 0) => (u === "F" ? `${(c * 1.8 + 32).toFixed(digits)}°F` : `${c.toFixed(digits)}°C`);
export const tempDelta = (c: number, u: Unit, digits = 1) => `${c > 0 ? "+" : ""}${(u === "F" ? c * 1.8 : c).toFixed(digits)}°${u}`;

/** What a reason's value means, in a few words. */
export function reasonText(r: Reason, u: Unit): string {
  const v = r.value;
  if (r.key === "mystery") return r.score ? "has a mystery to solve" : "no unsolved mystery";
  if (v == null) return "no data here";
  switch (r.key) {
    case "temperature": return `${temp(v, u)} highs`;
    case "stars": return `${Math.round(100 - v)}% clear skies`;
    case "waterfalls": return r.score && r.score > 0.4 ? "falls running high" : "low water";
    case "wildflowers": return r.score && r.score > 0.5 ? "likely in bloom" : "few flowers likely";
    case "fall": return r.score && r.score > 0.5 ? "leaves turning" : "little colour";
    case "snow_play": case "snow_trails": return v < 1 ? "no snow" : `${Math.round(u === "F" ? v / 2.54 : v)} ${u === "F" ? "in" : "cm"} of snow`;
    case "camping": return `${temp(v, u)} nights`;
    case "freezing": return v < 0.5 ? "no freezing nights" : `${v.toFixed(0)} freezing nights`;
    case "calm": case "windy": return `${(u === "F" ? v * 2.237 : v * 3.6).toFixed(0)} ${u === "F" ? "mph" : "km/h"} wind`;
    case "sunny": return `${v.toFixed(1)} kWh/m² sun a day`;
    case "hikes": return `${v.toFixed(1)} h of daylight`;
    case "witness": return `${tempDelta(v, u, 2)} per decade`;
    case "bugs": return v < 0.2 ? "few bugs" : v < 0.5 ? "some bugs" : "buggy";
    case "heat": return v < 0.5 ? "no heat-stress days" : `${v.toFixed(0)} heat-stress days`;
    case "rain": return `${v.toFixed(0)} rainy days`;
    case "muggy": return `dew point ${temp(v, u)}`;
    case "gray": return `${Math.round(v)}% cloud`;
    case "uv": return v > 2.6 ? "UV among the highest of the parks" : v > 2 ? "UV above most parks" : "gentle UV";
    case "crowds": return `${(v / 1e6).toFixed(1)}M visitors a year`;
    case "fire": return v < 0.5 ? "no fires seen" : `${v.toFixed(0)} heat spots a month`;
    case "smoke": return v < 0.5 ? "clear air" : `${v.toFixed(0)} hazy days`;
    default: return "";
  }
}

export const LABEL = (k: string) => (k === "temperature" ? "Daytime high" : CHIP[k]?.label ?? k);
export const EMOJI = (k: string) => (k === "temperature" ? "🌡️" : CHIP[k]?.emoji ?? "•");

/** "Why #1": the strongest reasons, as one sentence. */
const rankOfReason = (r: Reason) => (r.level === "must" ? 3 : r.kind === "feel" ? 1 : r.kind === "base" ? 0 : 2);

/** Two best reasons for a card, e.g. "20°C highs · 2 rainy days". */
export function shortWhy(p: TripPark, u: Unit): string {
  return p.reasons
    .filter((r) => r.score != null && r.score >= 0.5)
    .sort((a, b) => rankOfReason(b) - rankOfReason(a) || b.score! - a.score!)
    .slice(0, 2)
    .map((r) => reasonText(r, u))
    .join(" · ");
}

export function whySentence(p: TripPark, u: Unit): string {
  const good = p.reasons
    .filter((r) => r.score != null && r.score >= 0.75)
    // Your musts first, then your other picks, then warmth, then the always-counted weather.
    .sort((a, b) => rankOfReason(b) - rankOfReason(a) || b.score! - a.score!)
    .slice(0, 3)
    .map((r) => reasonText(r, u));
  if (!good.length) return `${p.park.short} is the closest fit, though nothing fits perfectly.`;
  const list = good.length === 1 ? good[0] : `${good.slice(0, -1).join(", ")} and ${good.at(-1)}`;
  return `${p.park.short} wins in ${MONTHS_LONG[p.best_month - 1]}: ${list}.`;
}

/** Score colour from sand (0) to pine (100). */
export function scoreColor(s: number | null): string {
  if (s == null) return "#d8cfbd";
  const t = Math.max(0, Math.min(1, s / 100));
  const a = [226, 214, 190], b = [45, 90, 39];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

export const HORIZON_LABEL = (h: HorizonKey, t: Pick<Trip, "this_year" | "next_year"> | null) =>
  h === "this_year" ? `${t?.this_year ?? ""} so far` : h === "next_year" ? `${t?.next_year ?? ""} trend` : "2050 model";

/** Every feel band, so temperature hides no park. */
export const ALL_FEELS = FEELS.map((f) => f.id);

/** How many filters are set: each chip, plus a warmth choice. Months and year are not filters. */
export function filterCount(s: TripState): number {
  const temp = s.custom != null || s.feels.length > 0 ? 1 : 0;
  return Object.keys(s.want).length + Object.keys(s.avoid).length + temp;
}

/** True when nothing is picked at all: no months, warmth or chips. Then the planner lists A to Z. */
export const isBrowse = (s: TripState): boolean => s.months.length === 0 && filterCount(s) === 0;

/** Filters plus picked months: the number shown on Clear all. */
export const clearCount = (s: TripState): number => filterCount(s) + (s.months.length ? 1 : 0);

/**
 * Drop every chip, the warmth choice and the months. Keeps year and scenario.
 * With nothing to rank by, the planner lists every park A to Z instead of ranking.
 */
export function clearFilters(s: TripState): TripState {
  return { ...s, months: [], feels: [], custom: null, want: {}, avoid: {} };
}

const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Parks whose name, short name, state or NPS code contains the text. Name starts first. */
export function searchParks(parks: TripPark[], text: string): TripPark[] {
  const t = fold(text.trim());
  if (!t) return [];
  const hay = (p: TripPark) => fold([p.park.name, p.park.short, p.park.code ?? "", ...p.park.states].join(" "));
  const starts = (p: TripPark) => fold(p.park.short).startsWith(t);
  return parks.filter((p) => hay(p).includes(t)).sort((a, b) => Number(starts(b)) - Number(starts(a)));
}

/**
 * Month to mark gold on the strip. The best month all year, but on a tie
 * (same rounded score) prefer the month the card names, then any picked month.
 */
export function goldMonth(p: TripPark, picked: number[]): number | null {
  const r = (m: number) => Math.round(p.month_scores[m - 1]?.score ?? -1);
  if (!p.best_now) return null;
  const top = r(p.best_now);
  if (r(p.best_month) === top) return p.best_month;
  return picked.find((m) => r(m) === top) ?? p.best_now;
}
