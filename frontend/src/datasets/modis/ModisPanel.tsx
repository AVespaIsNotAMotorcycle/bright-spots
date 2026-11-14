import { useMemo, useState } from "react";
import { api, type DatasetInfo, type Place } from "../../api";
import LineChartCard from "../../components/LineChartCard";
import { Chips, Status } from "../../components/Status";
import { useAsync } from "../../hooks";
import { SERIES_COLORS } from "../../palette";
import { pickLandcover } from "./landcover";

const THIS_YEAR = new Date().getFullYear();
const RANGES = [
  { value: 2, label: "2 y" },
  { value: 5, label: "5 y" },
  { value: 10, label: "10 y" },
];

export default function ModisPanel({ place, dataset }: { place: Place; dataset: DatasetInfo }) {
  const products = dataset.products ?? {};
  const [product, setProduct] = useState("MOD13Q1");
  const [years, setYears] = useState(2);
  const info = products[product];
  const start = Math.max(THIS_YEAR - years + 1, info?.first_year ?? 2000);

  const series = useAsync(
    () => api.modisSeries(place.lat, place.lon, product, start, THIS_YEAR),
    `${place.lat},${place.lon},${product},${start}`,
  );
  // CCI answers in milliseconds; ORNL (often a minute or a timeout) replaces it if it answers.
  const cciLandcover = useAsync(() => api.cciLandcover(place.lat, place.lon), `${place.lat},${place.lon}`);
  const ornlLandcover = useAsync(() => api.landcover(place.lat, place.lon), `${place.lat},${place.lon}`);
  const landcover = pickLandcover(cciLandcover, ornlLandcover);
  const landcoverSource =
    landcover.status !== "ok" ? null : landcover.data.lc.source === "MCD12Q1" ? "MCD12Q1, IGBP" : landcover.data.lc.source;

  const rows = useMemo(
    () =>
      series.status === "ok"
        ? series.data.observations.filter((o) => o.kept).map((o) => ({ date: o.date, value: o.value }))
        : [],
    [series],
  );

  return (
    <div className="panel-stack">
      <div className="row gap-16 wrap">
        <Chips
          label="Product"
          options={Object.entries(products).map(([id, p]) => ({ value: id, label: p.name, title: id }))}
          value={product}
          onChange={setProduct}
        />
        <Chips label="Years" options={RANGES} value={years} onChange={setYears} />
      </div>

      <section className="card">
        <header className="card-head">
          <h3 className="section-title">Land cover{landcoverSource ? ` (${landcoverSource})` : ""}</h3>
          <span className="tag tag-measured">Measured</span>
        </header>
        <Status state={landcover} loading="Fetching land cover…">
          {({ lc, note }) => (
            <>
              {note && <p className="small muted">{note}</p>}
              <div className="kv-grid">
                <div>
                  <div className="micro muted">First ({lc.first?.year ?? "–"})</div>
                  <div>{lc.first?.name ?? "No data"}</div>
                  {lc.first?.group && <div className="micro muted">{lc.first.group}</div>}
                </div>
                <div>
                  <div className="micro muted">Latest ({lc.latest?.year ?? "–"})</div>
                  <div>{lc.latest?.name ?? "No data"}</div>
                  {lc.latest?.group && <div className="micro muted">{lc.latest.group}</div>}
                </div>
                <div>
                  <div className="micro muted">Changed group</div>
                  <div>{lc.changed == null ? "Unknown" : lc.changed ? "Yes" : "No"}</div>
                </div>
              </div>
            </>
          )}
        </Status>
      </section>

      <Status state={series} loading={`Fetching ${info?.name ?? product} (${start}–${THIS_YEAR}) from ORNL…`}>
        {(d) => (
          <>
            <p className="small muted num">
              {d.requests} requests{d.failed_requests ? `, ${d.failed_requests} failed` : ""} ·{" "}
              {d.observations.length} composites, {rows.length} pass quality filter
            </p>
            <LineChartCard
              title={info?.name ?? product}
              unit={d.unit}
              series={[{ key: "value", label: info?.name ?? product, color: SERIES_COLORS[0] }]}
              rows={rows}
              xKey="date"
            />
          </>
        )}
      </Status>
    </div>
  );
}
