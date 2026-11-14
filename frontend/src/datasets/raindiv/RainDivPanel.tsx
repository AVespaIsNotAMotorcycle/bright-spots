import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type DatasetInfo, type Place, type RainDivGrid } from "../../api";
import { Chips, Status } from "../../components/Status";
import { useAsync } from "../../hooks";
import { SERIES_COLORS } from "../../palette";

// Diverging ramp: matched OKLCH lightness per arm (0.47/0.58/0.69/0.80) from a
// neutral gray (L 0.36). Blue = wetter than the old trend, orange = drier.
const NEUTRAL = "#3d3d3d";
const NO_DATA = "var(--surface)";
const WETTER = ["#405c82", "#4c7cba", "#5d9df0", "#92c1fe"];
const DRIER = ["#7a4f35", "#ad6638", "#de7f41", "#fda670"];
// Class edges in % of the 1951–1999 mean; chosen from the measured distribution
// (5th/95th percentiles about -22% / +28..33%).
const EDGES = [5, 10, 20, 40];
const Z_NOISE = 2;

type Metric = "pct" | "mm";
const MM_EDGES = [25, 50, 100, 200];

function colorFor(v: number, edges: number[]): string {
  const a = Math.abs(v);
  if (a < edges[0]) return NEUTRAL;
  const k = a >= edges[3] ? 3 : a >= edges[2] ? 2 : a >= edges[1] ? 1 : 0;
  return v > 0 ? WETTER[k] : DRIER[k];
}

function legendItems(edges: number[]) {
  const f = (x: number) => String(x);
  return [
    { color: DRIER[3], label: `≤−${f(edges[3])}` },
    { color: DRIER[2], label: `−${f(edges[2])}` },
    { color: DRIER[1], label: `−${f(edges[1])}` },
    { color: DRIER[0], label: `−${f(edges[0])}` },
    { color: NEUTRAL, label: `±${f(edges[0])}` },
    { color: WETTER[0], label: `+${f(edges[0])}` },
    { color: WETTER[1], label: `+${f(edges[1])}` },
    { color: WETTER[2], label: `+${f(edges[2])}` },
    { color: WETTER[3], label: `≥+${f(edges[3])}` },
  ];
}

interface Hover {
  x: number;
  y: number;
  lat: number;
  lon: number;
  pct: number | null;
  mm: number | null;
  z: number | null;
}

function cellAt(g: RainDivGrid, lat: number, lon: number): number | null {
  const i = Math.floor((g.lat0 + g.res / 2 - lat) / g.res);
  const j = Math.floor((lon - (g.lon0 - g.res / 2)) / g.res);
  if (i < 0 || i >= g.nlat || j < 0 || j >= g.nlon) return null;
  return i * g.nlon + j;
}

function WorldMap({
  grid,
  metric,
  hideNoise,
  place,
  onPick,
}: {
  grid: RainDivGrid;
  metric: Metric;
  hideNoise: boolean;
  place: Place;
  onPick: (lat: number, lon: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Equirectangular, clipped to 60°S..84°N: GPCC has no Antarctic data.
  const LAT_TOP = 84,
    LAT_BOTTOM = -60;
  const height = Math.round((width * (LAT_TOP - LAT_BOTTOM)) / 360);
  const toXY = (lat: number, lon: number) => [((lon + 180) / 360) * width, ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * height];

  useEffect(() => {
    const c = canvas.current;
    if (!c || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(c);
    ctx.fillStyle = css.getPropertyValue("--surface").trim() || "#0f1626";
    ctx.fillRect(0, 0, width, height);

    const values = metric === "pct" ? grid.pct : grid.mm;
    const edges = metric === "pct" ? EDGES : MM_EDGES;
    const cw = (grid.res / 360) * width;
    const ch = (grid.res / (LAT_TOP - LAT_BOTTOM)) * height;
    for (let i = 0; i < grid.nlat; i++) {
      const lat = grid.lat0 - i * grid.res;
      if (lat > LAT_TOP + grid.res || lat < LAT_BOTTOM - grid.res) continue;
      for (let j = 0; j < grid.nlon; j++) {
        const k = i * grid.nlon + j;
        const v = values[k];
        if (v == null) continue;
        const z = grid.z[k];
        ctx.fillStyle = hideNoise && (z == null || Math.abs(z) < Z_NOISE) ? NEUTRAL : colorFor(v, edges);
        const [x, y] = toXY(lat + grid.res / 2, grid.lon0 + j * grid.res - grid.res / 2);
        // +0.5 px overlap avoids hairline seams between cells.
        ctx.fillRect(x, y, cw + 0.5, ch + 0.5);
      }
    }

    // Graticule: 30° lines, equator slightly stronger.
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.strokeStyle = lat === 0 ? "rgba(154,168,192,0.35)" : "rgba(154,168,192,0.15)";
      const [, y] = toXY(lat, 0);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(154,168,192,0.15)";
    for (let lon = -150; lon <= 150; lon += 30) {
      const [x] = toXY(0, lon);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Selected place.
    const [px, py] = toXY(place.lat, place.lon);
    ctx.strokeStyle = "#7cc4ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.stroke();
  }, [grid, metric, hideNoise, width, height, place.lat, place.lon]); // toXY derives from width/height

  function locate(e: React.MouseEvent) {
    const r = canvas.current!.getBoundingClientRect();
    const x = e.clientX - r.left,
      y = e.clientY - r.top;
    const lon = (x / width) * 360 - 180;
    const lat = LAT_TOP - (y / height) * (LAT_TOP - LAT_BOTTOM);
    return { x, y, lat, lon };
  }

  return (
    <div ref={wrap} className="worldmap">
      <canvas
        ref={canvas}
        style={{ width, height }}
        role="img"
        aria-label="World map of post-2000 rainfall divergence from the pre-2000 trend; hover for values, click to select a cell"
        onMouseMove={(e) => {
          const p = locate(e);
          const k = cellAt(grid, p.lat, p.lon);
          if (k == null || grid.pct[k] == null) return setHover(null);
          setHover({ ...p, pct: grid.pct[k], mm: grid.mm[k], z: grid.z[k] });
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const p = locate(e);
          onPick(p.lat, p.lon);
        }}
      />
      {hover && (
        <div
          className="map-tip small num"
          style={{ left: Math.min(hover.x + 12, width - 200), top: Math.max(hover.y - 8, 0) }}
        >
          <div className="muted micro">
            {hover.lat.toFixed(1)}°, {hover.lon.toFixed(1)}°
          </div>
          <div>
            {hover.pct! > 0 ? "+" : ""}
            {hover.pct}% vs trend ({hover.mm! > 0 ? "+" : ""}
            {hover.mm} mm/yr)
          </div>
          <div className="muted micro">
            z = {hover.z} · {hover.z != null && Math.abs(hover.z) >= Z_NOISE ? "beyond" : "within"} year-to-year noise
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ grid }: { grid: RainDivGrid }) {
  // Area-weighted (cos latitude) shares of land cells.
  const s = useMemo(() => {
    let tot = 0,
      wet = 0,
      dry = 0;
    for (let i = 0; i < grid.nlat; i++) {
      const w = Math.cos(((grid.lat0 - i * grid.res) * Math.PI) / 180);
      for (let j = 0; j < grid.nlon; j++) {
        const k = i * grid.nlon + j;
        const z = grid.z[k];
        if (grid.pct[k] == null || z == null) continue;
        tot += w;
        if (z >= Z_NOISE) wet += w;
        else if (z <= -Z_NOISE) dry += w;
      }
    }
    return { wet: (wet / tot) * 100, dry: (dry / tot) * 100, noise: ((tot - wet - dry) / tot) * 100 };
  }, [grid]);
  return (
    <div className="stat-row">
      <div className="stat">
        <div className="stat-value num">{s.wet.toFixed(0)}%</div>
        <div className="small muted">of land area wetter than the old trend (z ≥ 2)</div>
      </div>
      <div className="stat">
        <div className="stat-value num">{s.dry.toFixed(0)}%</div>
        <div className="small muted">drier than the old trend (z ≤ −2)</div>
      </div>
      <div className="stat">
        <div className="stat-value num">{s.noise.toFixed(0)}%</div>
        <div className="small muted">within year-to-year noise</div>
      </div>
    </div>
  );
}

function CellChart({ place, res }: { place: Place; res: string }) {
  const state = useAsync(() => api.raindivPoint(place.lat, place.lon, res), `${place.lat},${place.lon},${res}`);
  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3 className="section-title">Selected cell: actual vs pre-2000 trend</h3>
          <span className="small muted">mm/year · click the map to change</span>
        </div>
        <span className="tag tag-measured">Measured</span>
      </header>
      <Status state={state} loading="Loading cell…">
        {(d) => {
          if (!d.land) return <p className="muted small">No GPCC land data in this cell.</p>;
          const rows = d.years
            .filter((y) => y.year >= d.base_start && y.year <= d.post_end)
            .map((y) => ({
              year: y.year,
              actual: y.actual,
              fit: y.year <= d.base_end ? y.fit : null,
              // Start the extrapolation at the last baseline year so the lines join.
              extrap: y.year >= d.base_end ? y.fit : null,
            }));
          return (
            <>
              <p className="small num">
                Cell {d.cell_lat}°, {d.cell_lon}° ({d.res}°): {d.post_start}–{d.post_end} averaged{" "}
                <strong>
                  {d.pct! > 0 ? "+" : ""}
                  {d.pct}%
                </strong>{" "}
                ({d.mm! > 0 ? "+" : ""}
                {d.mm} mm/yr) vs the extended {d.base_start}–{d.base_end} trend; z = {d.z} (
                {d.z != null && Math.abs(d.z) >= Z_NOISE ? "beyond" : "within"} year-to-year noise). Baseline mean{" "}
                {d.base_mean} mm/yr, pre-2000 slope {d.slope_pre! > 0 ? "+" : ""}
                {d.slope_pre} mm/yr per year.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -4 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <ReferenceArea
                    x1={d.post_start - 0.5}
                    x2={d.post_end + 0.5}
                    fill="var(--text-muted)"
                    fillOpacity={0.06}
                    ifOverflow="visible"
                  />
                  <XAxis
                    dataKey="year"
                    type="number"
                    domain={[d.base_start, d.post_end]}
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    stroke="var(--border)"
                  />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} stroke="var(--border)" width={52} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      color: "var(--text)",
                      fontSize: 13,
                    }}
                    labelStyle={{ color: "var(--text-muted)" }}
                    itemStyle={{ color: "var(--text)" }}
                    formatter={(v) => (typeof v === "number" ? `${v} mm` : String(v))}
                  />
                  <Legend
                    iconType="plainline"
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => <span style={{ color: "var(--text-muted)" }}>{value}</span>}
                  />
                  <Line
                    dataKey="actual"
                    name="Actual annual rainfall"
                    stroke={SERIES_COLORS[0]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  <Line
                    dataKey="fit"
                    name={`Trend ${d.base_start}–${d.base_end}`}
                    stroke="var(--text)"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="extrap"
                    name="Trend extended"
                    stroke="var(--text)"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="micro muted">Shaded: post-2000 period compared against the extended trend.</p>
            </>
          );
        }}
      </Status>
    </section>
  );
}

export default function RainDivPanel({
  place,
  dataset,
  onPlace,
}: {
  place: Place;
  dataset: DatasetInfo;
  onPlace?: (p: Place) => void;
}) {
  const [res, setRes] = useState("1");
  const [metric, setMetric] = useState<Metric>("pct");
  const [hideNoise, setHideNoise] = useState(true);
  const grid = useAsync(() => api.raindivGrid(res), res);
  const resOptions = Object.entries(dataset.resolutions ?? { "1": "1°", "2.5": "2.5°" }).map(([value, label]) => ({
    value,
    label,
  }));
  const items = legendItems(metric === "pct" ? EDGES : MM_EDGES);

  return (
    <div className="panel-stack">
      <div className="row gap-16 wrap">
        <Chips label="Resolution and period" options={resOptions} value={res} onChange={setRes} />
        <Chips
          label="Metric"
          options={[
            { value: "pct" as Metric, label: "% of 1951–99 mean" },
            { value: "mm" as Metric, label: "mm/year" },
          ]}
          value={metric}
          onChange={setMetric}
        />
        <button className={`chip ${hideNoise ? "active" : ""}`} aria-pressed={hideNoise} onClick={() => setHideNoise((v) => !v)}>
          Gray out within-noise cells
        </button>
      </div>

      <Status state={grid} loading="Loading global grid…">
        {(g) => (
          <>
            <section className="card">
              <header className="card-head">
                <div>
                  <h3 className="section-title">
                    Rainfall {g.post_start}–{g.post_end} vs the {g.base_start}–{g.base_end} trend extended
                  </h3>
                  <span className="small muted">
                    Mean gap between actual and trend-predicted annual rainfall
                    {metric === "pct" ? `, as % of the ${g.base_start}–${g.base_end} average` : ", mm/year"}
                  </span>
                </div>
                <span className="tag tag-measured">Measured</span>
              </header>
              <WorldMap
                grid={g}
                metric={metric}
                hideNoise={hideNoise}
                place={place}
                onPick={(lat, lon) =>
                  onPlace?.({
                    name: `Map cell ${lat.toFixed(2)}, ${lon.toFixed(2)}`,
                    lat: +lat.toFixed(4),
                    lon: +lon.toFixed(4),
                    source: "coordinates",
                  })
                }
              />
              <div className="map-legend" aria-label="Colour legend">
                <div className="map-legend-ends micro muted">
                  <span>← Drier</span>
                  <span>{metric === "pct" ? "% of baseline mean" : "mm/year"}</span>
                  <span>Wetter →</span>
                </div>
                <ul>
                  {items.map((it) => (
                    <li key={it.label}>
                      <span className="legend-swatch" style={{ background: it.color }} />
                      <span className="micro num">{it.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="micro muted legend-notes">
                <span className="legend-swatch inline" style={{ background: NO_DATA, outline: "1px solid var(--border)" }} />{" "}
                No GPCC land data (ocean, or too few complete years).{" "}
                {hideNoise && "Gray also includes cells whose gap is within year-to-year noise (|z| < 2). "}
                z = gap ÷ standard error of a mean predicted from the 1951–99 fit, assuming independent years.
              </p>
            </section>
            <Summary grid={g} />
          </>
        )}
      </Status>

      <CellChart place={place} res={res} />

      <p className="micro muted">
        GPCC Full Data v2025 (rain gauges, land only), via NOAA PSL. The PSL 1° file has 2020–2024 missing and a
        corrupted Dec 2019, so the 1° layer stops at 2018; the 2.5° layer runs to 2025. Extending a straight line
        amplifies swings that peaked or bottomed near 2000 (e.g. the Sahel drought), so read large values as “the
        pre-2000 trend did not continue”, not as a forecast error.
      </p>
    </div>
  );
}
