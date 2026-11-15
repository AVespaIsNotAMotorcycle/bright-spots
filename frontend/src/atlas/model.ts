// Trend atlas (SPEC Feature 1): static JSON built by backend/scripts/build_atlas.py.

export type Verdict = "real" | "possible" | "none" | "too_little_data";

export interface Cell {
  n: number;
  first_year: number | null;
  last_year: number | null;
  sen_per_decade: number | null;
  ols_per_decade: number | null;
  ols_ci_low: number | null;
  ols_ci_high: number | null;
  p: number | null;
  p_prewhitened: number | null;
  autocorr_flag: boolean;
  sd: number | null;
  snr: number | null;
  q: number | null;
  verdict: Verdict;
  direction: "up" | "down" | null;
}

export interface VariableMeta {
  name: string;
  unit: string;
  total: boolean;
  source: string;
  spec_source: string | null;
}

export interface AtlasPark {
  id: string;
  code: string | null;
  name: string;
  short: string;
  states: string[];
  lat: number;
  lon: number;
}

export interface Atlas {
  generated: string;
  years: [number, number];
  method: Record<string, string | number>;
  variables: Record<string, VariableMeta>;
  periods: { id: string; label: string }[];
  parks: AtlasPark[];
  /** variable -> period -> one cell per park, in `parks` order */
  cells: Record<string, Record<string, Cell[]>>;
}

/** Yearly series per park: variable -> period -> values aligned with `years`. */
export type Series = { years: number[] } & Record<string, Record<string, (number | null)[]>>;

let atlasPromise: Promise<Atlas> | null = null;
export function loadAtlas(): Promise<Atlas> {
  if (!atlasPromise) {
    atlasPromise = fetch("/data/atlas.json").then((r) => {
      if (!r.ok) throw new Error(`${r.status}: atlas.json missing; run backend/scripts/build_atlas.py`);
      return r.json() as Promise<Atlas>;
    });
    atlasPromise.catch(() => (atlasPromise = null));
  }
  return atlasPromise;
}

const seriesCache = new Map<string, Promise<Series>>();
export function loadSeries(parkId: string): Promise<Series> {
  let p = seriesCache.get(parkId);
  if (!p) {
    p = fetch(`/data/series/${encodeURIComponent(parkId)}.json`).then((r) => {
      if (!r.ok) throw new Error(`${r.status}: no series for ${parkId}`);
      return r.json() as Promise<Series>;
    });
    seriesCache.set(parkId, p);
    p.catch(() => seriesCache.delete(parkId));
  }
  return p;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  real: "Real, not luck",
  possible: "Possible, not proven",
  none: "No clear change",
  too_little_data: "Too little data",
};

/**
 * A change per decade in display units. Temperature differences convert ×1.8 for °F;
 * percentages change in percentage points; the rest keep their unit.
 */
export function perDecade(v: number, varId: string, meta: VariableMeta, fahrenheit: boolean): { value: number; unit: string } {
  if (meta.unit === "°C") return fahrenheit ? { value: v * 1.8, unit: "°F" } : { value: v, unit: "°C" };
  if (meta.unit === "%") return { value: v, unit: "points" };
  return { value: v, unit: meta.unit };
}

export function fmtNum(v: number, digits = 2): string {
  const a = Math.abs(v);
  const d = a >= 10 ? 0 : a >= 1 ? 1 : digits;
  return v.toFixed(d);
}

export function fmtP(p: number | null): string {
  if (p == null) return "–";
  return p < 0.001 ? "<0.001" : p.toFixed(3);
}

/** "Summer (Jun–Aug)" -> "summer (Jun–Aug)", "Whole year" -> "the whole year"; months keep their capital. */
export function periodPhrase(label: string): string {
  if (label === "Whole year") return "the whole year";
  if (/^(Winter|Spring|Summer|Autumn)/.test(label)) return label[0].toLowerCase() + label.slice(1);
  return label;
}

/** Explainer sentence, templated only from the cell's numbers (SPEC Feature 6). */
export function explain(
  cell: Cell,
  park: AtlasPark,
  varId: string,
  meta: VariableMeta,
  periodLabel: string,
  fahrenheit: boolean,
  nParks: number,
): string {
  const where = `${park.short}`;
  const what = `${meta.name.toLowerCase()} in ${periodPhrase(periodLabel)}`;
  if (cell.verdict === "too_little_data" || cell.sen_per_decade == null)
    return `${where}: too little data to judge ${what} (${cell.n} years; at least 15 are needed).`;
  const since = `${cell.first_year}–${cell.last_year}`;
  const { value, unit } = perDecade(Math.abs(cell.sen_per_decade), varId, meta, fahrenheit);
  const amount = `${fmtNum(value)} ${unit}`;
  const dir = cell.direction === "up" ? "risen" : "fallen";
  if (cell.verdict === "real")
    return `${where}: ${what} has ${dir} by about ${amount} per decade over ${since}. Real, not luck: it holds up after testing all ${nParks} parks (q = ${fmtP(cell.q)}).`;
  if (cell.verdict === "possible")
    return `${where}: ${what} may have ${dir} by about ${amount} per decade over ${since}. Possible, not proven: p = ${fmtP(cell.p)} for this park, but q = ${fmtP(cell.q)} once all parks are tested together.`;
  return `${where}: no clear change in ${what} over ${since} (p = ${fmtP(cell.p)}).`;
}

/** Sen line through the series: slope per year with the median intercept. */
export function senLine(years: number[], values: (number | null)[], senPerDecade: number): [number, number][] {
  const slope = senPerDecade / 10;
  const ints = years.map((y, i) => (values[i] == null ? null : values[i]! - slope * y)).filter((v): v is number => v != null);
  if (ints.length === 0) return [];
  ints.sort((a, b) => a - b);
  const mid = ints.length >> 1;
  const b = ints.length % 2 ? ints[mid] : (ints[mid - 1] + ints[mid]) / 2;
  const first = years.find((_, i) => values[i] != null)!;
  const last = [...years].reverse().find((y) => values[years.indexOf(y)] != null)!;
  return [
    [first, b + slope * first],
    [last, b + slope * last],
  ];
}

/** Across-parks opposite trends (SPEC Feature 3): significant up and down in one map. */
export function opposite(cells: Cell[]): { up: number[]; down: number[] } {
  const up: number[] = [],
    down: number[] = [];
  cells.forEach((c, i) => {
    if (c.verdict !== "real") return;
    if (c.direction === "up") up.push(i);
    if (c.direction === "down") down.push(i);
  });
  return { up, down };
}
