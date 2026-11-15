// Result pieces: score ring, 12-month strip, badges, factor scores and the trend tag.
import type { Case } from "../../detective/cases";
import type { TrendTag } from "../whatChanged";
import { MONTHS, goldMonth, scoreColor, seasonOf, type Reason, type TripPark } from "./tripModel";

export function ScoreRing({ score, size = 62, light = true }: { score: number | null; size?: number; light?: boolean }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const s = Math.max(0, Math.min(100, score ?? 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${Math.round(s)} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill={light ? "rgba(0,0,0,.35)" : "var(--paper)"} stroke={light ? "rgba(255,255,255,.3)" : "var(--stone)"} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? "#E9EDD8" : "var(--moss)"} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${(c * s) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" fontWeight={600} fontSize={size * 0.32} fill={light ? "#fff" : "var(--text)"}>
        {score == null ? "–" : Math.round(score)}
      </text>
    </svg>
  );
}

/** 12 squares, one per month, shaded by score, in season colours underneath. */
export function MonthStrip({ p, picked }: { p: TripPark; picked: number[] }) {
  const gold = goldMonth(p, picked);
  return (
    <div>
      <div className="tp-strip" role="img" aria-label={`Scores by month. Best month all year: ${gold ? MONTHS[gold - 1] : "none"}`}>
        {p.month_scores.map((m, i) => (
          <span key={i}
            className={`${gold === i + 1 ? "best" : ""} ${picked.includes(i + 1) ? "pick" : ""}`}
            title={`${MONTHS[i]}: ${m.score == null ? "no data" : Math.round(m.score)}${m.ok ? "" : m.score != null ? " (fails a must)" : ""}`}
            style={{ background: scoreColor(m.score), opacity: m.ok ? 1 : 0.28,
              borderBottom: `3px solid ${seasonOf(i + 1).color}` }} />
        ))}
      </div>
      <div className="tp-axis" aria-hidden>{MONTHS.map((m) => <span key={m}>{m[0]}</span>)}</div>
    </div>
  );
}

/** "Go before it changes" and case badges. */
export function Badges({ p, caseFor }: { p: TripPark; caseFor?: Case }) {
  const shift = p.best_now && p.best_2050 && p.best_now !== p.best_2050;
  const drop = p.change_2050 != null && p.change_2050 <= -10;
  return (
    <div className="tp-badges">
      {drop && <span className="tp-badge warn" title="Same month, 2050 climate model average (WorldClim CMIP6): temperature and rain change. Score points, not degrees">Go before it changes: {Math.round(p.change_2050!)} points by 2050</span>}
      {shift && <span className="tp-badge warn" title="Best month of the whole year, now vs the 2050 model">Best month moves {MONTHS[p.best_now! - 1]} → {MONTHS[p.best_2050! - 1]} by 2050</span>}
      {caseFor && <span className="tp-badge case">{caseFor.title}</span>}
    </div>
  );
}

/** Science switch: the factor's own score and weight, and q for trends. */
export function Sci({ r }: { r: Reason }) {
  return (
    <span className="tp-sci" title="Factor score out of 100, times its weight in the park's score">
      {r.score == null ? "no data" : `${Math.round(r.score * 100)}/100 ×${r.weight ?? 1}`}
      {r.q != null && ` · q = ${r.q < 0.001 ? "<0.001" : r.q.toFixed(3)}`}
    </span>
  );
}

/** "Jul days +2.1 °F since 1981": the travel month's NASA trend, tested for significance. */
export function Trend({ t, small = false }: { t?: TrendTag | null; small?: boolean }) {
  if (!t) return null;
  return (
    <span className={`tp-trend tp-trend-${t.kind}${small ? " sm" : ""}`} title={t.title}>
      <span aria-hidden>{t.arrow}</span> {t.text}
    </span>
  );
}
