// Types and pure helpers for the park planner (backend: GET /api/parks/plan).

export interface Park {
  id: string;
  code: string | null;
  name: string;
  short: string;
  states: string[];
  lat: number;
  lon: number;
  visitors_2025: number | null;
}

export type FactorKey = "temperature" | "humidity" | "rain" | "bugs" | "stars" | "snowmelt";

export interface Horizon {
  score: number | null;
  low: number | null;
  high: number | null;
  factors: Partial<Record<FactorKey, number | null>>;
  values: Partial<Record<"tmax" | "t2m" | "rh" | "precip" | "cloud" | "snow", number | null>>;
  notes: string[];
}

export type HorizonKey = "this_year" | "next_year" | "y2050";

export interface ParkPlan {
  park: Park;
  this_year: Horizon;
  next_year: Horizon;
  y2050: Horizon;
}

export interface Plan {
  month: number;
  this_year: number;
  next_year: number;
  scenario: "ssp245" | "ssp585";
  parks: ParkPlan[];
}

export interface Prefs {
  month: number;
  /** Ideal daytime high range, °C (UI may show °F). */
  tLo: number;
  tHi: number;
  rhMax: number | null; // %
  rainMax: number | null; // mm per month
  avoidBugs: boolean;
  stars: boolean;
  snowmelt: boolean;
  scenario: "ssp245" | "ssp585";
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const FACTOR_LABEL: Record<FactorKey, string> = {
  temperature: "Daytime high",
  humidity: "Humidity",
  rain: "Rain",
  bugs: "Few bugs (estimate)",
  stars: "Clear skies",
  snowmelt: "Snowmelt season",
};

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const mmToIn = (mm: number) => mm / 25.4;
export const inToMm = (inch: number) => inch * 25.4;

export function planQuery(p: Prefs): Record<string, string> {
  const q: Record<string, string> = {
    month: String(p.month),
    t_lo: p.tLo.toFixed(2),
    t_hi: p.tHi.toFixed(2),
    avoid_bugs: String(p.avoidBugs),
    stars: String(p.stars),
    snowmelt: String(p.snowmelt),
    scenario: p.scenario,
  };
  if (p.rhMax != null) q.rh_max = String(p.rhMax);
  if (p.rainMax != null) q.rain_max = p.rainMax.toFixed(1);
  return q;
}

/** Highest score first; parks without a score for that horizon go last, by name. */
export function rankParks(parks: ParkPlan[], by: HorizonKey): ParkPlan[] {
  return [...parks].sort((a, b) => {
    const sa = a[by].score,
      sb = b[by].score;
    if (sa == null && sb == null) return a.park.short.localeCompare(b.park.short);
    if (sa == null) return 1;
    if (sb == null) return -1;
    return sb - sa || a.park.short.localeCompare(b.park.short);
  });
}

export async function fetchPlan(p: Prefs, signal?: AbortSignal): Promise<Plan> {
  const resp = await fetch(`/api/parks/plan?${new URLSearchParams(planQuery(p))}`, { signal });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON body */
    }
    throw new Error(`${resp.status}: ${detail}`);
  }
  return resp.json();
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  /** "device" = browser geolocation; "search" = a place the user typed. */
  source?: "device" | "search";
}

/** Great-circle distance in km (haversine, mean Earth radius 6371 km). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The n parks closest to a place, nearest first. */
export function nearestParks(parks: ParkPlan[], at: Place, n: number): ParkPlan[] {
  return [...parks].sort((a, b) => distanceKm(at, a.park) - distanceKm(at, b.park)).slice(0, n);
}

/** The n most-visited parks in 2025, excluding ids in `skip`. */
export function popularParks(parks: ParkPlan[], n: number, skip: Set<string> = new Set()): ParkPlan[] {
  return parks
    .filter((p) => !skip.has(p.park.id) && p.park.visitors_2025 != null)
    .sort((a, b) => b.park.visitors_2025! - a.park.visitors_2025!)
    .slice(0, n);
}

export async function geocode(q: string): Promise<Place[]> {
  const resp = await fetch(`/api/geocode?${new URLSearchParams({ q })}`);
  if (!resp.ok) throw new Error(`${resp.status}: place search failed`);
  return resp.json();
}

export type DailyVar = "tmax" | "rh" | "precip" | "cloud";
type Curves = Record<DailyVar, (number | null)[]>;

/** 365-day curves per horizon (Feb 29 dropped); see GET /api/parks/{id}/daily. */
export interface DailyCurves {
  park_id: string;
  year: number;
  through: string;
  scenario: string;
  normal: Curves;
  this_year: Curves;
  next_year: Curves;
  y2050: Record<DailyVar, (number | null)[] | null>;
}

const dailyCache = new Map<string, Promise<DailyCurves>>();

/** Fetched once per park and scenario, then reused (failures are not cached). */
export function fetchDaily(parkId: string, scenario: string): Promise<DailyCurves> {
  const key = `${parkId}|${scenario}`;
  let p = dailyCache.get(key);
  if (!p) {
    p = fetch(`/api/parks/${encodeURIComponent(parkId)}/daily?scenario=${scenario}`).then((r) => {
      if (!r.ok) throw new Error(`${r.status}: daily data unavailable`);
      return r.json() as Promise<DailyCurves>;
    });
    dailyCache.set(key, p);
    p.catch(() => dailyCache.delete(key));
  }
  return p;
}

/** First day-of-year index (0-based, non-leap) of each month, plus 365. */
export const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

/** One plain sentence on how a park's daytime high compares with the user's ideal range. */
export function explainTemp(
  tmaxC: number | null | undefined,
  tLoC: number,
  tHiC: number,
  unit: "F" | "C",
): { text: string; tone: "good" | "bad" | "ok" } | null {
  if (tmaxC == null) return null;
  const show = (c: number) => (unit === "F" ? `${Math.round(cToF(c))}°F` : `${Math.round(c)}°C`);
  // Differences convert by the scale factor only (no +32).
  const gap = (c: number) => (unit === "F" ? `${Math.round(c * 1.8)}°F` : `${Math.round(c)}°C`);
  const range = `${show(tLoC)}–${show(tHiC)}`;
  if (tmaxC < tLoC) {
    const d = tLoC - tmaxC;
    return { text: `Too cold: highs of ${show(tmaxC)}, ${gap(d)} under your ${range}`, tone: d > 4 ? "bad" : "ok" };
  }
  if (tmaxC > tHiC) {
    const d = tmaxC - tHiC;
    return { text: `Too hot: highs of ${show(tmaxC)}, ${gap(d)} over your ${range}`, tone: d > 4 ? "bad" : "ok" };
  }
  return { text: `Highs of ${show(tmaxC)} fit your ${range}`, tone: "good" };
}

/** The preferences that currently make up the score, as short phrases. */
export function prefsSummary(p: Prefs, unit: "F" | "C"): string[] {
  const t = (c: number) => (unit === "F" ? `${Math.round(cToF(c))}°F` : `${Math.round(c)}°C`);
  const out = [`daytime highs of ${t(p.tLo)}–${t(p.tHi)}`];
  if (p.rhMax != null) out.push(`humidity under ${Math.round(p.rhMax)}%`);
  if (p.rainMax != null)
    out.push(`rain under ${unit === "F" ? `${mmToIn(p.rainMax).toFixed(1)} in` : `${Math.round(p.rainMax)} mm`} a month`);
  if (p.avoidBugs) out.push("few bugs");
  if (p.stars) out.push("clear night skies");
  if (p.snowmelt) out.push("snowmelt season (waterfalls)");
  return out;
}
