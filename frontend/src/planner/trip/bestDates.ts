// Best dates inside the picked months: one /api/parks/best-days call per month.
import { fetchBestDays, type BestDays, type Prefs } from "../model";
import { MONTHS, bandsOf, type TripState } from "./tripModel";

export function daysPrefs(s: TripState, month: number): Prefs {
  const bands = bandsOf(s);
  return {
    month,
    tLo: Math.min(...bands.map((b) => b[0])),
    tHi: Math.max(...bands.map((b) => b[1])),
    rhMax: null,
    dewMax: s.avoid.muggy ? 16 : null,
    rainMax: null,
    avoidBugs: !!s.avoid.bugs,
    stars: !!s.want.stars,
    snowmelt: !!s.want.waterfalls,
    scenario: s.scenario,
  };
}

/** month -> park id -> best days. The API takes at most 10 parks per call. */
export type DatesByMonth = Record<number, Record<string, BestDays>>;

export async function fetchDates(s: TripState, months: number[], ids: string[], signal?: AbortSignal): Promise<DatesByMonth> {
  const uniq = [...new Set(months)].sort((a, b) => a - b);
  const parts = await Promise.all(
    uniq.map((m) => fetchBestDays(daysPrefs(s, m), ids.slice(0, 10), s.horizon, signal).then((r) => [m, r] as const)),
  );
  return Object.fromEntries(parts);
}

/** "Feb 3–9", or null when the API found no stretch. */
export function fmtWindow(bd: BestDays | undefined): string | null {
  if (!bd?.window) return null;
  const m = MONTHS[bd.month - 1];
  return bd.window.start === bd.window.end ? `${m} ${bd.window.start}` : `${m} ${bd.window.start}–${bd.window.end}`;
}

/** This park's months, best stretch first (ties: earlier month). */
export function rankStretches(dates: DatesByMonth, id: string): BestDays[] {
  return Object.values(dates)
    .map((r) => r[id])
    .filter((b): b is BestDays => !!b?.window)
    .sort((a, b) => b.window!.mean - a.window!.mean || a.month - b.month);
}
