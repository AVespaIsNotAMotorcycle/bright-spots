// Types for the Trend Detective atlas (GET /api/trends/atlas, GET /api/trends/parks/:id).

export type Verdict = "real" | "possible" | "none" | "short" | "flat";

export interface AtlasCell {
  park_id: string;
  sen: number | null;      // Sen's slope per decade
  q: number | null;        // FDR-adjusted p-value
  verdict: Verdict;
}

export interface VariableMeta {
  label: string;
  unit: string;
}

export interface Atlas {
  variables: Record<string, VariableMeta>;
  periods: string[];
  atlas: Record<string, Record<string, AtlasCell[]>>;  // variable -> period -> cells[]
  /** Years the data really covers, worked out by the backend from the series. */
  coverage?: { first_year: number; last_full_year: number; last_year: number; last_month: number };
}

export interface TrendRow {
  variable: string;
  period: string;
  n_years: number | null;
  first_year: number | null;
  last_year: number | null;
  mean: number | null;
  sen_per_decade: number | null;
  sen_per_decade_f: number | null;
  ols_per_decade: number | null;
  ols_ci_low: number | null;
  ols_ci_high: number | null;
  ols_p: number | null;
  mk_p: number | null;
  p: number | null;
  p_method: string | null;
  q: number | null;
  signal_to_noise: number | null;
  lag1_autocorr: number | null;
  tests_agree: boolean | null;
  verdict: Verdict;
  power_sen_per_decade: number | null;
  sources_same_direction: boolean | null;
}

export interface YearlySeries {
  years: number[];
  values: number[];
}

export interface ParkTrends {
  park: {
    park_id: string;
    name: string;
    lat: number;
    lon: number;
    unit_code: string;
  };
  source: string;
  trends: TrendRow[];
  series: Record<string, Record<string, YearlySeries>>;
}

export const PERIOD_LABEL: Record<string, string> = {
  "1": "Jan", "2": "Feb", "3": "Mar", "4": "Apr", "5": "May", "6": "Jun",
  "7": "Jul", "8": "Aug", "9": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
  "DJF": "Winter", "MAM": "Spring", "JJA": "Summer", "SON": "Autumn",
  "annual": "Annual",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  real: "Real",
  possible: "Possible",
  none: "No trend",
  short: "Too little data",
  flat: "No variation",
};

/** A p or q value with a floor, so 0.00004 does not show as 0.0000. */
export function fmtQ(q: number | null | undefined, digits = 4): string {
  if (q == null) return "–";
  const floor = 10 ** -digits;
  return q < floor ? `< ${floor.toFixed(digits)}` : q.toFixed(digits);
}
