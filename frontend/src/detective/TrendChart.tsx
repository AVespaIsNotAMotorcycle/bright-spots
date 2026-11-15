// Yearly time-series chart with a Sen's slope trend line overlay.
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ExplainButton from "./ExplainButton";
import type { TrendRow, YearlySeries } from "./model";

interface Props {
  series: YearlySeries;
  trend: TrendRow;
  unit: string;
  label: string;
  /** Park name, used by the explanation. */
  parkName?: string;
  /** Show the "Explain it to me" button. Default true. */
  explain?: boolean;
}

function senLine(
  years: number[],
  trend: TrendRow,
): { year: number; fit: number }[] {
  const slope = trend.sen_per_decade != null ? trend.sen_per_decade / 10 : null;
  if (slope == null || trend.mean == null || years.length === 0) return [];
  const mid = (years[0] + years[years.length - 1]) / 2;
  return years.map((y) => ({ year: y, fit: trend.mean! + slope * (y - mid) }));
}

export default function TrendChart({ series: raw, trend: rawTrend, unit, label, parkName, explain = true }: Props) {
  // The data files hold °C. When a chart is labelled °F, convert here so numbers match the label.
  const toF = unit === "°F";
  const conv = (v: number) => (toF ? v * 1.8 + 32 : v);
  const series: YearlySeries = toF ? { years: raw.years, values: raw.values.map((v) => (v == null ? v : conv(v))) } : raw;
  const trend: TrendRow = toF
    ? {
        ...rawTrend,
        mean: rawTrend.mean == null ? null : conv(rawTrend.mean),
        sen_per_decade: rawTrend.sen_per_decade == null ? null : rawTrend.sen_per_decade * 1.8,
      }
    : rawTrend;
  const fit = senLine(series.years, trend);
  const data = series.years.map((y, i) => ({
    year: y,
    value: series.values[i],
    fit: fit[i]?.fit ?? null,
  }));

  const vals = series.values.filter((v) => v != null);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || 1;
  const domainLo = Math.floor(lo - pad);
  const domainHi = Math.ceil(hi + pad);

  const isTemp = unit.includes("°");
  const fmtVal = (v: number) =>
    isTemp
      ? `${v.toFixed(1)}${unit}`
      : unit === "days"
        ? `${v.toFixed(0)} days`
        : `${v.toFixed(0)} ${unit}`;

  return (
    <div style={{ width: "100%", fontSize: 12 }}>
      <div
        style={{
          marginBottom: 4,
          fontWeight: 600,
          fontSize: 13,
          color: "var(--text)",
        }}
      >
        {label}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[domainLo, domainHi]}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            formatter={(v) => [fmtVal(Number(v)), ""]}
            labelFormatter={(l) => `${l}`}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {/* Mean reference line */}
          {trend.mean != null && (
            <ReferenceLine
              y={trend.mean}
              stroke="var(--chart-neutral)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          {/* Raw yearly values */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={1.5}
            dot={{ r: 2.5, fill: "var(--accent)" }}
            activeDot={{ r: 4 }}
            name={label}
            connectNulls={false}
          />
          {/* Sen's slope line */}
          <Line
            type="monotone"
            dataKey="fit"
            stroke="var(--accent-2)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="6 3"
            name="Trend"
          />
        </LineChart>
      </ResponsiveContainer>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 4,
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span style={{ color: "var(--accent)" }}>— yearly values</span>
        <span style={{ color: "var(--accent-2)" }}>— — trend (Sen's slope)</span>
        <span>· · long-run mean</span>
      </div>
      {explain && (
        <ExplainButton
          facts={{
            park: parkName ?? "",
            label: label.split(" · ")[0],
            unit,
            period: label.includes(" · ") ? label.split(" · ")[1] : "annual",
            sen_per_decade: trend.sen_per_decade == null ? null : Number(trend.sen_per_decade.toFixed(3)),
            mean: trend.mean == null ? null : Number(trend.mean.toFixed(2)),
            first_year: series.years[0] ?? null,
            last_year: series.years[series.years.length - 1] ?? null,
            verdict: trend.verdict,
            q: trend.q,
          }}
        />
      )}
    </div>
  );
}
