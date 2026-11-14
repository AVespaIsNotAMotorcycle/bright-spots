import { api, type Place } from "../../api";
import LineChartCard from "../../components/LineChartCard";
import { Status } from "../../components/Status";
import { useAsync } from "../../hooks";
import { SERIES_COLORS } from "../../palette";

export default function GracePanel({ place }: { place: Place }) {
  const state = useAsync(() => api.grace(place.lat, place.lon), `${place.lat},${place.lon}`);
  return (
    <div className="panel-stack">
      <Status state={state} loading="Reading bundled GRACE grid…">
        {(d) =>
          !d.land ? (
            <p className="muted">
              No data: the 1° cell at {d.cell_lat}, {d.cell_lon} is ocean.
            </p>
          ) : (
            <>
              <p className="small muted num">
                1° cell centred {d.cell_lat}, {d.cell_lon} · water-equivalent thickness anomaly vs the 2004–2009 mean
                · gap mid-2017 to mid-2018 between missions
              </p>
              <LineChartCard
                title="Regional water storage"
                unit="cm"
                series={[{ key: "lwe_cm", label: "Water storage anomaly", color: SERIES_COLORS[0] }]}
                rows={d.months}
                xKey="date"
              />
            </>
          )
        }
      </Status>
    </div>
  );
}
