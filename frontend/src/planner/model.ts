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
