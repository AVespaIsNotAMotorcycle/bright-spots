// Pure helpers behind the researcher widgets: twin finder, neighbours that disagree,
// anomaly of the week and the head-to-head score. No React here, so they are easy to test.
import type { Atlas, AtlasCell, TrendRow } from "../detective/model";

const SHAPE_PERIODS = ["annual", "DJF", "MAM", "JJA", "SON"];

export interface Feature {
  variable: string;
  period: string;
}

/** Each park's trend fingerprint: z-scored Sen's slopes for every variable x (annual + seasons). */
export function fingerprints(atlas: Atlas): { features: Feature[]; parks: Map<string, (number | null)[]> } {
  const features: Feature[] = [];
  const parks = new Map<string, (number | null)[]>();
  for (const variable of Object.keys(atlas.variables))
    for (const period of SHAPE_PERIODS) {
      const cells = atlas.atlas[variable]?.[period];
      if (!cells?.length) continue;
      const vals = cells.map((c) => c.sen).filter((x): x is number => x != null);
      if (vals.length < 3) continue;
      const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length) || 1;
      const idx = features.length;
      features.push({ variable, period });
      for (const c of cells) {
        const row = parks.get(c.park_id) ?? [];
        row[idx] = c.sen == null ? null : (c.sen - mean) / sd;
        parks.set(c.park_id, row);
      }
    }
  for (const row of parks.values()) for (let i = 0; i < features.length; i++) if (row[i] === undefined) row[i] = null;
  return { features, parks };
}

/** Cosine similarity over the features both parks have. Returns null if they share fewer than 3. */
export function similarity(a: (number | null)[], b: (number | null)[]): number | null {
  let dot = 0, na = 0, nb = 0, n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (x == null || y == null) continue;
    dot += x * y;
    na += x * x;
    nb += y * y;
    n++;
  }
  if (n < 3 || na === 0 || nb === 0) return null;
  return dot / Math.sqrt(na * nb);
}

export interface Twin {
  park: string;
  score: number; // -1..1
  /** Features where both parks sit far from the average in the same direction. */
  shared: Feature[];
}

export function findTwins(atlas: Atlas, park: string, n = 6): { twins: Twin[]; opposite: Twin | null } {
  const { features, parks } = fingerprints(atlas);
  const me = parks.get(park);
  if (!me) return { twins: [], opposite: null };
  const all: Twin[] = [];
  for (const [id, row] of parks) {
    if (id === park) continue;
    const s = similarity(me, row);
    if (s == null) continue;
    const shared = features
      .map((f, i) => ({ f, both: me[i] != null && row[i] != null ? Math.min(Math.abs(me[i]!), Math.abs(row[i]!)) * Math.sign(me[i]! * row[i]!) : 0 }))
      .filter((x) => x.both > 0.5)
      .sort((x, y) => y.both - x.both)
      .slice(0, 3)
      .map((x) => x.f);
    all.push({ park: id, score: s, shared });
  }
  all.sort((x, y) => y.score - x.score);
  return { twins: all.slice(0, n), opposite: all.length ? all[all.length - 1] : null };
}

// ---------- neighbours that disagree ----------

export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface OddPair {
  up: string;
  down: string;
  variable: string;
  period: string;
  km: number;
  upSen: number;
  downSen: number;
  score: number;
}

/** Nearby parks whose confirmed trends point opposite ways for the same variable and period. */
export function oddNeighbours(
  atlas: Atlas,
  parks: { id: string; lat: number; lon: number }[],
  maxKm = 600,
  n = 8,
): OddPair[] {
  const pos = new Map(parks.map((p) => [p.id, p]));
  const out: OddPair[] = [];
  for (const [variable, byPeriod] of Object.entries(atlas.atlas))
    for (const [period, cells] of Object.entries(byPeriod)) {
      const real = cells.filter((c) => c.verdict === "real" && c.sen != null && pos.has(c.park_id));
      if (real.length < 2) continue;
      const maxAbs = Math.max(...real.map((c) => Math.abs(c.sen!))) || 1;
      const ups = real.filter((c) => c.sen! > 0);
      const downs = real.filter((c) => c.sen! < 0);
      for (const u of ups)
        for (const d of downs) {
          const dist = km(pos.get(u.park_id)!, pos.get(d.park_id)!);
          if (dist > maxKm) continue;
          const strength = Math.min(u.sen!, -d.sen!) / maxAbs;
          out.push({
            up: u.park_id, down: d.park_id, variable, period, km: Math.round(dist),
            upSen: u.sen!, downSen: d.sen!,
            score: strength * (1 - dist / (maxKm * 1.5)),
          });
        }
    }
  out.sort((a, b) => b.score - a.score);
  // One card per park pair, so the list is not the same two parks eight times.
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = [p.up, p.down].sort().join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, n);
}

// ---------- anomaly of the week ----------

/** ISO-style week number, so everyone sees the same anomaly all week. */
export function weekNumber(d = new Date()): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7) + t.getUTCFullYear() * 53;
}

export interface Anomaly {
  cell: AtlasCell;
  variable: string;
  period: string;
  /** How many parks with a confirmed trend go the other way. */
  crowd: number;
  /** How many parks have a confirmed trend here at all. */
  confirmed: number;
  against: boolean;
}

/** A confirmed trend that goes against most parks; falls back to the strongest confirmed trends. */
export function anomalyOfWeek(atlas: Atlas, week = weekNumber()): Anomaly | null {
  const against: (Anomaly & { rank: number })[] = [];
  const strong: (Anomaly & { rank: number })[] = [];
  for (const [variable, byPeriod] of Object.entries(atlas.atlas))
    for (const [period, cells] of Object.entries(byPeriod)) {
      const real = cells.filter((c) => c.verdict === "real" && c.sen != null && c.sen !== 0);
      if (real.length < 3) continue;
      const ups = real.filter((c) => c.sen! > 0).length;
      const downs = real.length - ups;
      const maxAbs = Math.max(...real.map((c) => Math.abs(c.sen!)));
      for (const c of real) {
        const mine = c.sen! > 0 ? ups : downs;
        const other = real.length - mine;
        const rank = Math.abs(c.sen!) / maxAbs;
        const a = { cell: c, variable, period, crowd: other, confirmed: real.length, against: other > mine, rank };
        if (other >= 2 * mine && other >= 3) against.push({ ...a, rank: 1 + rank * (other / real.length) });
        else if (rank > 0.9) strong.push(a);
      }
    }
  // Against-the-crowd trends rank first (rank > 1); the strongest confirmed trends fill the rest,
  // so the pick changes from week to week.
  const pool = [...against, ...strong].sort(
    (a, b) => b.rank - a.rank || a.cell.park_id.localeCompare(b.cell.park_id),
  );
  if (!pool.length) return null;
  const top = pool.slice(0, 12);
  const p = top[((week % top.length) + top.length) % top.length];
  return { cell: p.cell, variable: p.variable, period: p.period, crowd: p.crowd, confirmed: p.confirmed, against: p.against };
}

// ---------- head to head ----------

export interface Round {
  name: string;
  a: string;
  b: string;
  winner: "a" | "b" | "tie";
}

export function headToHead(ra: TrendRow | undefined, rb: TrendRow | undefined, fmt: (x: number) => string): {
  rounds: Round[];
  a: number;
  b: number;
} {
  const rounds: Round[] = [];
  const add = (name: string, x: number | null | undefined, y: number | null | undefined, lowWins: boolean, show: (v: number) => string) => {
    if (x == null || y == null) return;
    const better = lowWins ? x < y : x > y;
    const same = Math.abs(x - y) < 1e-9;
    rounds.push({ name, a: show(x), b: show(y), winner: same ? "tie" : better ? "a" : "b" });
  };
  add("Faster change", ra?.sen_per_decade != null ? Math.abs(ra.sen_per_decade) : null,
    rb?.sen_per_decade != null ? Math.abs(rb.sen_per_decade) : null, false, fmt);
  add("More certain (lower q)", ra?.q, rb?.q, true, (v) => v.toFixed(4));
  add("Clearer signal (S/N)", ra?.signal_to_noise != null ? Math.abs(ra.signal_to_noise) : null,
    rb?.signal_to_noise != null ? Math.abs(rb.signal_to_noise) : null, false, (v) => v.toFixed(2));
  add("Longer record", ra?.n_years, rb?.n_years, false, (v) => `${v} yrs`);
  return {
    rounds,
    a: rounds.filter((r) => r.winner === "a").length,
    b: rounds.filter((r) => r.winner === "b").length,
  };
}
