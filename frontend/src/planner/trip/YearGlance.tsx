// One park across the whole year: best months, things to do and when, what to watch out for.
// Works with no settings picked, so a park never opens to an empty drawer.
import { useEffect, useState } from "react";
import { EMOJI, LABEL, MONTHS, temp, type TripPark, type TripState, type Unit } from "./tripModel";

export interface YearMonth {
  month: number;
  tmax: number | null;
  tmin: number | null;
  precip: number | null;
  rainy_days: number | null;
  snow: number | null;
  good: string[];
  bad: string[];
}

export async function fetchYear(parkId: string, s: Pick<TripState, "horizon" | "scenario">, signal?: AbortSignal): Promise<YearMonth[]> {
  const q = new URLSearchParams({ horizon: s.horizon, scenario: s.scenario });
  const r = await fetch(`/api/parks/${encodeURIComponent(parkId)}/year?${q}`, { signal });
  if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
  return ((await r.json()) as { months: YearMonth[] }).months;
}

/** [12, 1, 2, 5] -> "Dec–Feb, May". Runs wrap past December. */
export function monthSpans(ms: number[]): string {
  const on = new Set(ms);
  if (on.size === 12) return "all year";
  if (on.size === 0) return "";
  // Start each run at a month whose previous month is off, so Dec–Feb stays one run.
  const runs: [number, number][] = [];
  for (let m = 1; m <= 12; m++) {
    const prev = m === 1 ? 12 : m - 1;
    if (!on.has(m) || on.has(prev)) continue;
    let end = m;
    while (on.has((end % 12) + 1) && (end % 12) + 1 !== m) end = (end % 12) + 1;
    runs.push([m, end]);
  }
  // A run that wraps past December holds January, so it reads first.
  runs.sort((a, b) => Number(b[1] < b[0]) - Number(a[1] < a[0]));
  return runs.map(([a, b]) => (a === b ? MONTHS[a - 1] : `${MONTHS[a - 1]}–${MONTHS[b - 1]}`)).join(", ");
}

/** Tag -> months it shows up in, most months first. */
function byTag(year: YearMonth[], pick: (m: YearMonth) => string[]): [string, number[]][] {
  const map = new Map<string, number[]>();
  for (const m of year) for (const k of pick(m)) map.set(k, [...(map.get(k) ?? []), m.month]);
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

export default function YearGlance({ p, state, unit }: { p: TripPark; state: TripState; unit: Unit }) {
  const [year, setYear] = useState<YearMonth[] | null | undefined>();
  useEffect(() => {
    const ctl = new AbortController();
    setYear(undefined);
    fetchYear(p.park.id, state, ctl.signal).then(setYear).catch(() => !ctl.signal.aborted && setYear(null));
    return () => ctl.abort();
  }, [p.park.id, state.horizon, state.scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  if (year === undefined) return <p className="tp-note">Loading the year…</p>;
  if (year === null) return <p className="tp-note">Could not load the year for this park.</p>;

  // Best months: within 8 points of the top month, using the planner's own month scores.
  const sc = p.month_scores.map((m) => m.score ?? -1);
  const top = Math.max(...sc);
  const best = top < 0 ? [] : sc.flatMap((s, i) => (s >= top - 8 ? [i + 1] : []));
  const picked = new Set(Object.keys(state.want));
  const todo = byTag(year, (m) => m.good).sort((a, b) => Number(picked.has(b[0])) - Number(picked.has(a[0])));
  const watch = byTag(year, (m) => m.bad);
  const t = (c: number | null) => (c == null ? "–" : temp(c, unit));

  return (
    <div className="tp-year">
      <div className="tp-h">The year at {p.park.short}</div>
      {best.length > 0 && (
        <p className="tp-year-best">
          Best: <b>{monthSpans(best)}</b>
          <small> for {state.feels.length || state.custom ? "your warmth" : `comfy ${temp(15, unit)}–${temp(30, unit)} highs`}</small>
        </p>
      )}

      {todo.length > 0 && (
        <>
          <div className="tp-year-sub">Things to do</div>
          <ul className="tp-year-list">
            {todo.map(([k, ms]) => (
              <li key={k} className={picked.has(k) ? "on" : ""}>
                <span>{EMOJI(k)} {LABEL(k)}{picked.has(k) && <small> · you picked this</small>}</span>
                <b>{monthSpans(ms)}</b>
              </li>
            ))}
          </ul>
        </>
      )}

      {watch.length > 0 && (
        <>
          <div className="tp-year-sub">Watch out for</div>
          <ul className="tp-year-list bad">
            {watch.map(([k, ms]) => (
              <li key={k}>
                <span>{EMOJI(k)} {LABEL(k)}</span>
                <b>{monthSpans(ms)}</b>
              </li>
            ))}
          </ul>
        </>
      )}

      <table className="tp-year-table">
        <thead>
          <tr><th>Month</th><th>High</th><th>Low</th><th>Rainy days</th></tr>
        </thead>
        <tbody>
          {year.map((m) => (
            <tr key={m.month} className={best.includes(m.month) ? "best" : state.months.includes(m.month) ? "picked" : ""}>
              <td>{MONTHS[m.month - 1]}</td>
              <td>{t(m.tmax)}</td>
              <td>{t(m.tmin)}</td>
              <td>{m.rainy_days == null ? "–" : Math.round(m.rainy_days)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tp-note">
        Highs and rain: NASA POWER, for the same year as the scores. Lows and rainy days: NASA POWER 2005–2024 average.
        "Things to do" and "Watch out for" are estimates from that weather, not park reports.
      </p>
    </div>
  );
}
