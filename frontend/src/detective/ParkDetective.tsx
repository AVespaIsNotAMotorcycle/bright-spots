// Per-park detective view: trend table + chart + explainer card.
import { useEffect, useState } from "react";
import ExplainerCard from "./ExplainerCard";
import type { Atlas, ParkTrends, TrendRow } from "./model";
import { PERIOD_LABEL } from "./model";
import TrendChart from "./TrendChart";

interface Props {
  parkId: string;
  parkName: string;
  atlas: Atlas;
  onBack: () => void;
  useFahrenheit: boolean;
  simple?: boolean;
}

export default function ParkDetective({
  parkId,
  parkName,
  atlas,
  onBack,
  useFahrenheit,
  simple = false,
}: Props) {
  const [data, setData] = useState<ParkTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selVar, setSelVar] = useState<string>("tmax_c");
  const [selPeriod, setSelPeriod] = useState<string>("annual");
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/trends/parks/${parkId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<ParkTrends>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [parkId]);

  if (loading)
    return (
      <div style={{ padding: 32, color: "var(--text-muted)" }}>
        Loading trends for {parkName}…
      </div>
    );
  if (error || !data)
    return (
      <div style={{ padding: 32, color: "var(--error)" }}>
        Failed to load: {error}
      </div>
    );

  const vars = Object.keys(atlas.variables);
  const periods = atlas.periods;

  if (simple) {
    // Student view: one plain card per variable, annual only.
    const annual = data.trends.filter((t) => t.period === "annual" && t.verdict !== "flat" && t.verdict !== "short");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} className="btn-ghost">← All parks</button>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22, color: "var(--pine)" }}>{parkName}</h2>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Each card compares {parkName} from 1981 to 2026. Green means the change is very unlikely to be luck.
        </p>
        <div className="card-grid">
          {annual.map((t) => {
            const meta = atlas.variables[t.variable];
            const series = data.series[t.variable]?.annual;
            if (!meta || !series) return null;
            const isTemp = meta.unit.includes("°");
            return (
              <div key={t.variable} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <TrendChart series={series} trend={t} unit={isTemp && useFahrenheit ? "°F" : meta.unit} label={meta.label} />
                <ExplainerCard parkName={parkName} trend={t} meta={meta} period="annual" periodLabel="the whole year" useFahrenheit={useFahrenheit} simple />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Build a lookup: variable -> period -> trend row
  const lookup: Record<string, Record<string, TrendRow>> = {};
  for (const t of data.trends) {
    if (!lookup[t.variable]) lookup[t.variable] = {};
    lookup[t.variable][t.period] = t;
  }

  const selectedTrend = lookup[selVar]?.[selPeriod];
  const selectedSeries = data.series[selVar]?.[selPeriod];
  const selectedMeta = atlas.variables[selVar];

  function verdictColor(verdict: string) {
    if (verdict === "real") return "#d4edda";
    if (verdict === "possible") return "#fff3cd";
    return "transparent";
  }
  function verdictText(verdict: string) {
    if (verdict === "real") return "#155724";
    if (verdict === "possible") return "#856404";
    return "var(--text-muted)";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ← All parks
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{parkName}</h2>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            NASA POWER 1981–2026 · {data.trends.length} trend tests
          </div>
        </div>
      </div>

      {/* Variable × Period grid */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            fontSize: 12,
            width: "100%",
            tableLayout: "auto",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: "6px 10px",
                  textAlign: "left",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  borderBottom: "2px solid var(--border)",
                  position: "sticky",
                  left: 0,
                  background: "var(--surface)",
                }}
              >
                Variable
              </th>
              {periods.map((p) => (
                <th
                  key={p}
                  style={{
                    padding: "6px 8px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    borderBottom: "2px solid var(--border)",
                    whiteSpace: "nowrap",
                    fontSize: 11,
                  }}
                >
                  {PERIOD_LABEL[p] ?? p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vars.map((v) => {
              const isTemp = atlas.variables[v]?.unit.includes("°");
              return (
                <tr key={v}>
                  <td
                    style={{
                      padding: "5px 10px",
                      fontWeight: 500,
                      borderBottom: "1px solid var(--grid)",
                      whiteSpace: "nowrap",
                      position: "sticky",
                      left: 0,
                      background: "var(--surface)",
                    }}
                  >
                    {atlas.variables[v]?.label}
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        fontWeight: 400,
                      }}
                    >
                      {isTemp && useFahrenheit ? "°F" : atlas.variables[v]?.unit}
                    </div>
                  </td>
                  {periods.map((p) => {
                    const t = lookup[v]?.[p];
                    const active = selVar === v && selPeriod === p;
                    const slope =
                      t &&
                      (isTemp && useFahrenheit
                        ? t.sen_per_decade_f
                        : t.sen_per_decade);
                    return (
                      <td
                        key={p}
                        onClick={() => {
                          setSelVar(v);
                          setSelPeriod(p);
                          setShowChart(true);
                        }}
                        title={
                          t
                            ? `${t.verdict} · slope: ${slope?.toFixed(3) ?? "—"} ${isTemp && useFahrenheit ? "°F" : atlas.variables[v]?.unit}/dec · p=${t.p?.toFixed(3) ?? "—"} q=${t.q?.toFixed(3) ?? "—"}`
                            : "No data"
                        }
                        style={{
                          padding: "5px 8px",
                          textAlign: "center",
                          borderBottom: "1px solid var(--grid)",
                          cursor: "pointer",
                          background: active
                            ? "var(--accent-tint)"
                            : t
                              ? verdictColor(t.verdict)
                              : "transparent",
                          outline: active
                            ? "2px solid var(--accent)"
                            : "none",
                          outlineOffset: -2,
                          borderRadius: active ? 4 : 0,
                          fontVariantNumeric: "tabular-nums",
                          fontSize: 12,
                          color: t ? verdictText(t.verdict) : "var(--text-muted)",
                          fontWeight: t?.verdict === "real" ? 600 : 400,
                        }}
                      >
                        {t && slope != null
                          ? `${slope > 0 ? "+" : ""}${slope.toFixed(2)}`
                          : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 11,
          color: "var(--text-muted)",
          flexWrap: "wrap",
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: "#d4edda",
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          Real (q &lt; 0.05)
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: "#fff3cd",
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          Possible (p &lt; 0.05)
        </span>
        <span>Numbers = slope per decade · click a cell to see the chart</span>
      </div>

      {/* Chart + explainer for selected cell */}
      {showChart && selectedTrend && selectedMeta && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {selectedMeta.label} · {PERIOD_LABEL[selPeriod] ?? selPeriod}
            </div>
            <button
              onClick={() => setShowChart(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "var(--text-muted)",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {selectedSeries ? (
            <TrendChart
              series={selectedSeries}
              trend={selectedTrend}
              unit={
                selectedMeta.unit.includes("°") && useFahrenheit
                  ? "°F"
                  : selectedMeta.unit
              }
              label={selectedMeta.label}
            />
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              No yearly series available for this period.
            </div>
          )}

          <ExplainerCard
            parkName={parkName}
            trend={selectedTrend}
            meta={selectedMeta}
            period={selPeriod}
            periodLabel={PERIOD_LABEL[selPeriod] ?? selPeriod}
            useFahrenheit={useFahrenheit}
          />
        </div>
      )}
    </div>
  );
}
