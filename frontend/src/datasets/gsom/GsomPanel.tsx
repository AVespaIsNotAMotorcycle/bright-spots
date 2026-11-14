import { useEffect, useMemo, useState } from "react";
import { api, type DatasetInfo, type Series, type Station } from "../../api";
import LineChartCard, { type ChartSeries } from "../../components/LineChartCard";

// Dark-mode categorical slots (validated against --surface-2 with the dataviz validator).
const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];

const PRESETS = [
  { name: "New York", lat: 40.78, lon: -73.97 },
  { name: "London", lat: 51.48, lon: -0.45 },
  { name: "Tokyo", lat: 35.69, lon: 139.69 },
  { name: "Nairobi", lat: -1.29, lon: 36.82 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
];

const RANGES = [
  { label: "10 y", years: 10 },
  { label: "30 y", years: 30 },
  { label: "All", years: 0 },
];

const DEFAULT_VARS = ["TAVG", "TMAX", "TMIN", "PRCP"];

type Async<T> = { status: "idle" } | { status: "loading" } | { status: "error"; error: string } | { status: "ok"; data: T };

export default function GsomPanel({ dataset }: { dataset: DatasetInfo }) {
  const catalog = dataset.variables;

  const [lat, setLat] = useState(PRESETS[0].lat);
  const [lon, setLon] = useState(PRESETS[0].lon);
  const [radius, setRadius] = useState(50);
  const [stations, setStations] = useState<Async<Station[]>>({ status: "idle" });
  const [station, setStation] = useState<Station | null>(null);
  const [vars, setVars] = useState<string[]>(DEFAULT_VARS);
  const [rangeYears, setRangeYears] = useState(10);
  const [series, setSeries] = useState<Async<Series>>({ status: "idle" });

  async function search(la = lat, lo = lon) {
    setStations({ status: "loading" });
    setStation(null);
    setSeries({ status: "idle" });
    try {
      const data = await api.gsomStations(la, lo, radius);
      setStations({ status: "ok", data });
      // Prefer the nearest station that reports temperature and has recent data.
      const best = data.find((s) => s.variables.includes("TAVG") && s.end_date >= "2020") ?? data[0];
      if (best) setStation(best);
    } catch (e) {
      setStations({ status: "error", error: String(e) });
    }
  }

  // Initial load.
  useEffect(() => {
    void search();
  }, []);

  const available = useMemo(
    () => Object.keys(catalog).filter((v) => station?.variables.includes(v)),
    [catalog, station],
  );
  const activeVars = vars.filter((v) => available.includes(v));

  const [start, end] = useMemo(() => {
    if (!station) return ["", ""];
    const endDate = station.end_date;
    if (rangeYears === 0) return [station.start_date, endDate];
    const y = Number(endDate.slice(0, 4)) - rangeYears;
    const startDate = `${y}${endDate.slice(4, 7)}-01`;
    return [startDate < station.start_date ? station.start_date : startDate, endDate];
  }, [station, rangeYears]);

  useEffect(() => {
    if (!station || activeVars.length === 0) {
      setSeries({ status: "idle" });
      return;
    }
    let cancelled = false;
    setSeries({ status: "loading" });
    api
      .gsomSeries(station.id, activeVars, start, end)
      .then((data) => !cancelled && setSeries({ status: "ok", data }))
      .catch((e) => !cancelled && setSeries({ status: "error", error: String(e) }));
    return () => {
      cancelled = true;
    };
    // activeVars identity changes each render; key on its contents.
  }, [station, activeVars.join(","), start, end]);

  // One chart per unit. Colour slot is fixed by the variable's position in its
  // unit group of the catalog, so toggling variables never repaints the others.
  const charts = useMemo(() => {
    if (series.status !== "ok") return [];
    const rows = series.data.points.map((p) => ({ date: p.date, ...p.values }));
    const groups = new Map<string, string[]>();
    for (const [id, info] of Object.entries(catalog)) {
      const key = `${info.group}|${info.unit}`;
      groups.set(key, [...(groups.get(key) ?? []), id]);
    }
    return [...groups.entries()]
      .map(([key, ids]) => {
        const [group, unit] = key.split("|");
        const s: ChartSeries[] = ids
          .map((id, i) => ({ key: id, label: catalog[id].name, color: SERIES_COLORS[i % SERIES_COLORS.length] }))
          .filter((c) => series.data.variables.includes(c.key));
        return { group, unit, series: s, rows };
      })
      .filter((c) => c.series.length > 0);
  }, [series, catalog]);

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const la = +pos.coords.latitude.toFixed(3);
      const lo = +pos.coords.longitude.toFixed(3);
      setLat(la);
      setLon(lo);
      void search(la, lo);
    });
  }

  return (
    <div className="panel-body">
      <div className="controls">
        <form
          className="row gap-8 wrap"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <label className="field">
            <span>Lat</span>
            <input type="number" step="any" min={-90} max={90} value={lat} onChange={(e) => setLat(+e.target.value)} />
          </label>
          <label className="field">
            <span>Lon</span>
            <input type="number" step="any" min={-180} max={180} value={lon} onChange={(e) => setLon(+e.target.value)} />
          </label>
          <label className="field">
            <span>Radius</span>
            <select value={radius} onChange={(e) => setRadius(+e.target.value)}>
              {[10, 25, 50, 100, 200].map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn">
            Find stations
          </button>
          <button type="button" className="btn btn-ghost" onClick={useMyLocation}>
            My location
          </button>
        </form>
        <div className="row gap-8 wrap">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              className="chip"
              onClick={() => {
                setLat(p.lat);
                setLon(p.lon);
                void search(p.lat, p.lon);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="layout">
        <aside className="stations card">
          <h3 className="section-title">Stations</h3>
          {stations.status === "loading" && <p className="muted small">Searching NOAA…</p>}
          {stations.status === "error" && <p className="error small">{stations.error}</p>}
          {stations.status === "ok" && stations.data.length === 0 && (
            <p className="muted small">No GSOM stations within {radius} km. Try a wider radius.</p>
          )}
          {stations.status === "ok" && (
            <ul className="station-list">
              {stations.data.map((s) => (
                <li key={s.id}>
                  <button
                    className={`station ${station?.id === s.id ? "active" : ""}`}
                    onClick={() => setStation(s)}
                  >
                    <span className="station-name">{s.name}</span>
                    <span className="micro muted num">
                      {s.distance_km} km · {s.start_date.slice(0, 4)}–{s.end_date.slice(0, 4)} · {s.variables.length} vars
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="results">
          {station && (
            <div className="card station-head">
              <div>
                <h2 className="headline">{station.name}</h2>
                <p className="small muted num">
                  {station.id} · {station.lat.toFixed(3)}, {station.lon.toFixed(3)} · record{" "}
                  {station.start_date} to {station.end_date}
                </p>
              </div>
              <div className="row gap-8 wrap">
                {RANGES.map((r) => (
                  <button
                    key={r.label}
                    className={`chip ${rangeYears === r.years ? "active" : ""}`}
                    onClick={() => setRangeYears(r.years)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="row gap-8 wrap">
                {available.map((v) => (
                  <button
                    key={v}
                    title={catalog[v].name}
                    className={`chip ${vars.includes(v) ? "active" : ""}`}
                    onClick={() => setVars((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {series.status === "loading" && <p className="muted small">Loading monthly data…</p>}
          {series.status === "error" && <p className="error small">{series.error}</p>}
          {station && activeVars.length === 0 && <p className="muted small">Pick at least one variable.</p>}
          {series.status === "ok" && series.data.points.length === 0 && (
            <p className="muted small">NOAA returned no rows for this range.</p>
          )}
          <div className="chart-grid">
            {charts.map((c) => (
              <LineChartCard
                key={`${c.group}|${c.unit}`}
                title={c.group}
                unit={c.unit}
                series={c.series}
                rows={c.rows}
                xKey="date"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
