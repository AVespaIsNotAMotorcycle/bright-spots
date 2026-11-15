// A park as a one-sided postcard: photo on the left, the park's numbers on the right,
// one column per horizon. Used by Saved (all three horizons) and Plan (this year and next year).
// Layout from the design-system sandbox; colours, fonts and corners are Canopy's own.
import { HORIZON_LABEL, MONTHS, temp, type HorizonKey, type Trip, type TripPark, type Unit } from "../planner/trip/tripModel";
import type { TrendTag } from "../planner/whatChanged";
import { PhotoCredit, photoOf } from "../detective/photos";
import { parkKey } from "../detective/parkKey";
import "./postcard.css";

const STAMP: Record<HorizonKey, "measured" | "forecast" | "projected"> = {
  this_year: "measured",
  next_year: "forecast",
  y2050: "projected",
};
const ALL_HORIZONS: HorizonKey[] = ["this_year", "next_year", "y2050"];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v)}%`);
const rain = (mm: number | null | undefined, u: Unit) => (mm == null ? "–" : u === "F" ? `${(mm / 25.4).toFixed(1)} in` : `${Math.round(mm)} mm`);

/** Value rows, each rated by the factor fit that goes with it. */
const ROWS: { label: string; fit: string; show: (v: Record<string, number | null>, u: Unit) => string }[] = [
  { label: "Average high", fit: "temperature", show: (v, u) => (v.tmax == null ? "–" : temp(v.tmax, u)) },
  { label: "Humidity", fit: "muggy", show: (v) => pct(v.rh) },
  { label: "Monthly rainfall", fit: "rain", show: (v, u) => rain(v.precip, u) },
  { label: "Cloud cover", fit: "gray", show: (v) => pct(v.cloud) },
];

function PinIcon() {
  return (
    <svg className="pc-pin" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M8 1.2a4.8 4.8 0 0 0-4.8 4.8c0 3.6 4.8 8.8 4.8 8.8s4.8-5.2 4.8-8.8A4.8 4.8 0 0 0 8 1.2Z" fill="currentColor" />
      <circle cx="8" cy="6" r="1.8" fill="var(--paper)" />
    </svg>
  );
}

const Bar = ({ fit }: { fit: number | undefined }) =>
  fit == null ? null : (
    <span className="pc-bar" aria-hidden="true">
      <span style={{ width: `${Math.round(fit * 100)}%` }} />
    </span>
  );

interface Props {
  name: string;
  /** The park's row from the 12-month trip, when it has loaded. */
  p: TripPark | undefined;
  trip: Trip | null;
  unit: Unit;
  trend: TrendTag | null;
  /** The NPS page, e.g. "zion". */
  npsCode: string | null;
  /** The columns, left to right. Default: this year, next year and 2050. */
  horizons?: HorizonKey[];
  /** Buttons under the table. */
  actions: React.ReactNode;
  onRemove: () => void;
  /** What the × does, for screen readers. Default "Remove {name}". */
  removeLabel?: string;
}

export default function Postcard({ name, p, trip, unit, trend, npsCode, horizons = ALL_HORIZONS, actions, onRemove, removeLabel }: Props) {
  const HORIZONS = horizons.map((key) => ({ key, stamp: STAMP[key] }));
  const key = p ? parkKey(p.park) : "";
  const photo = photoOf(key);
  const bugs = p?.fits?.next_year?.bugs != null;
  const meta = p && (
    <p className="micro muted pc-meta">
      <span>{p.park.states.join(", ")}</span>
      {p.park.visitors_2025 != null && <span><PinIcon />{compact.format(p.park.visitors_2025)} visitors in 2025</span>}
    </p>
  );
  return (
    <div className="postcard-wrap">
      <article className="postcard" aria-label={name}>
        <div className="pc-photo">
          {photo ? <img src={photo.file} alt="" loading="lazy" /> : <div className="pc-nophoto" />}
          {photo && <PhotoCredit photo={photo} style={{ position: "absolute", left: 6, bottom: 4, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.6)" }} />}
        </div>
        <div className="pc-info">
          <header className="pc-head">
            <div>
              <h3 className="pc-title">{name}</h3>
              {meta}
            </div>
            <button type="button" className="pc-remove" onClick={onRemove} aria-label={removeLabel ?? `Remove ${name}`}>×</button>
          </header>

          {trend && (
            <p className={`pc-trend pc-trend-${trend.kind}`} title={trend.title}>
              {trend.arrow} {trend.text}
            </p>
          )}

          {!trip ? (
            <p className="small muted">Loading your numbers…</p>
          ) : !p ? (
            <p className="small muted">No trip data for this park.</p>
          ) : (
            <>
              <p className="pc-best">
                {p.ok ? <>Best for you: <b>{MONTHS[p.best_month - 1]}</b></> : <>Misses one of your musts all year. Closest: <b>{MONTHS[p.best_month - 1]}</b></>}
              </p>
              <table className="pc-table">
                <colgroup><col className="pc-label-col" />{HORIZONS.map((h) => <col key={h.key} />)}</colgroup>
                <thead>
                  <tr>
                    <td />
                    {HORIZONS.map((h) => (
                      <th key={h.key} scope="col">
                        <span className={`stamp stamp-${h.stamp}`}>{HORIZON_LABEL(h.key, trip)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="pc-score-row">
                    <th scope="row">Match score</th>
                    {HORIZONS.map((h) => {
                      const s = p.scores[h.key];
                      return (
                        <td key={h.key} className="num">
                          <span className="pc-big">{s == null ? "n/a" : Math.round(s)}</span>
                          {s != null && <div className="pc-meter"><div style={{ left: `${s}%` }} /></div>}
                        </td>
                      );
                    })}
                  </tr>
                  {ROWS.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      {HORIZONS.map((h) => {
                        const fit = p.fits?.[h.key]?.[r.fit];
                        return (
                          <td key={h.key} className="num" title={fit == null ? undefined : `Fits your preferences ${Math.round(fit * 100)}/100`}>
                            {r.show(p.values[h.key] ?? {}, unit)}
                            <Bar fit={fit} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {bugs && (
                    <tr>
                      <th scope="row">Bugs</th>
                      {HORIZONS.map((h) => {
                        const fit = p.fits?.[h.key]?.bugs;
                        return (
                          <td key={h.key} className="num">
                            {fit == null ? "–" : `${Math.round(fit * 100)}/100`}
                            <Bar fit={fit} />
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          <div className="pc-foot">
            <span className="pc-key"><span className="pc-bar" aria-hidden="true"><span style={{ width: "70%" }} /></span>Fit to your preferences</span>
            {npsCode && <a href={`https://www.nps.gov/${npsCode}/`} target="_blank" rel="noreferrer">nps.gov →</a>}
          </div>
          <div className="pc-acts">{actions}</div>
        </div>
      </article>
    </div>
  );
}
