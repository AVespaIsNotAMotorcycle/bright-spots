import { MONTH_STARTS } from "./model";

const W = 300,
  H = 130,
  PAD = { l: 38, r: 8, t: 8, b: 18 };
const MONTH_INITIALS = "JFMAMJJASOND";

function path(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

/**
 * A year of daily values: the 1991–2020 average (neutral) against one horizon's
 * curve (its tag colour), with the travel month shaded.
 */
export default function YearChart({
  normal,
  series,
  seriesLabel,
  seriesClass,
  month,
  format,
}: {
  normal: (number | null)[];
  series: (number | null)[] | null;
  seriesLabel: string;
  seriesClass: string;
  month: number;
  format: (v: number) => string;
}) {
  const all = [...normal, ...(series ?? [])].filter((v): v is number => v != null);
  if (all.length === 0) return <p className="small muted">No daily data.</p>;
  let lo = Math.min(...all),
    hi = Math.max(...all);
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.06;
  lo -= pad;
  hi += pad;
  const x = (i: number) => PAD.l + (i / 364) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const m0 = x(MONTH_STARTS[month - 1]),
    m1 = x(MONTH_STARTS[month] - 1);
  return (
    <figure className="year-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Daily values over a year: ${seriesLabel} against the 1991–2020 average`}>
        <rect className="yc-month" x={m0} y={PAD.t} width={Math.max(1, m1 - m0)} height={H - PAD.t - PAD.b} />
        <line className="yc-axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        {MONTH_STARTS.slice(0, 12).map((d, i) => (
          <text key={i} className="yc-tick" x={x(d + 14)} y={H - 5} textAnchor="middle">
            {MONTH_INITIALS[i]}
          </text>
        ))}
        <text className="yc-tick" x={PAD.l - 4} y={y(hi - pad) + 4} textAnchor="end">
          {format(hi - pad)}
        </text>
        <text className="yc-tick" x={PAD.l - 4} y={y(lo + pad) + 2} textAnchor="end">
          {format(lo + pad)}
        </text>
        <path className="yc-normal" d={path(normal, x, y)} />
        {series && <path className={`yc-series ${seriesClass}`} d={path(series, x, y)} />}
      </svg>
      <figcaption className="yc-legend micro">
        <span>
          <i className="yc-swatch yc-normal-swatch" /> 1991–2020 average
        </span>
        {series && (
          <span>
            <i className={`yc-swatch ${seriesClass}`} /> {seriesLabel}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
