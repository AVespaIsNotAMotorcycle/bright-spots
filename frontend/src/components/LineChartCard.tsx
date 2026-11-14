import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { decimalYear, describeSlope, fitRows, withTrend, type Fit } from "../trend";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

interface Props {
  title: string;
  unit: string;
  series: ChartSeries[];
  rows: Array<Record<string, string | number | null>>;
  xKey: string;
}

/** One unit per chart: never a dual axis. */
export default function LineChartCard({ title, unit, series, rows, xKey }: Props) {
  const [showTable, setShowTable] = useState(false);
  const [showTrend, setShowTrend] = useState(true);
  const count = rows.filter((r) => series.some((s) => r[s.key] != null)).length;

  const fits = useMemo(() => {
    const out: Record<string, Fit | null> = {};
    for (const s of series) out[s.key] = fitRows(rows, xKey, s.key);
    return out;
  }, [rows, series, xKey]);
  // Numeric time axis so irregular spacing (dropped composites, missing months) stays true.
  const chartRows = useMemo(() => {
    const base = showTrend ? withTrend(rows, xKey, fits) : rows;
    return base.map((r) => ({ ...r, __x: decimalYear(String(r[xKey])) }));
  }, [rows, xKey, fits, showTrend]);
  const span = useMemo(() => {
    const xs = chartRows.map((r) => r.__x).filter((x): x is number => x != null);
    return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  }, [chartRows]);
  const tickFmt = (x: number) => {
    const y = Math.floor(x);
    if (span >= 4) return String(y);
    const m = Math.min(12, Math.floor((x - y) * 12) + 1);
    return `${y}-${String(m).padStart(2, "0")}`;
  };

  return (
    <section className="card" aria-label={`${title} (${unit}), ${count} months with data`}>
      <header className="card-head">
        <div>
          <h3 className="section-title">{title}</h3>
          <span className="small muted">{unit}</span>
        </div>
        <div className="row gap-8">
          {!showTable && (
            <button className="link-btn" aria-pressed={showTrend} onClick={() => setShowTrend((v) => !v)}>
              {showTrend ? "Hide trend" : "Trend"}
            </button>
          )}
          <button className="link-btn" onClick={() => setShowTable((v) => !v)}>
            {showTable ? "Chart" : "Table"}
          </button>
          <span className="tag tag-measured">Measured</span>
        </div>
      </header>
      {count === 0 ? (
        <p className="muted small empty">No values in this range.</p>
      ) : showTable ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                {series.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r[xKey])}>
                  <td>{r[xKey]}</td>
                  {series.map((s) => (
                    <td key={s.key}>{r[s.key] ?? "–"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="__x"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={tickFmt}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                stroke="var(--border)"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                stroke="var(--border)"
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--text)",
                  fontSize: 13,
                }}
                labelStyle={{ color: "var(--text-muted)" }}
                labelFormatter={(_, payload) => String(payload?.[0]?.payload?.[xKey] ?? "")}
                itemStyle={{ color: "var(--text)" }}
                cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }}
                formatter={(v) => (typeof v === "number" ? `${v} ${unit}` : String(v))}
              />
              {series.length > 1 && (
                <Legend
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }}
                  formatter={(value) => <span style={{ color: "var(--text-muted)" }}>{value}</span>}
                />
              )}
              {series.map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--surface-2)", strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
              {showTrend &&
                series.map(
                  (s) =>
                    fits[s.key] && (
                      <Line
                        key={`${s.key}__trend`}
                        dataKey={`${s.key}__trend`}
                        name={`${s.label} trend`}
                        stroke={s.color}
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={false}
                        legendType="none"
                        tooltipType="none"
                        isAnimationActive={false}
                        connectNulls
                      />
                    ),
                )}
            </LineChart>
          </ResponsiveContainer>
          {showTrend && (
            <ul className="trend-list micro num" aria-label="Linear trends">
              {series.map((s) => {
                const f = fits[s.key];
                return (
                  <li key={s.key}>
                    <svg width="18" height="6" aria-hidden>
                      <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="1.5" strokeDasharray="6 4" />
                    </svg>
                    {series.length > 1 && <span className="muted">{s.label}:</span>}
                    {f ? (
                      <>
                        <span>{describeSlope(f, unit)}</span>
                        <span className="muted">
                          · R² {f.r2.toFixed(2)} · n={f.n}
                        </span>
                      </>
                    ) : (
                      <span className="muted">too few points for a trend</span>
                    )}
                  </li>
                );
              })}
              <li className="muted">
                Linear least-squares fit
                {Object.values(fits).some((f) => f?.deseasonalized) ? " after removing the average seasonal cycle" : ""};
                not a significance test.
              </li>
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
