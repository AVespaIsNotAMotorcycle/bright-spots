// Explainer card: templated from numbers, never free-written.
import type { TrendRow, VariableMeta } from "./model";
import { fmtQ } from "./model";
import { Tip } from "../research/glossary";

interface Props {
  parkName: string;
  trend: TrendRow;
  meta: VariableMeta;
  period: string;
  periodLabel: string;
  useFahrenheit: boolean;
  simple?: boolean;
}

function verdictBadge(verdict: string) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    real:     { bg: "#d4edda", color: "#155724", label: "Confirmed trend" },
    possible: { bg: "#fff3cd", color: "#856404", label: "Possible trend" },
    none:     { bg: "var(--surface-2)", color: "var(--text-muted)", label: "No clear trend" },
    short:    { bg: "var(--surface-2)", color: "var(--text-muted)", label: "Too little data" },
    flat:     { bg: "var(--surface-2)", color: "var(--text-muted)", label: "No variation" },
  };
  const s = styles[verdict] ?? styles.none;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

export default function ExplainerCard({
  parkName,
  trend,
  meta,
  periodLabel,
  useFahrenheit,
  simple = false,
}: Props) {
  const isTemp = meta.unit.includes("°");
  const slope =
    isTemp && useFahrenheit
      ? trend.sen_per_decade_f
      : trend.sen_per_decade;
  const unit = isTemp && useFahrenheit ? "°F" : meta.unit;
  const ciLo =
    isTemp && useFahrenheit
      ? trend.ols_ci_low != null ? trend.ols_ci_low * 1.8 : null
      : trend.ols_ci_low;
  const ciHi =
    isTemp && useFahrenheit
      ? trend.ols_ci_high != null ? trend.ols_ci_high * 1.8 : null
      : trend.ols_ci_high;

  const direction =
    slope == null ? null : slope > 0 ? "rising" : slope < 0 ? "falling" : "flat";

  // Build the plain-English sentence from computed fields only.
  function sentence() {
    if (trend.verdict === "short") return "Not enough years of data to test for a trend.";
    if (trend.verdict === "flat") return "This variable never changes at this park.";
    if (slope == null) return "No data.";
    const perDecade = `${Math.abs(slope).toFixed(2)} ${unit} per decade`;
    const years =
      trend.first_year && trend.last_year
        ? `${trend.first_year}–${trend.last_year}`
        : "";
    if (trend.verdict === "real") {
      return `${meta.label} at ${parkName} has been ${direction} by ${perDecade} over ${years} (q = ${fmtQ(trend.q, 3)}).`;
    }
    if (trend.verdict === "possible") {
      return `${meta.label} at ${parkName} may be ${direction} by about ${perDecade} over ${years}, but this doesn't yet clear the bar after correcting for multiple tests (p = ${trend.p?.toFixed(3)}, q = ${trend.q?.toFixed(3)}).`;
    }
    return `No clear change in ${meta.label.toLowerCase()} at ${parkName} during ${periodLabel} (p = ${trend.p?.toFixed(3)}).`;
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {meta.label} · {periodLabel}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {simple
              ? slope != null
                ? `${slope > 0 ? "+" : ""}${slope.toFixed(2)} ${unit} every 10 years`
                : "No data"
              : <>
                  {trend.n_years} years · NASA POWER · Mann-Kendall
                  {trend.p_method && trend.p_method !== "original" ? ` (${trend.p_method})` : ""}
                </>}
          </div>
        </div>
        {verdictBadge(trend.verdict)}
      </div>

      {/* Student cards already have the chart story above, so skip the repeated sentence. */}
      {!simple && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{sentence()}</p>}

      {!simple &&
        slope != null &&
        trend.verdict !== "short" &&
        trend.verdict !== "flat" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
              gap: "8px 16px",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            <Stat
              label={<>Sen's slope/decade<Tip term="sen" /></>}
              value={`${slope > 0 ? "+" : ""}${slope.toFixed(3)} ${unit}`}
            />
            {ciLo != null && ciHi != null && (
              <Stat
                label="95% CI"
                value={`${ciLo > 0 ? "+" : ""}${ciLo.toFixed(2)} to ${ciHi > 0 ? "+" : ""}${ciHi.toFixed(2)} ${unit}`}
              />
            )}
            {trend.signal_to_noise != null && (
              <Stat
                label={<>Signal / noise<Tip term="sn" /></>}
                value={trend.signal_to_noise.toFixed(2)}
              />
            )}
            {trend.p != null && <Stat label={<>p-value<Tip term="p" /></>} value={fmtQ(trend.p)} />}
            {trend.q != null && <Stat label={<>q-value (FDR)<Tip term="q" /></>} value={fmtQ(trend.q)} />}
          </div>
        )}

      {!simple && <div style={{ fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 2 }}>
        Source: NASA POWER / MERRA-2, daily since 1981 · Mann-Kendall significance test ·
        Benjamini-Hochberg FDR correction across all parks<Tip term="fdr" />
      </div>}
    </div>
  );
}

function Stat({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}
