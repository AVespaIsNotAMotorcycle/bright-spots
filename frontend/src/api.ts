export interface VariableInfo {
  name: string;
  unit: string;
  group: string;
}

export interface DatasetInfo {
  id: string;
  name: string;
  source: string;
  url: string;
  kind: string;
  variables: Record<string, VariableInfo>;
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

async function getJson<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const qs = params
    ? "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
    : "";
  const resp = await fetch(`${path}${qs}`);
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      detail = (await resp.json()).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`${resp.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  datasets: () => getJson<DatasetInfo[]>("/api/datasets"),
  gsomStations: (lat: number, lon: number, radiusKm: number) =>
    getJson<Station[]>("/api/datasets/gsom/stations", { lat, lon, radius_km: radiusKm }),
  gsomSeries: (station: string, variables: string[], start: string, end: string) =>
    getJson<Series>("/api/datasets/gsom/series", {
      station,
      variables: variables.join(","),
      start,
      end,
    }),
};
