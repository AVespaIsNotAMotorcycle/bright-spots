// Shared helpers for the researcher tabs: data loading, statistics, formatting.
import { useEffect, useState } from "react";
import type { Atlas, ParkTrends, TrendRow, Verdict } from "../detective/model";

// ---------- types for GET /api/trends/insights ----------

export interface ParkMeta {
  id: string;
  name: string;
  state: string | null;
  lat: number;
  lon: number;
}

export interface FamilyInfo {
  id: number;
  title: string;
  name: string;
  size: number;
  stability: number;
  stable: boolean;
  signature: { variable: string; period: string; z: number; sn: number }[];
  parks: string[];
}

export interface TrendRef {
  sen: number | null;
  sn: number | null;
  q: number | null;
  verdict: Verdict | null;
  years: [number | null, number | null];
}

export interface OppItem {
  park: string;
  sen: number;
  sn: number | null;
  q: number | null;
  verdict: Verdict;
}

export interface OppGroup {
  variable: string;
  period: string;
  tier: "strong" | "weak";
  up: OppItem[];
  down: OppItem[];
  pair: [string, string];
  drivers: Record<string, Record<string, TrendRef | null>>;
  score: number;
}

export interface Insights {
  parks: ParkMeta[];
  families: {
    k: number;
    bootstraps: number;
    stable_at: number;
    features: { variable: string; period: string }[];
    families: FamilyInfo[];
    parks: Record<string, { family: number; agreement: number; x: number; y: number }>;
    ecoregions: {
      parks: Record<string, { l1: string | null; l2: string | null; l3: string | null }>;
      n_with_ecoregion: number;
      n_ecoregions: number;
      ari: number;
      p: number;
      by_family: Record<string, Record<string, string[]>>;
    } | null;
  };
  opposites: OppGroup[];
}

// ---------- loading (cached for the page's lifetime) ----------

let insightsCache: Promise<Insights> | null = null;
const parkCache = new Map<string, Promise<ParkTrends>>();

export function loadInsights(): Promise<Insights> {
  if (!insightsCache) {
    insightsCache = fetch("/api/trends/insights").then((r) => {
      if (!r.ok) throw new Error(`insights ${r.status}`);
      return r.json() as Promise<Insights>;
    });
    insightsCache.catch(() => (insightsCache = null));
  }
  return insightsCache;
}

export function loadPark(id: string): Promise<ParkTrends> {
  let p = parkCache.get(id);
  if (!p) {
    p = fetch(`/api/trends/parks/${id}`).then((r) => {
      if (!r.ok) throw new Error(`${id} ${r.status}`);
      return r.json() as Promise<ParkTrends>;
    });
    p.catch(() => parkCache.delete(id));
    parkCache.set(id, p);
  }
  return p;
}

export function useInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadInsights().then(setData).catch((e: Error) => setError(e.message));
  }, []);
  return { data, error };
}

export function usePark(id: string | null) {
  const [data, setData] = useState<ParkTrends | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    setError(null);
    if (!id) return;
    let live = true;
    loadPark(id).then((d) => live && setData(d)).catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id]);
  return { data, error };
}

// ---------- statistics (client side, for the robustness test) ----------

/** Sen's slope (median of pairwise slopes), per year. */
export function senSlope(x: number[], y: number[]): number {
  const s: number[] = [];
  for (let i = 0; i < x.length; i++)
    for (let j = i + 1; j < x.length; j++) s.push((y[j] - y[i]) / (x[j] - x[i]));
  s.sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function normCdf(z: number): number {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const erf = 1 - ((((a[4] * t + a[3]) * t + a[2]) * t + a[1]) * t + a[0]) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Two-sided Mann-Kendall p-value (normal approximation, no tie correction). */
export function mannKendallP(y: number[]): number {
  const n = y.length;
  let s = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) s += Math.sign(y[j] - y[i]);
  const v = (n * (n - 1) * (2 * n + 5)) / 18;
  const z = s === 0 ? 0 : (s - Math.sign(s)) / Math.sqrt(v);
  return 2 * (1 - normCdf(Math.abs(z)));
}

export interface StartScan {
  start: number;
  n: number;
  slope: number; // per decade
  p: number;
}

/** Re-run the trend test for every start year that leaves at least minYears. */
export function startYearScan(years: number[], values: number[], minYears = 15): StartScan[] {
  const out: StartScan[] = [];
  for (let k = 0; years.length - k >= minYears; k++) {
    const x = years.slice(k);
    const y = values.slice(k);
    out.push({ start: x[0], n: x.length, slope: senSlope(x, y) * 10, p: mannKendallP(y) });
  }
  return out;
}

export function robustness(scan: StartScan[], fullSlope: number) {
  const same = scan.filter((s) => Math.sign(s.slope) === Math.sign(fullSlope));
  const sig = scan.filter((s) => s.p < 0.05 && Math.sign(s.slope) === Math.sign(fullSlope));
  const sigShare = scan.length ? sig.length / scan.length : 0;
  return {
    total: scan.length,
    sameDirection: same.length,
    significant: sig.length,
    sigShare,
    label: sigShare >= 0.8 ? "Robust" : sigShare >= 0.4 ? "Depends on the start year" : "Fragile",
  };
}

// ---------- formatting ----------

export const VERDICT_COLOR: Record<string, string> = {
  real: "var(--pine)",
  possible: "#b7791f",
  none: "var(--text-faint)",
  short: "var(--text-faint)",
  flat: "var(--text-faint)",
};

export function isTemp(atlas: Atlas | null, variable: string): boolean {
  return (atlas?.variables[variable]?.unit ?? "").includes("°");
}

/** Slope per decade in the unit people read: °F for temperatures. */
export function slopeText(sen: number | null | undefined, variable: string, atlas: Atlas | null): string {
  if (sen == null) return "–";
  const temp = isTemp(atlas, variable);
  const v = temp ? sen * 1.8 : sen;
  const unit = temp ? "°F" : atlas?.variables[variable]?.unit ?? "";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)} ${unit}/decade`;
}

export function varLabel(atlas: Atlas | null, v: string): string {
  return atlas?.variables[v]?.label ?? v;
}

export function findRow(d: ParkTrends | null, v: string, p: string): TrendRow | undefined {
  return d?.trends.find((t) => t.variable === v && t.period === p);
}

/** Park colours for the family map. */
export const FAMILY_COLORS = ["#2d5a27", "#8b3a1a", "#1a3a5c", "#b7791f", "#7a4e8a", "#4a8a8a"];

// ---------- change-point (Pettitt test) ----------

export interface ChangePoint {
  index: number; // last index of the "before" segment
  year: number; // first year of the "after" segment
  p: number;
  before: number;
  after: number;
}

/** Pettitt (1979): one most-likely step change in a series, with an approximate p-value. */
export function pettitt(years: number[], y: number[]): ChangePoint | null {
  const n = y.length;
  if (n < 15) return null;
  let best = 0;
  let bestT = 0;
  for (let t = 0; t < n - 1; t++) {
    let u = 0;
    for (let i = 0; i <= t; i++) for (let j = t + 1; j < n; j++) u += Math.sign(y[i] - y[j]);
    if (Math.abs(u) > best) {
      best = Math.abs(u);
      bestT = t;
    }
  }
  const p = Math.min(1, 2 * Math.exp((-6 * best * best) / (n ** 3 + n ** 2)));
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  return { index: bestT, year: years[bestT + 1], p, before: mean(y.slice(0, bestT + 1)), after: mean(y.slice(bestT + 1)) };
}
