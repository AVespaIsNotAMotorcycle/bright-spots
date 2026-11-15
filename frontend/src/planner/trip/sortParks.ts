// Plan step 2: how the park list is sorted. Users stack up to MAX_SORTS keys ("sort by, then by").
// Values are rounded before comparing, so a "then by" key decides between parks that are
// effectively tied (same whole score, same whole degree) rather than never coming into play.
import type { HorizonKey, TripPark } from "./tripModel";

export type SortKey = "this_year" | "next_year" | "y2050" | "warm" | "cool" | "dry" | "dryair" | "clear" | "quiet" | "name";

interface Sort {
  key: SortKey;
  label: string;
  /** null sorts last, whatever the direction. */
  value: (p: TripPark) => number | string | null;
  /** 1: low to high (or A to Z). -1: high to low. */
  dir: 1 | -1;
}

const round = (v: number | null | undefined, step = 1) => (v == null ? null : Math.round(v / step) * step);
const score = (h: HorizonKey) => (p: TripPark) => round(p.scores?.[h]);
const now = (k: string, step = 1) => (p: TripPark) => round(p.values?.this_year?.[k], step);

export const SORTS: Sort[] = [
  { key: "this_year", label: "This year's score", value: score("this_year"), dir: -1 },
  { key: "next_year", label: "Next year's score", value: score("next_year"), dir: -1 },
  { key: "y2050", label: "2050 score", value: score("y2050"), dir: -1 },
  { key: "warm", label: "Warmest highs", value: now("tmax"), dir: -1 },
  { key: "cool", label: "Coolest highs", value: now("tmax"), dir: 1 },
  { key: "dry", label: "Least rain", value: now("precip", 5), dir: 1 },
  { key: "dryair", label: "Least humid", value: now("rh", 5), dir: 1 },
  { key: "clear", label: "Clearest skies", value: now("cloud", 5), dir: 1 },
  { key: "quiet", label: "Fewest visitors", value: (p) => p.park.visitors_2025 ?? null, dir: 1 },
  { key: "name", label: "Name (A–Z)", value: (p) => p.park.short, dir: 1 },
];
export const SORT: Record<SortKey, Sort> = Object.fromEntries(SORTS.map((s) => [s.key, s])) as Record<SortKey, Sort>;

export const DEFAULT_SORT: SortKey[] = ["this_year"];
export const MAX_SORTS = 3;
const SCORE_KEYS: SortKey[] = ["this_year", "next_year", "y2050"];

function compare(s: Sort, a: TripPark, b: TripPark): number {
  const va = s.value(a);
  const vb = s.value(b);
  if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
  if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb)) * s.dir;
  return (va - vb) * s.dir;
}

/** Parks that fit every must first; then each key in turn; then by name so the order is stable. */
export function sortParks(parks: TripPark[], keys: SortKey[]): TripPark[] {
  const sorts = keys.map((k) => SORT[k]).filter(Boolean);
  return [...parks].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    for (const s of sorts) {
      const c = compare(s, a, b);
      if (c) return c;
    }
    return a.park.short.localeCompare(b.park.short);
  });
}

/** The horizon whose score the list shows next to each park: the first score key, else this year. */
export const shownHorizon = (keys: SortKey[]): HorizonKey => (keys.find((k) => SCORE_KEYS.includes(k)) as HorizonKey | undefined) ?? "this_year";

/** Keep only known keys, no repeats, at most MAX_SORTS; fall back to the default. */
export function cleanSort(v: unknown): SortKey[] {
  const keys = Array.isArray(v) ? v.filter((k): k is SortKey => typeof k === "string" && k in SORT) : [];
  const unique = [...new Set(keys)].slice(0, MAX_SORTS);
  return unique.length ? unique : DEFAULT_SORT;
}
