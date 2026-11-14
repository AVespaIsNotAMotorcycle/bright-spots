/** Ordinary least-squares trend lines for time series charts. */

export interface Fit {
  slope: number; // units per year
  intercept: number;
  r2: number;
  n: number;
  x0: number; // first decimal year with data
  x1: number; // last decimal year with data
  deseasonalized: boolean; // calendar-month means removed before fitting
}

/** "YYYY", "YYYY-MM" or "YYYY-MM-DD" -> decimal year at the middle of that period. */
export function decimalYear(date: string): number | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(date);
  if (!m) return null;
  const y = Number(m[1]);
  if (!m[2]) return y + 0.5;
  const mo = Number(m[2]);
  if (!m[3]) return y + (mo - 0.5) / 12;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const start = Date.UTC(y, 0, 1);
  const doy = (Date.UTC(y, mo - 1, Number(m[3])) - start) / 86_400_000; // 0-based
  return y + (doy + 0.5) / (leap ? 366 : 365);
}

export function linearFit(points: Array<[number, number]>): Fit | null {
  const n = points.length;
  if (n < 3) return null;
  let sx = 0,
    sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  const mx = sx / n,
    my = sy / n;
  let sxx = 0,
    sxy = 0,
    syy = 0;
  for (const [x, y] of points) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  const xs = points.map((p) => p[0]);
  return { slope, intercept, r2, n, x0: Math.min(...xs), x1: Math.max(...xs), deseasonalized: false };
}

/** Calendar month (1-12) for "YYYY-MM" / "YYYY-MM-DD", null for yearly dates. */
function monthOf(date: string): number | null {
  const m = /^\d{4}-(\d{2})/.exec(date);
  return m ? Number(m[1]) : null;
}

/**
 * Fit `key` against `xKey` dates in `rows`, skipping nulls.
 *
 * Sub-annual data is deseasonalized first: each value has its calendar-month mean
 * subtracted (and the mean of those monthly means added back, so the line sits at
 * the series' level). Without this, the seasonal cycle leaks into the slope
 * whenever the window starts and ends in different seasons. Needs every calendar
 * month that appears to have >= 2 values; otherwise falls back to a raw fit.
 */
export function fitRows(rows: Array<Record<string, unknown>>, xKey: string, key: string): Fit | null {
  const pts: Array<{ x: number; y: number; m: number | null }> = [];
  for (const r of rows) {
    const d = r[xKey];
    const x = typeof d === "string" ? decimalYear(d) : null;
    const y = r[key];
    if (x != null && typeof y === "number" && Number.isFinite(y)) pts.push({ x, y, m: monthOf(d as string) });
  }

  const monthly = pts.length > 0 && pts.every((p) => p.m != null);
  if (monthly) {
    const sum = new Map<number, number>();
    const cnt = new Map<number, number>();
    for (const p of pts) {
      sum.set(p.m!, (sum.get(p.m!) ?? 0) + p.y);
      cnt.set(p.m!, (cnt.get(p.m!) ?? 0) + 1);
    }
    if ([...cnt.values()].every((c) => c >= 2)) {
      const means = new Map([...sum].map(([m, s]) => [m, s / cnt.get(m)!]));
      const level = [...means.values()].reduce((a, b) => a + b, 0) / means.size;
      const f = linearFit(pts.map((p) => [p.x, p.y - means.get(p.m!)! + level]));
      return f && { ...f, deseasonalized: true };
    }
  }
  return linearFit(pts.map((p) => [p.x, p.y]));
}

/** Copy rows adding `${key}__trend` fitted values within each fit's data range. */
export function withTrend<T extends Record<string, unknown>>(
  rows: T[],
  xKey: string,
  fits: Record<string, Fit | null>,
): Array<T & Record<string, number | null>> {
  return rows.map((r) => {
    const x = typeof r[xKey] === "string" ? decimalYear(r[xKey] as string) : null;
    const extra: Record<string, number | null> = {};
    for (const [key, f] of Object.entries(fits)) {
      extra[`${key}__trend`] =
        f && x != null && x >= f.x0 && x <= f.x1 ? Math.round((f.intercept + f.slope * x) * 1e4) / 1e4 : null;
    }
    return { ...r, ...extra };
  });
}

/** Human slope: per decade when the data span >= 10 years, else per year. */
export function describeSlope(f: Fit, unit: string): string {
  const perDecade = f.x1 - f.x0 >= 10;
  const v = f.slope * (perDecade ? 10 : 1);
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  return `${sign}${abs.toFixed(digits)} ${unit} per ${perDecade ? "decade" : "year"}`;
}
