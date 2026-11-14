import { useEffect, useMemo, useState } from "react";
import { api, type DatasetInfo, type Place, type Station } from "../../api";
import LineChartCard, { type ChartSeries } from "../../components/LineChartCard";
import { Chips, Status } from "../../components/Status";
import { useAsync } from "../../hooks";
import { SERIES_COLORS } from "../../palette";

const RANGES = [
  { value: 10, label: "10 y" },
  { value: 30, label: "30 y" },
  { value: 0, label: "All" },
];
const RADII = [10, 25, 50, 100, 200].map((r) => ({ value: r, label: `${r} km` }));
const DEFAULT_VARS = ["TAVG", "TMAX", "TMIN", "PRCP"];

export default function GsomPanel({ place, dataset }: { place: Place; dataset: DatasetInfo }) {
  const catalog = useMemo(() => dataset.variables ?? {}, [dataset]);
  const [radius, setRadius] = useState(50);
  const [station, setStation] = useState<Station | null>(null);
  const [vars, setVars] = useState<string[]>(DEFAULT_VARS);
  const [rangeYears, setRangeYears] = useState(10);

  const stations = useAsync(
    () => api.gsomStations(place.lat, place.lon, radius),
    `${place.lat},${place.lon},${radius}`,
  );

  // Auto-pick the nearest station with temperature and recent data.
  useEffect(() => {
    if (stations.status !== "ok") {
      setStation(null);
      return;
    }
    const d = stations.data;
    setStation(d.find((s) => s.variables.includes("TAVG") && s.end_date >= "2020") ?? d[0] ?? null);
  }, [stations]);

  const available = useMemo(() => Object.keys(catalog).filter((v) => station?.variables.includes(v)), [catalog, station]);
  const activeVars = vars.filter((v) => available.includes(v));

  const [start, end] = useMemo(() => {
    if (!station) return ["", ""];
    const endDate = station.end_date;
    if (rangeYears === 0) return [station.start_date, endDate];
    const startDate = `${Number(endDate.slice(0, 4)) - rangeYears}${endDate.slice(4, 7)}-01`;
    return [startDate < station.start_date ? station.start_date : startDate, endDate];
  }, [station, rangeYears]);

  const series = useAsync(
    () => api.gsomSeries(station!.id, activeVars, start, end),
    station && activeVars.length ? `${station.id},${activeVars.join(",")},${start},${end}` : null,
  );

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

  return (
    <div className="panel-stack">
      <Chips label="Search radius" options={RADII} value={radius} onChange={setRadius} />
      <div className="layout">
        <aside className="stations card">
          <h3 className="section-title">Stations</h3>
          <Status state={stations} loading="Searching NOAA…">
            {(d) =>
              d.length === 0 ? (
                <p className="muted small">No GSOM stations within {radius} km. Try a wider radius.</p>
              ) : (
                <ul className="station-list">
                  {d.map((s) => (
                    <li key={s.id}>
                      <button className={`station ${station?.id === s.id ? "active" : ""}`} onClick={() => setStation(s)}>
                        <span className="station-name">{s.name}</span>
                        <span className="micro muted num">
                          {s.distance_km} km · {s.start_date.slice(0, 4)}–{s.end_date.slice(0, 4)} · {s.variables.length}{" "}
                          vars
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            }
          </Status>
        </aside>

        <div className="results">
          {station && (
            <div className="card station-head">
              <div>
                <h2 className="headline">{station.name}</h2>
                <p className="small muted num">
                  {station.id} · {station.lat.toFixed(3)}, {station.lon.toFixed(3)} · record {station.start_date} to{" "}
                  {station.end_date}
                </p>
              </div>
              <Chips label="Time range" options={RANGES} value={rangeYears} onChange={setRangeYears} />
              <div className="row gap-8 wrap" role="group" aria-label="Variables">
                {available.map((v) => (
                  <button
                    key={v}
                    title={catalog[v].name}
                    className={`chip ${vars.includes(v) ? "active" : ""}`}
                    aria-pressed={vars.includes(v)}
                    onClick={() => setVars((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          {station && activeVars.length === 0 && <p className="muted small">Pick at least one variable.</p>}
          <Status state={series} loading="Loading monthly data…">
            {(d) =>
              d.points.length === 0 ? (
                <p className="muted small">NOAA returned no rows for this range.</p>
              ) : (
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
              )
            }
          </Status>
        </div>
      </div>
    </div>
  );
}
