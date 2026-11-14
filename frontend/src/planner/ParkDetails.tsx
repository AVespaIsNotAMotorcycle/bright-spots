import { FACTOR_LABEL, cToF, distanceKm, mmToIn, type FactorKey, type Horizon, type HorizonKey, type ParkPlan, type Place, type Plan } from "./model";
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

function fmtTemp(c: number | null | undefined, unit: Unit) {
  if (c == null) return "–";
  return unit === "F" ? `${Math.round(cToF(c))}°F` : `${c.toFixed(1)}°C`;
}

function fmtRain(mm: number | null | undefined, unit: Unit) {
  if (mm == null) return "–";
  return unit === "F" ? `${mmToIn(mm).toFixed(1)} in` : `${Math.round(mm)} mm`;
}

const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v)}%`);

/** Values, factor scores and horizon notes for one park. */
export function Details({ p, plan, unit }: { p: ParkPlan; plan: Plan; unit: Unit }) {
  const factorKeys = Object.keys(p.this_year.factors) as FactorKey[];
  const rows: [string, (h: Horizon) => string][] = [
    ["Daytime high", (h) => fmtTemp(h.values.tmax, unit)],
    ["Humidity", (h) => pct(h.values.rh)],
    ["Rain (month)", (h) => fmtRain(h.values.precip, unit)],
    ["Cloud cover", (h) => pct(h.values.cloud)],
  ];
  return (
    <div className="details">
      <div className="table-wrap">
        <table className="detail-table">
          <thead>
            <tr>
              <th />
              {HORIZONS.map((hz) => (
                <th key={hz.key} className="num">
                  {horizonTitle(hz.key, plan)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fmt]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {HORIZONS.map((hz) => (
                  <td key={hz.key} className="num">
                    {fmt(p[hz.key])}
                  </td>
                ))}
              </tr>
            ))}
            {factorKeys.map((f) => (
              <tr key={f} className="factor-row">
                <th scope="row">{FACTOR_LABEL[f]} score</th>
                {HORIZONS.map((hz) => {
                  const v = p[hz.key].factors[f];
                  return (
                    <td key={hz.key} className="num">
                      {v == null ? "–" : Math.round(v * 100)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="notes small muted">
        {HORIZONS.flatMap((hz) =>
          p[hz.key].notes.map((n) => (
            <li key={hz.key + n}>
              <strong>{horizonTitle(hz.key, plan)}:</strong> {n}
            </li>
          )),
        )}
      </ul>
    </div>
  );
}

function fmtDistance(km: number, unit: Unit) {
  return unit === "F" ? `${Math.round(km * 0.621371).toLocaleString()} mi` : `${Math.round(km).toLocaleString()} km`;
}

/** One horizon's score, large, with its range and a full-width bar. */
function BigScore({ h, title, tag, tagClass }: { h: Horizon; title: string; tag: string; tagClass: string }) {
  const lo = h.low ?? h.score,
    hi = h.high ?? h.score;
  return (
    <div className="park-card-score">
      <div className="micro muted">
        {title} <span className={`tag ${tagClass}`}>{tag}</span>
      </div>
      <div className="big-score num">
        {h.score == null ? "n/a" : Math.round(h.score)}
        {h.score != null && lo != null && hi != null && lo !== hi && (
          <span className="small muted">
            {" "}
            {Math.round(lo)}–{Math.round(hi)}
          </span>
        )}
      </div>
      {h.score != null && (
        <div className="meter-track">
          {lo != null && hi != null && lo !== hi && <div className="meter-range" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />}
          <div className="meter-dot" style={{ left: `${h.score}%` }} />
        </div>
      )}
    </div>
  );
}

/** A selected park: three horizon scores up top, then the full breakdown. */
export function ParkCard({
  p,
  plan,
  unit,
  place,
  onRemove,
}: {
  p: ParkPlan;
  plan: Plan;
  unit: Unit;
  place: Place | null;
  onRemove: () => void;
}) {
  return (
    <article className="card park-card" aria-labelledby={`card-${p.park.id}`}>
      <header className="park-card-head">
        <div>
          <h3 id={`card-${p.park.id}`} className="park-card-title">
            {p.park.name}
          </h3>
          <p className="small muted">
            {p.park.states.join(", ")}
            {place && ` · ${fmtDistance(distanceKm(place, p.park), unit)} from ${place.name.split(",")[0]}`}
            {p.park.visitors_2025 != null && ` · ${p.park.visitors_2025.toLocaleString()} visitors in 2025`}
          </p>
        </div>
        <button className="link-btn small" onClick={onRemove} aria-label={`Remove ${p.park.short}`}>
          Remove
        </button>
      </header>
      <div className="park-card-scores">
        {HORIZONS.map((hz) => (
          <BigScore key={hz.key} h={p[hz.key]} title={horizonTitle(hz.key, plan)} tag={hz.tag} tagClass={hz.tagClass} />
        ))}
      </div>
      <Details p={p} plan={plan} unit={unit} />
      {p.park.code && (
        <p className="micro">
          <a href={`https://www.nps.gov/${p.park.code}/`} target="_blank" rel="noreferrer">
            {p.park.short} on nps.gov
          </a>
        </p>
      )}
    </article>
  );
}

export { fmtDistance };
