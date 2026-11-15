// "Since you were born": how much a park's daytime high moved since a birth year,
// from the confirmed annual trend (Sen's slope) in the atlas. Pure functions, no UI.
import type { Atlas, AtlasCell } from "./model";

const KEY = "born";
export const VAR = "tmax_c";
export const PERIOD = "annual";

export function loadBorn(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isInteger(n) && n > 1900 ? n : null;
  } catch {
    return null;
  }
}

export function saveBorn(year: number | null): void {
  try {
    if (year == null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(year));
  } catch {
    /* storage unavailable */
  }
}

export interface Window {
  /** First year counted: the birth year, or the record start if earlier. */
  from: number;
  to: number;
  years: number;
  /** True when the birth year is before the record starts. */
  clipped: boolean;
}

export function windowFor(atlas: Atlas, born: number): Window {
  const first = atlas.coverage?.first_year ?? 1981;
  const to = atlas.coverage?.last_full_year ?? 2025;
  const from = Math.min(Math.max(born, first), to);
  return { from, to, years: to - from, clipped: born < first };
}

export interface Change {
  park_id: string;
  /** Change over the window, °C (trend line, not a measured difference). */
  c: number;
  q: number | null;
  sen: number;
}

/** Change per park over the window, for confirmed trends only. Biggest warming first. */
export function changes(atlas: Atlas, w: Window): Change[] {
  const cells: AtlasCell[] = atlas.atlas[VAR]?.[PERIOD] ?? [];
  return cells
    .filter((c) => c.verdict === "real" && c.sen != null)
    .map((c) => ({ park_id: c.park_id, c: (c.sen! * w.years) / 10, q: c.q, sen: c.sen! }))
    .sort((a, b) => b.c - a.c);
}

/** How many parks have a confirmed warming or cooling trend, out of all with data. */
export function tally(atlas: Atlas): { warmer: number; cooler: number; total: number } {
  const cells = (atlas.atlas[VAR]?.[PERIOD] ?? []).filter((c) => c.sen != null);
  const real = cells.filter((c) => c.verdict === "real");
  return {
    warmer: real.filter((c) => c.sen! > 0).length,
    cooler: real.filter((c) => c.sen! < 0).length,
    total: cells.length,
  };
}

export const fmtDeg = (c: number, f: boolean) => {
  const v = f ? c * 1.8 : c;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}°${f ? "F" : "C"}`;
};
