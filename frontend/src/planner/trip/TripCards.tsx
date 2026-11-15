// Result pieces: score ring, 12-month strip, badges, the top-3 cards and the compact rows.
import { photoOf } from "../../detective/photos";
import type { Case } from "../../detective/cases";
import { EMOJI, MONTHS, reasonText, scoreColor, seasonOf, type TripPark, type Unit } from "./tripModel";

export function ScoreRing({ score, size = 62, light = true }: { score: number | null; size?: number; light?: boolean }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const s = Math.max(0, Math.min(100, score ?? 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${Math.round(s)} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill={light ? "rgba(0,0,0,.35)" : "var(--surface-2)"} stroke={light ? "rgba(255,255,255,.3)" : "var(--grid)"} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3c969" strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${(c * s) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" fontWeight={900} fontSize={size * 0.32} fill={light ? "#fff" : "var(--text)"}>
        {score == null ? "–" : Math.round(score)}
      </text>
    </svg>
  );
}

/** 12 squares, one per month, shaded by score, in season colours underneath. */
export function MonthStrip({ p, picked }: { p: TripPark; picked: number[] }) {
  return (
    <div>
      <div className="tp-strip" role="img" aria-label={`Scores by month. Best month all year: ${p.best_now ? MONTHS[p.best_now - 1] : "none"}`}>
        {p.month_scores.map((m, i) => (
          <span key={i}
            className={`${p.best_now === i + 1 ? "best" : ""} ${picked.includes(i + 1) ? "pick" : ""}`}
            title={`${MONTHS[i]}: ${m.score == null ? "no data" : Math.round(m.score)}${m.ok ? "" : m.score != null ? " (fails a must)" : ""}`}
            style={{ background: m.ok ? scoreColor(m.score) : `repeating-linear-gradient(45deg, ${scoreColor(m.score)} 0 3px, #eee6d6 3px 6px)`,
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

export function TopCard({ p, i, unit, picked, caseFor, onOpen, actions }: {
  p: TripPark; i: number; unit: Unit; picked: number[]; caseFor?: Case; onOpen: () => void; actions: React.ReactNode;
}) {
  const photo = photoOf(p.park.code);
  const top = p.reasons.filter((r) => r.score != null).sort((a, b) => (b.level === "must" ? 1 : 0) - (a.level === "must" ? 1 : 0) || Math.abs(b.score! - 0.5) - Math.abs(a.score! - 0.5)).slice(0, 4);
  return (
    <article className="tp-card" tabIndex={0} role="button" aria-label={`${p.park.short}, score ${Math.round(p.score ?? 0)}. Open details`}
      onClick={onOpen} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}>
      <div className="tp-photo" style={{ backgroundImage: photo ? `url("${photo.file}")` : undefined }}
        title={photo ? `Photo: ${photo.credit} (${photo.license}), Wikimedia Commons` : undefined}>
        <span className="tp-medal" aria-hidden>{medal[i]}</span>
        <div className="tp-name">{p.park.short}<small>{p.park.states.join(", ")} · best in {MONTHS[p.best_month - 1]}</small></div>
        <div className="tp-ring"><ScoreRing score={p.score} /></div>
      </div>
      <div className="tp-body">
        <ul className="tp-reasons">
          {top.map((r) => (
            <li key={r.key}>
              <span className={r.score! >= 0.5 ? "tp-ok" : "tp-no"} aria-label={r.score! >= 0.5 ? "good" : "not great"}>{r.score! >= 0.5 ? "✓" : "✗"}</span>
              <span aria-hidden>{EMOJI(r.key)}</span>
              <span>{reasonText(r, unit)}</span>
            </li>
          ))}
        </ul>
        <MonthStrip p={p} picked={picked} />
        <Badges p={p} caseFor={caseFor} />
        <div className="tp-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{actions}</div>
      </div>
    </article>
  );
}

export function Row({ p, rank, unit, onOpen, actions }: { p: TripPark; rank: number; unit: Unit; onOpen: () => void; actions: React.ReactNode }) {
  const photo = photoOf(p.park.code);
  const best = p.reasons.filter((r) => r.score != null && r.score >= 0.75).slice(0, 2);
  return (
    <div className="tp-row" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      aria-label={`${rank}. ${p.park.short}, score ${Math.round(p.score ?? 0)}`}>
      <span className="muted small" style={{ textAlign: "right" }}>{rank}</span>
      {photo ? <img src={photo.file} alt="" loading="lazy" /> : <span style={{ fontSize: 32 }}>🏞️</span>}
      <span style={{ minWidth: 0 }}>
        <b>{p.park.short}</b> <span className="micro muted">{p.park.states.join(", ")} · {MONTHS[p.best_month - 1]}</span>
        <div className="small muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {best.map((r) => `${EMOJI(r.key)} ${reasonText(r, unit)}`).join(" · ")}
        </div>
      </span>
      <span className="hide-sm" onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>{actions}</span>
      <ScoreRing score={p.score} size={46} light={false} />
    </div>
  );
}
