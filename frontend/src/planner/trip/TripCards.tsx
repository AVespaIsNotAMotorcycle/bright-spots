// Result pieces: score ring, 12-month strip, badges, the top-3 cards and the compact rows.
import { photoOf } from "../../detective/photos";
import type { Case } from "../../detective/cases";
import type { TrendTag } from "../whatChanged";
import { EMOJI, LABEL, MONTHS, goldMonth, reasonText, scoreColor, seasonOf, type Reason, type TripPark, type Unit } from "./tripModel";

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
      {drop && <span className="tp-badge warn" title="Same month, 2050 climate model average (WorldClim CMIP6): temperature and rain change">⏳ Go before it changes: {Math.round(p.change_2050!)} by 2050</span>}
      {shift && <span className="tp-badge warn" title="Best month of the whole year, now vs the 2050 model">📆 Best month moves {MONTHS[p.best_now! - 1]} → {MONTHS[p.best_2050! - 1]} by 2050</span>}
      {caseFor && <span className="tp-badge case">🔍 {caseFor.title}</span>}
    </div>
  );
}

const medal = ["🥇", "🥈", "🥉"];

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

export function TopCard({ p, i, onOpen, heart, dates, why, trend }: {
  p: TripPark; i: number; onOpen: () => void; heart: React.ReactNode;
  /** The best month's daytime-high trend. */
  trend?: TrendTag | null;
  /** Best 5 days in the park's best month, e.g. "Dec 3–7". */
  dates?: string;
  /** One short reason, e.g. "20°C highs, 2 rainy days". */
  why?: string;
}) {
  const photo = photoOf(p.park.code);
  return (
    <article className="tp-card" tabIndex={0} role="button" aria-label={`${p.park.short}, score ${Math.round(p.score ?? 0)}. Open details`}
      onClick={onOpen} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}>
      <div className="tp-photo" style={{ backgroundImage: photo ? `url("${photo.file}")` : undefined }}
        title={photo ? `Photo: ${photo.credit} (${photo.license}), Wikimedia Commons` : undefined}>
        <span className="tp-medal" aria-hidden>{medal[i]}</span>
        <div className="tp-name">{p.park.short}<small>{p.park.states.join(", ")} · best in {MONTHS[p.best_month - 1]}</small></div>
        <div className="tp-ring"><ScoreRing score={p.score} /></div>
      </div>
      <div className="tp-body tp-simple">
        <span>
          {dates && <p className="tp-card-dates">📅 <b>{dates}</b></p>}
          {why && <p className="small muted" style={{ margin: "2px 0 0" }}>{why}</p>}
          {trend && <p style={{ margin: "6px 0 0" }}><Trend t={trend} /></p>}
        </span>
        {heart}
      </div>
    </article>
  );
}

/** Round ♡ toggle for the want-to-go list. Stops the click from opening the park. */
export function Heart({ on, name, onToggle }: { on: boolean; name: string; onToggle: () => void }) {
  return (
    <button className="tp-heart" aria-pressed={on} aria-label={on ? `Remove ${name} from Saved` : `Save ${name}`}
      title={on ? "Saved" : "Save"} onClick={(e) => { e.stopPropagation(); onToggle(); }}
      onKeyDown={(e) => e.stopPropagation()}>
      {on ? "♥" : "♡"}
    </button>
  );
}

/** No filters: one photo tile per park, name and state, no rank or score. */
export function Tile({ p, onOpen, heart }: { p: TripPark; onOpen: () => void; heart: React.ReactNode }) {
  const photo = photoOf(p.park.code);
  return (
    <div className="tp-tile" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      aria-label={`${p.park.short}. Open details`}>
      {photo ? <img src={photo.file} alt="" loading="lazy" /> : <div className="ph" />}
      {heart}
      <span className="t"><b>{p.park.short}</b><small>{p.park.states.join(", ")}</small></span>
    </div>
  );
}

export function Row({ p, rank, unit, onOpen, actions, plain = false, trend }: {
  p: TripPark; rank: number; unit: Unit; onOpen: () => void; actions: React.ReactNode;
  /** The best month's daytime-high trend. */
  trend?: TrendTag | null;
  /** No filters: just the park, no rank, score or best month. */
  plain?: boolean;
}) {
  const photo = photoOf(p.park.code);
  const best = p.reasons.filter((r) => r.score != null && r.score >= 0.75).slice(0, 2);
  if (plain) {
    return (
      <div className="tp-row plain" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
        aria-label={`${p.park.short}. Open details`}>
        {photo ? <img src={photo.file} alt="" loading="lazy" /> : <span style={{ fontSize: 32 }}>🏞️</span>}
        <span style={{ minWidth: 0 }}>
          <b>{p.park.short}</b>
          <div className="small muted">{p.park.states.join(", ")}</div>
        </span>
        <span className="hide-sm" onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>{actions}</span>
      </div>
    );
  }
  return (
    <div className={`tp-row${p.ok ? "" : " off"}`} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      aria-label={`${rank}. ${p.park.short}, ${p.ok ? `score ${Math.round(p.score ?? 0)}` : "misses one of your musts"}`}>
      <span className="muted small" style={{ textAlign: "right" }}>{rank}</span>
      {photo ? <img src={photo.file} alt="" loading="lazy" /> : <span style={{ fontSize: 32 }}>🏞️</span>}
      <span style={{ minWidth: 0 }}>
        <b>{p.park.short}</b> <span className="micro muted">{p.park.states.join(", ")} · {MONTHS[p.best_month - 1]}</span>
        <div className="small muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {p.ok
            ? best.map((r) => `${EMOJI(r.key)} ${reasonText(r, unit)}`).join(" · ")
            : `Misses: ${p.failed.map((k) => `${EMOJI(k)} ${LABEL(k)}`).join(", ")}`}
        </div>
        <Trend t={trend} small />
      </span>
      <span className="hide-sm" onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>{actions}</span>
      <ScoreRing score={p.score} size={46} light={false} />
    </div>
  );
}
