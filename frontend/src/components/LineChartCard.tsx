import { useState } from "react";
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
  const count = rows.filter((r) => series.some((s) => r[s.key] != null)).length;

  return (
    <section className="card" aria-label={`${title} (${unit}), ${count} months with data`}>
      <header className="card-head">
        <div>
          <h3 className="section-title">{title}</h3>
          <span className="small muted">{unit}</span>
        </div>
        <div className="row gap-8">
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
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey={xKey}
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
