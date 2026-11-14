import { useMemo, useState } from "react";
import { api, type Place } from "../../api";
import { Chips, Status } from "../../components/Status";
import LineChartCard from "../../components/LineChartCard";
import { useAsync } from "../../hooks";
import { SERIES_COLORS } from "../../palette";

const START_OPTIONS = [
  { value: 2000, label: "Since 2000" },
  { value: 2015, label: "Since 2015" },
  { value: 1981, label: "Since 1981" },
];

export default function PowerPanel({ place }: { place: Place }) {
  const [start, setStart] = useState(2000);
  const [view, setView] = useState<"monthly" | "yearly">("yearly");
  const state = useAsync(() => api.power(place.lat, place.lon, start), `${place.lat},${place.lon},${start}`);

  const monthlyRows = useMemo(
    () => (state.status === "ok" ? state.data.monthly.map((p) => ({ date: p.date, ...p.values })) : []),
    [state],
  );
  const yearlyRows = useMemo(
    () =>
      state.status === "ok"
        ? state.data.yearly.map((y) => ({ date: String(y.year), RAIN: y.rain_mm, T2M: y.t2m_c, GWETROOT: y.gwetroot }))
        : [],
    [state],
  );
  const rows = view === "monthly" ? monthlyRows : yearlyRows;

  return (
    <div className="panel-stack">
      <div className="row gap-16 wrap">
        <Chips label="Start year" options={START_OPTIONS} value={start} onChange={setStart} />
        <Chips
          label="Resolution"
          options={[
            { value: "yearly", label: "Yearly" },
            { value: "monthly", label: "Monthly" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      <Status state={state} loading="Fetching NASA POWER…">
        {(d) => (
          <>
            <p className="small muted num">
              ~50 km grid cell · elevation {d.elevation_m?.toFixed(0) ?? "?"} m ·{" "}
              {view === "yearly" ? "only complete years are summed/averaged" : "rain is mm/day × days in month"}
            </p>
            <div className="chart-grid">
              <LineChartCard
                title={view === "yearly" ? "Rain, yearly total" : "Rain, monthly total"}
                unit={view === "yearly" ? "mm/year" : "mm/month"}
                series={[{ key: "RAIN", label: "Rainfall", color: SERIES_COLORS[0] }]}
                rows={rows}
                xKey="date"
              />
              <LineChartCard
                title="Air temperature (2 m)"
                unit="°C"
                series={[{ key: "T2M", label: "Air temperature", color: SERIES_COLORS[0] }]}
                rows={rows}
                xKey="date"
              />
              <LineChartCard
                title="Root-zone soil wetness (model)"
                unit="0–1"
                series={[{ key: "GWETROOT", label: "Soil wetness", color: SERIES_COLORS[0] }]}
                rows={rows}
                xKey="date"
              />
            </div>
          </>
        )}
      </Status>
    </div>
  );
}
