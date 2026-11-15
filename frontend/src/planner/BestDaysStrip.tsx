// A month as a row of day cells, coloured by how well each day fits the user's preferences,
// with the best stretch and the best days marked.
import type { BestDays } from "./model";
import { MONTHS, cToF } from "./model";
import type { Unit } from "./PrefsPanel";

function shade(score: number | null): string {
  if (score == null) return "var(--surface-2)";
  // 0 = pale sand, 100 = deep green
  const t = Math.max(0, Math.min(1, score / 100));
  const a = [226, 219, 204];
  const b = [47, 93, 58];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function range(a: number, b: number, month: number): string {
  return a === b ? `${MONTHS[month - 1]} ${a}` : `${MONTHS[month - 1]} ${a}–${b}`;
}

export default function BestDaysStrip({ bd, year, unit }: { bd: BestDays | undefined; year: string; unit: Unit }) {
  if (!bd) return <p className="micro muted best-days-note">Finding the best days…</p>;
  if (!bd.days) return <p className="micro muted best-days-note">{bd.note}</p>;
  const w = bd.window;
  const top = new Set(bd.best_days);
  const inWindow = (d: number) => !!w && d >= w.start && d <= w.end;
  const temp = (c: number | null) => (c == null ? "–" : unit === "F" ? `${Math.round(cToF(c))}°F` : `${Math.round(c)}°C`);
  return (
    <div className="best-days">
      <p className="small best-days-line">
        <strong>Best days in {MONTHS[bd.month - 1]} {year}:</strong>{" "}
        {bd.best_days.length ? bd.best_days.map((d) => d).join(", ") : "none score"}
        {w && (
          <>
            {" · "}best stretch <strong>{range(w.start, w.end, bd.month)}</strong>
            <span className="muted"> (average {Math.round(w.mean)})</span>
          </>
        )}
      </p>
      <div className="day-strip" role="img" aria-label={`Day-by-day fit for ${MONTHS[bd.month - 1]} ${year}`}>
        {bd.days.map((d) => (
          <span
            key={d.day}
            className={`day-cell${inWindow(d.day) ? " in-window" : ""}${top.has(d.day) ? " top" : ""}`}
            style={{ background: shade(d.score), height: `${14 + Math.round(((d.score ?? 0) / 100) * 14)}px` }}
            title={`${MONTHS[bd.month - 1]} ${d.day}: score ${d.score == null ? "–" : Math.round(d.score)}, high ${temp(d.tmax)}${
              d.rh != null ? `, humidity ${Math.round(d.rh)}%` : ""
            }`}
          >
            {top.has(d.day) ? <span className="day-dot" /> : null}
          </span>
        ))}
      </div>
      <div className="day-axis micro muted" aria-hidden="true">
        <span>1</span>
        <span>{Math.round(bd.days.length / 2)}</span>
        <span>{bd.days.length}</span>
      </div>
      <p className="micro muted best-days-note">{bd.note}</p>
    </div>
  );
}
