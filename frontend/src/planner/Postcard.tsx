// The park postcard from the design system: photo on the left, the full park card on the right.
// Shared by the Trip Planner and the design-system sandbox. Styles live in design-system/postcard.css.
import { useId } from "react";
import { HORIZONS, fmtDistance, fmtRain, fmtTemp, horizonTitle, pct } from "./ParkDetails";
import { FACTOR_LABEL, MONTHS, distanceKm, type FactorKey, type Horizon, type HorizonKey, type ParkPlan, type Place, type Plan } from "./model";
import type { Unit } from "./PrefsPanel";
import type { TrendBadge } from "../detective/useParkTrendBadge";

export type Mood = "dawn" | "forest" | "night";

const MOODS: Record<Mood, { skyTop: string; skyBottom: string; far: string; mid: string; near: string; sun: string }> = {
  dawn:   { skyTop: "var(--sunset)", skyBottom: "var(--surface-3)", far: "var(--text-faint)", mid: "var(--sunset-ink)", near: "var(--pine-press)", sun: "var(--surface)" },
  forest: { skyTop: "var(--glacier)", skyBottom: "var(--surface-2)", far: "var(--glacier-ink)", mid: "var(--pine)", near: "var(--text)", sun: "var(--surface)" },
  night:  { skyTop: "var(--text)", skyBottom: "var(--glacier-ink)", far: "var(--glacier-ink)", mid: "var(--pine-press)", near: "var(--text)", sun: "var(--surface-3)" },
};

/** Placeholder park photo: an illustrated scene drawn only from palette tokens, so it re-themes with them. */
export function Scene({ mood = "dawn", crop = "xMidYMid" }: { mood?: Mood; crop?: string }) {
  const id = useId();
  const m = MOODS[mood];
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio={`${crop} slice`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: m.skyTop }} />
          <stop offset="1" style={{ stopColor: m.skyBottom }} />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill={`url(#${id}-sky)`} />
      {mood === "night" &&
        [[30, 30], [80, 18], [140, 40], [200, 22], [250, 50], [270, 15], [110, 60]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" style={{ fill: "var(--surface)" }} />
        ))}
      <circle cx="242" cy="44" r="20" style={{ fill: m.sun, opacity: 0.9 }} />
      <path d="M0 130 L45 82 L80 112 L130 60 L175 108 L220 74 L260 104 L300 80 V200 H0 Z" style={{ fill: m.far, opacity: 0.55 }} />
      <path d="M0 150 L60 108 L105 140 L150 100 L205 145 L250 118 L300 140 V200 H0 Z" style={{ fill: m.mid }} />
      <path d="M0 200 V165 Q75 145 150 170 T300 160 V200 Z" style={{ fill: m.near }} />
      {[20, 38, 250, 268, 285].map((x, i) => (
        <path key={x} d={`M${x} ${172 - (i % 2) * 6} l-7 18 h14 Z M${x} ${162 - (i % 2) * 6} l-6 15 h12 Z`} style={{ fill: m.near }} />
      ))}
    </svg>
  );
}

/** Value rows paired with the factor score that rates them; bugs and snowmelt have no value. */
const PC_ROWS: { label: string; value?: (h: Horizon, unit: Unit) => string; factor: FactorKey }[] = [
  { label: "Daytime high", value: (h, u) => fmtTemp(h.values.tmax, u), factor: "temperature" },
  { label: "Humidity", value: (h) => pct(h.values.rh), factor: "humidity" },
  { label: "Rain (month)", value: (h, u) => fmtRain(h.values.precip, u), factor: "rain" },
  { label: "Cloud cover", value: (h) => pct(h.values.cloud), factor: "stars" },
  { label: FACTOR_LABEL.bugs, factor: "bugs" },
  { label: FACTOR_LABEL.snowmelt, factor: "snowmelt" },
];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** What each horizon's score range is made of (from SPEC: scoring). */
const RANGE_NOTE: Record<HorizonKey, string> = {
  this_year: "Measured, so there is one score and no range",
  next_year: "Scores at the low and high ends of the forecast window",
  y2050: "Scores across the six climate models",
};

/** Map location marker. */
function PinIcon() {
  return (
    <svg className="pc-pin" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M8 1.2a4.8 4.8 0 0 0-4.8 4.8c0 3.6 4.8 8.8 4.8 8.8s4.8-5.2 4.8-8.8A4.8 4.8 0 0 0 8 1.2Z" fill="currentColor" />
      <circle cx="8" cy="6" r="1.8" fill="var(--pc-paper)" />
    </svg>
  );
}

/** The one-sided postcard: park photo on the left, the full park card on the right. */
export default function Postcard({ p, plan, unit, place, trend, mood = "dawn", onRemove, onViewTrend }: {
  p: ParkPlan; plan: Plan; unit: Unit; place: Place | null; trend?: TrendBadge | null; mood?: Mood;
  onRemove?: () => void; onViewTrend?: () => void;
}) {
  const rows = PC_ROWS.filter((r) => r.value || r.factor in p.this_year.factors);
  const month = MONTHS[plan.month - 1];
  return (
    <div className="postcard-wrap">
      <article className="postcard" aria-labelledby={`pc-${p.park.id}`}>
        <div className="pc-photo"><Scene mood={mood} crop="xMaxYMid" /></div>
        <div className="pc-info">
          <header className="pc-head">
            <div>
              <h3 id={`pc-${p.park.id}`} className="park-card-title">{p.park.name}</h3>
              <p className="micro muted pc-meta">
                <span>{p.park.states.join(", ")}</span>
                {place && (
                  <span title={`Distance from ${place.name}`}>
                    <PinIcon />{fmtDistance(distanceKm(place, p.park), unit)}
                  </span>
                )}
                {p.park.visitors_2025 != null && <span>{compact.format(p.park.visitors_2025)} visitors in 2025</span>}
              </p>
            </div>
            {onRemove && <button type="button" className="pc-remove" onClick={onRemove} aria-label={`Remove ${p.park.short}`}>×</button>}
          </header>

          {trend && (trend.verdict === "real" || trend.verdict === "possible") && (
            <div className="pc-trend">
              <span className={`trend-pill ${trend.verdict}`}>
                Warming {trend.slope_f > 0 ? "+" : ""}{trend.slope_f.toFixed(2)}°F/decade · {trend.verdict === "real" ? "Real, not luck" : "Possible trend"}
              </span>
              {onViewTrend && <button type="button" className="link-btn micro" onClick={onViewTrend}>See trend →</button>}
            </div>
          )}

          <table className="pc-table">
            <colgroup><col className="pc-label-col" /><col /><col /><col /></colgroup>
            <thead>
              <tr>
                <td />
                {HORIZONS.map((hz) => (
                  <th key={hz.key} scope="col">
                    <span className="pc-year">{month} {horizonTitle(hz.key, plan)}</span>
                    <span className={`tag ${hz.tagClass}`}>{hz.tag}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="pc-score-row">
                <th scope="row">Match score</th>
                {HORIZONS.map((hz) => {
                  const h = p[hz.key];
                  const lo = h.low ?? h.score, hi = h.high ?? h.score;
                  const ranged = h.score != null && lo != null && hi != null && lo !== hi;
                  return (
                    <td key={hz.key} className="num">
                      <span className="big-score">{h.score == null ? "n/a" : Math.round(h.score)}</span>
                      {h.score != null && (
                        <div className="meter-track">
                          {ranged && <div className="meter-range" style={{ left: `${lo}%`, width: `${hi! - lo!}%` }} />}
                          <div className="meter-dot" style={{ left: `${h.score}%` }} />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th scope="row">Score range</th>
                {HORIZONS.map((hz) => {
                  const h = p[hz.key];
                  const lo = h.low ?? h.score, hi = h.high ?? h.score;
                  const ranged = h.score != null && lo != null && hi != null && lo !== hi;
                  return (
                    <td key={hz.key} className="num" title={RANGE_NOTE[hz.key]}>
                      {ranged ? `${Math.round(lo!)}–${Math.round(hi!)}` : "–"}
                    </td>
                  );
                })}
              </tr>
              {rows.map((r) => (
                <tr key={r.factor}>
                  <th scope="row">{r.label}</th>
                  {HORIZONS.map((hz) => {
                    const h = p[hz.key];
                    const f = h.factors[r.factor];
                    const score = f == null ? null : Math.round(f * 100);
                    return (
                      <td key={hz.key} className="num" title={score == null ? undefined : `${FACTOR_LABEL[r.factor]}: fits your preferences ${score}/100`}>
                        {r.value ? r.value(h, unit) : score == null ? "–" : `${score}/100`}
                        {score != null && <span className="pc-bar" aria-hidden="true"><span style={{ width: `${score}%` }} /></span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="micro muted pc-foot">
            <span className="pc-key"><span className="pc-bar" aria-hidden="true"><span style={{ width: "70%" }} /></span>Fit to your preferences</span>
            {p.park.code && <a href={`https://www.nps.gov/${p.park.code}/`} target="_blank" rel="noreferrer">{p.park.short} on nps.gov →</a>}
          </p>
        </div>
      </article>
    </div>
  );
}
