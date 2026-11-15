// Shared planner display helpers: horizons, score meter and unit formatting.
import { cToF, mmToIn, type Horizon, type HorizonKey, type Plan } from "./model";
import type { Unit } from "./PrefsPanel";

export const HORIZONS: { key: HorizonKey; tag: string; tagClass: string }[] = [
  { key: "this_year", tag: "Measured", tagClass: "tag-measured" },
  { key: "next_year", tag: "Forecast", tagClass: "tag-forecast" },
  { key: "y2050", tag: "Projected", tagClass: "tag-projected" },
];

export function horizonTitle(key: HorizonKey, plan: Plan | null): string {
  if (key === "this_year") return plan ? String(plan.this_year) : "This year";
  if (key === "next_year") return plan ? String(plan.next_year) : "Next year";
  return "2050";
}

export function Meter({ h, label }: { h: Horizon; label?: string }) {
  const tag = label ? <span className="micro muted meter-label">{label}</span> : null;
  if (h.score == null)
    return (
      <div className="meter">
        {tag}
        <span className="muted small">n/a</span>
      </div>
    );
  const lo = h.low ?? h.score,
    hi = h.high ?? h.score;
  return (
    <div className="meter" title={lo !== hi ? `range ${lo}–${hi}` : undefined}>
      {tag}
      <div className="meter-track">
        {lo !== hi && <div className="meter-range" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />}
        <div className="meter-dot" style={{ left: `${h.score}%` }} />
      </div>
      <span className="num meter-value">
        {Math.round(h.score)}
        {lo !== hi && (
          <span className="micro muted">
            {" "}
            {Math.round(lo)}–{Math.round(hi)}
          </span>
        )}
      </span>
    </div>
  );
}

export function fmtTemp(c: number | null | undefined, unit: Unit) {
  if (c == null) return "–";
  return unit === "F" ? `${Math.round(cToF(c))}°F` : `${c.toFixed(1)}°C`;
}

export function fmtRain(mm: number | null | undefined, unit: Unit) {
  if (mm == null) return "–";
  return unit === "F" ? `${mmToIn(mm).toFixed(1)} in` : `${Math.round(mm)} mm`;
}

export const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v)}%`);

export function fmtDistance(km: number, unit: Unit) {
  return unit === "F" ? `${Math.round(km * 0.621371).toLocaleString()} mi` : `${Math.round(km).toLocaleString()} km`;
}
