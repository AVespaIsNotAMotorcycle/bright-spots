// Yearly time-series chart with a Sen's slope trend line overlay.
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ExplainButton from "./ExplainButton";
import type { ReactNode } from "react";
import type { TrendRow, YearlySeries } from "./model";

interface Props {
  series: YearlySeries;
  trend: TrendRow;
  unit: string;
  label: string;
  /** Park name, used by the explanation. */
  parkName?: string;
  /** Park id, used to rank this park against the others. */
  parkId?: string;
  /** Show the "Explain it to me" button. Default true. */
  explain?: boolean;
  /** Student look: no title row, soft grid, shaded area, plain-words legend. */
  simple?: boolean;
  /** Card header shown at the top of the pop-up (the whole card pops out). */
  header?: ReactNode;
  /** Colour of the pop-up's top edge. */
  accent?: string;
  /** Chart height in pixels. */
  height?: number;
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

export default function TrendChart({ series: raw, trend: rawTrend, unit, label, parkName, parkId, explain = true, simple = false, header, accent, height }: Props) {
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
  // Counts and rain can never go below zero, so the axis should not either.
  const domainLo = lo >= 0 ? Math.max(0, Math.floor(lo - pad)) : Math.floor(lo - pad);
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
      {!simple && <div
        style={{
          marginBottom: 4,
          fontWeight: 600,
          fontSize: 13,
          color: "var(--text)",
        }}
      >
        {label}
      </div>}
      <ResponsiveContainer width="100%" height={height ?? (simple ? 170 : 180)}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          {simple && (
            <defs>
              <linearGradient id="tc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
          )}
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={!simple} />
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
          {simple && (
            <Area type="monotone" dataKey="value" stroke="none" fill="url(#tc-fill)" baseValue={domainLo} isAnimationActive={false} />
          )}
          {/* Raw yearly values */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={1.5}
            dot={simple ? { r: 2, fill: "var(--accent)", strokeWidth: 0 } : { r: 2.5, fill: "var(--accent)" }}
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
        </ComposedChart>
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
        {simple ? (
          <>
            <span style={{ color: "var(--accent)" }}>● each dot is one year</span>
            <span style={{ color: "var(--accent-2)" }}>- - - the long-term direction</span>
          </>
        ) : (
          <>
            <span style={{ color: "var(--accent)" }}>— yearly values</span>
            <span style={{ color: "var(--accent-2)" }}>— — trend (Sen's slope)</span>
            <span>· · long-run mean</span>
          </>
        )}
      </div>
      {explain && (
        <ExplainButton
          park={parkName ?? ""}
          parkId={parkId}
          label={label.split(" · ")[0]}
          period={label.includes(" · ") ? label.split(" · ")[1] : "annual"}
          unit={unit}
          series={series}
          trend={trend}
          accent={accent}
          card={
            <>
              {header ?? (
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 22, color: "var(--pine)" }}>
                  {label}{parkName ? ` · ${parkName}` : ""}
                </div>
              )}
              <TrendChart
                series={raw} trend={rawTrend} unit={unit} label={label} parkName={parkName} parkId={parkId}
                simple explain={false} height={280}
              />
            </>
          }
        />
      )}
    </div>
  );
}
