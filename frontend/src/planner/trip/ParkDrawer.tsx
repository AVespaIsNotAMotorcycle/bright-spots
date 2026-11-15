// Slide-out details for one park: then/now/2050, every reason, best days, moons, links.
import { useEffect, useRef, useState } from "react";
import { loadAtlas, type Atlas } from "../../atlas/model";
import type { Case } from "../../detective/cases";
import { useTrends } from "../../detective/games";
import { PhotoCredit, photoOf } from "../../detective/photos";
import type { BestDays } from "../model";
import { fetchDates, fmtWindow } from "./bestDates";
import { whatChanged } from "../whatChanged";
import { Badges, MonthStrip, ScoreRing, Sci } from "./TripCards";
import {
  CHIP,
  EMOJI,
  HORIZON_LABEL,
  LABEL,
  MONTHS_LONG,
  SOURCE_LABEL,
  reasonText,
  scoreColor,
  temp,
  whySentence,
  type Trip,
  type TripPark,
  type TripState,
  type Unit,
} from "./tripModel";

function useAtlas() {
  const [a, setA] = useState<Atlas | null>(null);
  useEffect(() => {
    loadAtlas().then(setA).catch(() => setA(null));
  }, []);
  return a;
}

function ThenNow({ p, trip, unit }: { p: TripPark; trip: Trip; unit: Unit }) {
  const data = useTrends(p.park.code ?? undefined);
  const s = data?.series?.tmax_c?.[String(p.best_month)] as unknown as { years: number[]; values: (number | null)[] } | undefined;
  const early = s ? s.values.filter((_, i) => s.years[i] >= 1981 && s.years[i] <= 1990).filter((v): v is number => v != null) : [];
  const then = early.length ? early.reduce((a, b) => a + b, 0) / early.length : null;
  const cells = [
    { t: "1980s", kind: "10-yr avg", tmax: then, score: null as number | null },
    { t: String(trip.this_year), kind: "one year", tmax: p.values.this_year?.tmax ?? null, score: p.scores.this_year },
    { t: String(trip.next_year), kind: "trend line", tmax: p.values.next_year?.tmax ?? null, score: p.scores.next_year },
    { t: "2050", kind: "model", tmax: p.values.y2050?.tmax ?? null, score: p.scores.y2050 },
  ];
  return (
    <div>
      <div className="tp-h">Then, now and 2050 · {MONTHS_LONG[p.best_month - 1]} daytime high</div>
      <div className="tp-hz">
        {cells.map((c) => {
          const s = c.tmax == null ? null : temp(c.tmax, unit);
          return (
            <div key={c.t}>
              <span className="tp-hz-t">{c.t}</span>
              <span className="tp-hz-k">{c.kind}</span>
              <b>{s == null ? "–" : <>{s.slice(0, -2)}<small>{s.slice(-2)}</small></>}</b>
              <span className="micro">{c.score == null ? "\u00a0" : `score ${Math.round(c.score)}`}</span>
            </div>
          );
        })}
      </div>
      <p className="tp-note" style={{ marginTop: 6 }}>
        Each box comes from a different source, so small ups and downs between them are not a trend.
      </p>
      <p className="tp-note">
        1980s: NASA POWER mean of 1981–1990. Forecast: this month's real trend extended one year, not a weather forecast.
        2050: WorldClim CMIP6 average of 6 models, {trip.scenario === "ssp585" ? "high" : "middle"} emissions; only temperature and rain change.
      </p>
    </div>
  );
}

/** One picked month: 31 day squares, the best stretch outlined, dates under it. */
function MonthDays({ bd, unit, top }: { bd: BestDays; unit: Unit; top: boolean }) {
  if (!bd.days) return <p className="tp-note">{MONTHS_LONG[bd.month - 1]}: {bd.note}</p>;
  const scores = bd.days.map((d) => d.score).filter((s): s is number => s != null);
  const flat = scores.length > 0 && Math.max(...scores) - Math.min(...scores) < 3;
  const w = bd.window;
  const inW = (d: number) => !!w && d >= w.start && d <= w.end;
  return (
    <div className={`tp-md${top ? " top" : ""}`}>
      <div className="tp-md-head">
        <b>{MONTHS_LONG[bd.month - 1]}</b>
        <span>{w ? <>best <b>{fmtWindow(bd)}</b> · {Math.round(w.mean)}</> : "no clear stretch"}</span>
      </div>
      <div className="tp-days" role="img" aria-label={`${MONTHS_LONG[bd.month - 1]}: best stretch ${fmtWindow(bd) ?? "none"}`}>
        {bd.days.map((d) => (
          <span key={d.day} className={inW(d.day) ? "in" : ""}
            title={`${MONTHS_LONG[bd.month - 1].slice(0, 3)} ${d.day}: score ${d.score == null ? "–" : Math.round(d.score)}, high ${d.tmax == null ? "–" : temp(d.tmax, unit)}`}
            style={{ background: scoreColor(d.score) }} />
        ))}
      </div>
      <div className="tp-days-ax" aria-hidden><span>1</span><span>15</span><span>{bd.days.length}</span></div>
      {flat && <p className="tp-note" style={{ margin: "2px 0 0" }}>Every day fits about the same. The stretch is only a little better.</p>}
    </div>
  );
}

function Days({ list, picked, unit, loading }: { list: BestDays[]; picked: number[]; unit: Unit; loading: boolean }) {
  if (loading) return <p className="tp-note">Finding the best dates…</p>;
  const ranked = [...list].filter((b) => b.window).sort((a, b) => b.window!.mean - a.window!.mean || a.month - b.month);
  const best = ranked[0];
  const byMonth = [...list].sort((a, b) => picked.indexOf(a.month) - picked.indexOf(b.month));
  return (
    <div>
      <div className="tp-h">📅 Best dates {picked.length > 1 && <small>in your {picked.length} months</small>}</div>
      {best ? (
        <p className="tp-dates">{fmtWindow(best)} <small>score {Math.round(best.window!.mean)}</small></p>
      ) : (
        <p className="small" style={{ margin: 0 }}>No dates to show.</p>
      )}
      {ranked.length > 1 && (
        <p className="small muted" style={{ margin: "0 0 8px" }}>
          Next best: {ranked.slice(1, 3).map((b) => fmtWindow(b)).join(", ")}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {byMonth.map((b) => <MonthDays key={b.month} bd={b} unit={unit} top={b === best} />)}
      </div>
      {list[0] && <p className="tp-note">Best 5-day stretch for your settings. {list[0].note}</p>}
    </div>
  );
}

export default function ParkDrawer({ p, trip, state, unit, science = false, caseFor, onClose, onCase, actions }: {
  p: TripPark; trip: Trip; state: TripState; unit: Unit; science?: boolean; caseFor?: Case;
  onClose: () => void; onCase?: (c: Case) => void; actions: React.ReactNode;
}) {
  const atlas = useAtlas();
  const [bd, setBd] = useState<BestDays[] | undefined>();
  const ref = useRef<HTMLDivElement>(null);
  const photo = photoOf(p.park.code);
  const changed = whatChanged(atlas, p.park.id, p.best_month, unit === "F", science);
  const moons = trip.new_moons[String(p.best_month)] ?? [];

  useEffect(() => {
    const ctl = new AbortController();
    setBd(undefined);
    // Only months that pass every must; if none do, the month the card names.
    const ok = state.months.filter((m) => p.month_scores[m - 1]?.ok);
    fetchDates(state, ok.length ? ok : [p.best_month], [p.park.id], ctl.signal)
      .then((r) => setBd(Object.values(r).map((x) => x[p.park.id]).filter((b): b is BestDays => !!b)))
      .catch(() => !ctl.signal.aborted && setBd([]));
    return () => ctl.abort();
  }, [p.park.id, p.best_month, p.month_scores, state]);

  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const rows = [...p.reasons].sort((a, b) => (a.kind === "feel" ? -1 : 0) - (b.kind === "feel" ? -1 : 0));
  return (
    <>
      <div className="tp-scrim" onClick={onClose} aria-hidden />
      <aside className="tp-drawer" role="dialog" aria-modal="true" aria-label={`${p.park.short} details`} tabIndex={-1} ref={ref}>
        <div className="tp-photo" style={{ backgroundImage: photo ? `url("${photo.file}")` : undefined }}>
          <button className="tp-close" onClick={onClose} aria-label="Close">✕</button>
          <div className="tp-name">{p.park.name}<small>{p.park.states.join(", ")} · {MONTHS_LONG[p.best_month - 1]}</small></div>
          <div className="tp-ring"><ScoreRing score={p.score} size={74} /></div>
        </div>
        {photo && <div style={{ padding: "4px 20px 0" }}><PhotoCredit photo={photo} style={{ color: "var(--text-muted)" }} /></div>}
        <div className="tp-sec">
          <div className="tp-why">{whySentence(p, unit)}</div>
          {!p.ok && p.failed.length > 0 && <p className="tp-note" style={{ color: "var(--rust)" }}>Fails a must: {p.failed.map(LABEL).join(", ")}.</p>}
          <div style={{ marginTop: 10 }}><Badges p={p} caseFor={caseFor} /></div>
          <div className="tp-actions" style={{ marginTop: 10 }}>{actions}</div>
        </div>
        <div className="tp-sec"><Days list={bd ?? []} loading={!bd} picked={state.months} unit={unit} /></div>
        <div className="tp-sec">
          <div className="tp-h">Every check, scored for {HORIZON_LABEL(trip.horizon, trip)}</div>
          {science && (
            <p className="tp-note" style={{ marginTop: 0 }}>
              🔬 Score = sum of (factor × weight) ÷ sum of weights × 100 ={" "}
              <b>{Math.round(p.score ?? 0)}</b>. Weights: daytime high 2, must 1.5, nice 1. A must below 50 hides the park.
            </p>
          )}
          <div className="tp-bars">
            {rows.map((r) => (
              <div key={r.key} className="tp-barrow" title={r.key === "temperature" ? "NASA POWER" : SOURCE_LABEL[CHIP[r.key]?.source ?? "nasa"]}>
                <span>
                  {EMOJI(r.key)} <b>{LABEL(r.key)}</b>{r.level === "must" ? " (must)" : ""}{CHIP[r.key]?.source === "estimate" ? " · est." : ""}
                  <span className="muted"> · {reasonText(r, unit)}</span>
                  {science && <> <Sci r={r} /></>}
                </span>
                <span className="tp-meter" aria-label={r.score == null ? "no data" : `${Math.round(r.score * 100)} of 100`}>
                  <i style={{ width: `${(r.score ?? 0) * 100}%`, background: r.score == null ? "transparent" : r.score >= 0.5 ? "var(--pine)" : "var(--rust)" }} />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="tp-sec">
          <div className="tp-h">All year <small>gold = best month · dots = your months · faded = fails a must</small></div>
          <MonthStrip p={p} picked={state.months} />
        </div>
        <div className="tp-sec"><ThenNow p={p} trip={trip} unit={unit} /></div>
        {changed && (
          <div className="tp-sec">
            <div className="tp-h">What changed?</div>
            <p className="small" style={{ margin: 0 }}>{changed} <span className="muted">NASA POWER daytime high, Sen's slope.</span></p>
          </div>
        )}

        {state.want.stars && (
          <div className="tp-sec">
            <div className="tp-h">🌑 New moon</div>
            <p className="small" style={{ margin: 0 }}>
              {moons.length ? `${MONTHS_LONG[p.best_month - 1]} ${moons.join(" and ")}: the darkest nights are a few days either side.` : "No new moon this month."}{" "}
              Night is {(24 - p.day_length).toFixed(1)} hours long here.
            </p>
            <p className="tp-note">Moon dates from the average lunar cycle; they can be off by a day.</p>
          </div>
        )}
        <div className="tp-sec" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {caseFor && onCase && <button className="btn" onClick={() => onCase(caseFor)}>🔍 Solve “{caseFor.title}” before you go</button>}
          {p.park.code && <a className="btn-ghost" href={`https://www.nps.gov/${p.park.code}/`} target="_blank" rel="noreferrer">{p.park.short} on nps.gov ↗</a>}
        </div>
        <div className="tp-sec" style={{ borderBottom: 0 }}>
          <p className="tp-note" style={{ margin: 0 }}>
            Sources: {trip.sources.power ?? "NASA POWER"}; {p.fire_source ?? "no fire data for this park"}; 1991–2020 NASA POWER normals;
            WorldClim CMIP6 for 2050. Wildflowers, fall colours and bugs are estimates from weather. Visitors: 2025, yearly.
          </p>
        </div>
      </aside>
    </>
  );
}
