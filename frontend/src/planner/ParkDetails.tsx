import { useEffect, useState } from "react";
import YearChart from "./YearChart";
import {
  FACTOR_LABEL,
  MONTHS,
  MONTH_STARTS,
  cToF,
  distanceKm,
  fetchDaily,
  mmToIn,
  type DailyCurves,
  type DailyVar,
  type FactorKey,
  type Horizon,
  type HorizonKey,
  type ParkPlan,
  type Place,
  type Plan,
} from "./model";
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
const DAILY_LABEL: Record<DailyVar, string> = {
  tmax: "Daytime high",
  rh: "Humidity",
  precip: "Rain per day",
  cloud: "Cloud cover",
};

function dailyFormat(v: DailyVar, unit: Unit): (x: number) => string {
  if (v === "tmax") return (x) => (unit === "F" ? `${Math.round(cToF(x))}°F` : `${Math.round(x)}°C`);
  if (v === "precip") return (x) => (unit === "F" ? `${mmToIn(x).toFixed(2)} in` : `${x.toFixed(1)} mm`);
  return (x) => `${Math.round(x)}%`;
}

/** 0-based non-leap day-of-year index -> "Nov 11". */
function dayLabel(doy: number): string {
  const m = MONTH_STARTS.findIndex((start, i) => doy >= start && doy < MONTH_STARTS[i + 1]);
  return `${MONTHS[m]} ${doy - MONTH_STARTS[m] + 1}`;
}

interface Tip {
  v: DailyVar;
  hz: (typeof HORIZONS)[number];
  x: number;
  y: number;
}

/** Floating chart of a year of daily values for one variable and horizon. */
function DailyTip({ tip, parkId, plan, unit }: { tip: Tip; parkId: string; plan: Plan; unit: Unit }) {
  const [data, setData] = useState<DailyCurves | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchDaily(parkId, plan.scenario)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [parkId, plan.scenario]);

  const W = 320;
  const left = Math.max(8, Math.min(tip.x - W / 2, window.innerWidth - W - 8));
  const above = tip.y > 240;
  const style = above ? { left, bottom: window.innerHeight - tip.y + 8 } : { left, top: tip.y + 28 };
  const title = `${DAILY_LABEL[tip.v]} · ${horizonTitle(tip.hz.key, plan)} ${tip.hz.tag.toLowerCase()}`;
  let note = "";
  if (data && tip.hz.key === "this_year") {
    const days = data.this_year[tip.v];
    const last = days.reduce<number>((acc, v, i) => (v != null ? i : acc), -1);
    note = last < 0 ? "No days measured yet this year." : `Measured days through ${dayLabel(last)} ${data.year}.`;
  }
  if (tip.hz.key === "next_year") note = "Daily shape of 1991–2020, shifted by the monthly forecast.";
  if (tip.hz.key === "y2050")
    note =
      tip.v === "tmax" || tip.v === "precip"
        ? "Daily shape of 1991–2020, shifted by the monthly 2041–2060 projection."
        : "Not projected for 2050; shown at the 1991–2020 average.";
  return (
    <div className="daily-tip" role="tooltip" id="daily-tip" style={style}>
      <div className="small daily-tip-title">{title}</div>
      {error && <p className="small error">{error}</p>}
      {!data && !error && <p className="small muted">Loading…</p>}
      {data && (
        <YearChart
          normal={data.normal[tip.v]}
          series={tip.hz.key === "y2050" ? data.y2050[tip.v] : data[tip.hz.key][tip.v]}
          seriesLabel={`${horizonTitle(tip.hz.key, plan)} ${tip.hz.tag.toLowerCase()}`}
          seriesClass={tip.hz.tagClass}
          month={plan.month}
          format={dailyFormat(tip.v, unit)}
        />
      )}
      {note && <p className="micro muted daily-tip-note">{note}</p>}
    </div>
  );
}

export function Details({ p, plan, unit }: { p: ParkPlan; plan: Plan; unit: Unit }) {
  const factorKeys = Object.keys(p.this_year.factors) as FactorKey[];
  const rows: [string, DailyVar, (h: Horizon) => string][] = [
    ["Daytime high", "tmax", (h) => fmtTemp(h.values.tmax, unit)],
    ["Humidity", "rh", (h) => pct(h.values.rh)],
    ["Rain (month)", "precip", (h) => fmtRain(h.values.precip, unit)],
    ["Cloud cover", "cloud", (h) => pct(h.values.cloud)],
  ];
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (v: DailyVar, hz: Tip["hz"]) => (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ v, hz, x: r.left + r.width / 2, y: r.top });
  };
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
            {rows.map(([label, v, fmt]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {HORIZONS.map((hz) => (
                  <td
                    key={hz.key}
                    className="num has-tip"
                    tabIndex={0}
                    aria-describedby={tip && tip.v === v && tip.hz.key === hz.key ? "daily-tip" : undefined}
                    onMouseEnter={show(v, hz)}
                    onFocus={show(v, hz)}
                    onMouseLeave={() => setTip(null)}
                    onBlur={() => setTip(null)}
                  >
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
      {tip && <DailyTip tip={tip} parkId={p.park.id} plan={plan} unit={unit} />}
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
