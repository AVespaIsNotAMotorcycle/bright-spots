export interface VariableInfo {
  name: string;
  unit: string;
  group: string;
}

export interface GibsLayer {
  tiles: string;
  maxzoom: number;
  first_date?: string;
}

export interface DatasetInfo {
  id: string;
  name: string;
  gives: string;
  source: string;
  url: string;
  access: "live" | "bundled" | "browser";
  variables?: Record<string, VariableInfo>;
  products?: Record<string, { name: string; unit: string; first_year: number }>;
  layers?: Record<string, GibsLayer>;
  resolutions?: Record<string, string>;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  bbox?: number[] | null;
  source: "coordinates" | "nominatim" | "preset" | "device";
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distance_km: number;
  start_date: string;
  end_date: string;
  variables: string[];
}

export interface SeriesPoint {
  date: string;
  values: Record<string, number | null>;
}

export interface Series {
  station: string;
  variables: string[];
  points: SeriesPoint[];
}

export interface PowerResult {
  lat: number;
  lon: number;
  elevation_m: number | null;
  variables: string[];
  monthly: SeriesPoint[];
  yearly: { year: number; rain_mm: number | null; t2m_c: number | null; gwetroot: number | null }[];
}

export interface ProductSeries {
  product: string;
  unit: string;
  requests: number;
  failed_requests: number;
  observations: { date: string; value: number | null; kept: boolean }[];
}

export interface LandCoverYear {
  year: number;
  code: number;
  name: string;
  group: string | null;
}

export interface LandCover {
  first: LandCoverYear | null;
  latest: LandCoverYear | null;
  changed: boolean | null;
  /** "MCD12Q1" (ORNL), or "ESA CCI / C3S" when the bundled fallback answered. */
  source: string;
}

export interface GraceResult {
  cell_lat: number;
  cell_lon: number;
  land: boolean;
  months: { date: string; lwe_cm: number | null }[];
}

export interface KoppenClass {
  id: number;
  code: string;
  name: string;
  rgb: number[];
}

export interface KoppenResult {
  now: KoppenClass | null;
  future: KoppenClass | null;
  changed: boolean | null;
}

export interface RainDivGrid {
  res: number;
  lat0: number;
  lon0: number;
  nlat: number;
  nlon: number;
  base_start: number;
  base_end: number;
  post_start: number;
  post_end: number;
  pct: (number | null)[];
  mm: (number | null)[];
  z: (number | null)[];
}

export interface RainDivPoint {
  res: number;
  cell_lat: number;
  cell_lon: number;
  land: boolean;
  base_start: number;
  base_end: number;
  post_start: number;
  post_end: number;
  pct: number | null;
  mm: number | null;
  z: number | null;
  base_mean: number | null;
  slope_pre: number | null;
  years: { year: number; actual: number | null; fit: number | null }[];
}

type Params = Record<string, string | number>;

// Session cache so switching dataset tabs doesn't refetch.
const cache = new Map<string, Promise<unknown>>();

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) {
    let detail: unknown = resp.statusText;
    try {
      detail = (await resp.json()).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`${resp.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  return resp.json() as Promise<T>;
}

function getJson<T>(path: string, params?: Params): Promise<T> {
  const qs = params
    ? "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
    : "";
  const url = `${path}${qs}`;
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetchJson<T>(url);
    cache.set(url, p);
    p.catch(() => cache.delete(url)); // don't cache failures
  }
  return p;
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export const api = {
  datasets: () => getJson<DatasetInfo[]>("/api/datasets"),
  geocode: (q: string) => getJson<Place[]>("/api/geocode", { q }),
  power: (lat: number, lon: number, start: number) =>
    getJson<PowerResult>("/api/datasets/power/monthly", { lat: r4(lat), lon: r4(lon), start }),
  modisSeries: (lat: number, lon: number, product: string, start: number, end: number) =>
    getJson<ProductSeries>("/api/datasets/modis/series", { lat: r4(lat), lon: r4(lon), product, start, end }),
  landcover: (lat: number, lon: number) =>
    getJson<LandCover>("/api/datasets/modis/landcover", { lat: r4(lat), lon: r4(lon) }),
  grace: (lat: number, lon: number) => getJson<GraceResult>("/api/datasets/grace/series", { lat: r4(lat), lon: r4(lon) }),
  koppen: (lat: number, lon: number) =>
    getJson<KoppenResult>("/api/datasets/koppen/lookup", { lat: r4(lat), lon: r4(lon) }),
  raindivGrid: (res: string) => getJson<RainDivGrid>("/api/datasets/raindiv/grid", { res }),
  raindivPoint: (lat: number, lon: number, res: string) =>
    getJson<RainDivPoint>("/api/datasets/raindiv/point", { lat: r4(lat), lon: r4(lon), res }),
  gsomStations: (lat: number, lon: number, radiusKm: number) =>
    getJson<Station[]>("/api/datasets/gsom/stations", { lat: r4(lat), lon: r4(lon), radius_km: radiusKm }),
  gsomSeries: (station: string, variables: string[], start: string, end: string) =>
    getJson<Series>("/api/datasets/gsom/series", { station, variables: variables.join(","), start, end }),
};
