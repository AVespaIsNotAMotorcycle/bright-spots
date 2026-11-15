// Trip planner: moods and settings on the left, only the best-matched parks on the right.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Case } from "../../detective/cases";
import { loadProgress } from "../../detective/games";
import { photoOf } from "../../detective/photos";
import { caseForPark, casesByPark } from "../../detective/stamps";
import { useWishlist } from "../../detective/wishlist";
import { play } from "../../detective/sound";
import ParkMap from "../../research/ParkMap";
import CompareTray, { MAX_COMPARE } from "./CompareTray";
import ParkDrawer from "./ParkDrawer";
import { Row, TopCard } from "./TripCards";
import TripSettings from "./TripSettings";
import { shareTripCard } from "./tripCard";
import { TRIP_CSS } from "./tripStyles";
import {
  DEFAULT_STATE,
  HORIZON_LABEL,
  clearFilters,
  filterCount,
  searchParks,
  LABEL,
  MONTHS,
  MOODS,
  applyMood,
  decodeState,
  encodeState,
  fetchTrip,
  scoreColor,
  whySentence,
  type HorizonKey,
  type Trip,
  type TripPark,
  type TripState,
  type Unit,
} from "./tripModel";
import { whatChanged } from "../whatChanged";
import { loadAtlas, type Atlas } from "../../atlas/model";

const TOP = 3;
const MORE = 5;
const KEY = "trip.state";

function initial(q: string | null | undefined, month: number | null | undefined): TripState {
  let s = decodeState(q);
  if (!s) {
    try {
      s = decodeState(localStorage.getItem(KEY));
    } catch {
      /* storage unavailable */
    }
  }
  s = s ?? DEFAULT_STATE;
  return month && month >= 1 && month <= 12 ? { ...s, months: [month] } : s;
}

export default function TripPlanner({ unit, setUnit, month, park, q, science = false, onState, onCase }: {
  unit: Unit;
  setUnit: (u: Unit) => void;
  month?: number | null;
  /** NPS code from a case's "Plan a trip here": opens that park. */
  park?: string | null;
  /** Encoded settings from the URL, so a trip can be shared. */
  q?: string | null;
  /** Explorer science switch: adds p and q to "What changed?". */
  science?: boolean;
  onState?: (encoded: string) => void;
  onCase?: (caseId: string) => void;
}) {
  const [state, setState] = useState<TripState>(() => initial(q, month));
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); // park code in the drawer
  const [view, setView] = useState<"list" | "map">("list");
  const [compare, setCompare] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const [wish, toggleWish] = useWishlist();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [find, setFind] = useState("");
  const [showAll, setShowAll] = useState(false);
  const opened = useRef<string | null>(null);

  useEffect(() => {
    loadAtlas().then(setAtlas).catch(() => undefined);
  }, []);

  // A month from Home or a case picks that month.
  useEffect(() => {
    if (month && month >= 1 && month <= 12) setState((s) => (s.months.length === 1 && s.months[0] === month ? s : { ...s, months: [month] }));
  }, [month]);

  const progress = useMemo(loadProgress, []);
  const mysteryCodes = useMemo(
    () => [...casesByPark().entries()].filter(([, cs]) => cs.some((c) => !progress[c.id])).map(([code]) => code),
    [progress],
  );

  const set = (patch: Partial<TripState>) => {
    setMood(null);
    setState((s) => ({ ...s, ...patch }));
  };

  // Save, put it in the URL, and fetch (debounced so fast tapping makes one request).
  useEffect(() => {
    const enc = encodeState(state);
    try {
      localStorage.setItem(KEY, enc);
    } catch {
      /* storage unavailable */
    }
    onState?.(enc);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetchTrip(state, mysteryCodes, ctl.signal)
        .then((r) => {
          setTrip(r);
          setError(null);
        })
        .catch((e) => !ctl.signal.aborted && setError(e instanceof Error ? e.message : String(e)))
        .finally(() => !ctl.signal.aborted && setLoading(false));
    }, 200);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map((trip?.parks ?? []).map((p) => [p.park.id, p])), [trip]);
  const matches = useMemo(() => (trip?.parks ?? []).filter((p) => p.ok), [trip]);
  const shown = matches.slice(0, TOP + MORE);
  const found = useMemo(() => searchParks(trip?.parks ?? [], find), [trip, find]);
  const rankOf = useMemo(() => new Map((trip?.parks ?? []).map((p, i) => [p.park.id, i + 1])), [trip]);
  const nFilters = filterCount(state);
  const rest = (trip?.parks ?? []).filter((p) => !shown.includes(p));

  // Open the park a case sent us to, once.
  useEffect(() => {
    const hit = park && trip ? trip.parks.find((p) => p.park.code === park) : undefined;
    if (park && hit && opened.current !== park) {
      opened.current = park;
      setOpen(hit.park.id);
    }
  }, [park, trip]);

  const caseOf = (p: TripPark): Case | undefined => (p.park.code ? caseForPark(p.park.code, progress) : undefined);
  const code = (p: TripPark) => p.park.id;
  // The map is keyed by NPS code (Sequoia and Kings Canyon share one); take the better-ranked park.
  const byMapId = (c: string) => trip?.parks.find((p) => (p.park.code ?? p.park.id) === c);
  const changed = (p: TripPark) => whatChanged(atlas, p.park.id, p.best_month, unit === "F");

  const actions = (p: TripPark) => {
    const c = code(p);
    const w = p.park.code ?? p.park.id;
    const inCmp = compare.includes(c);
    return (
      <>
        <button className="tp-act" aria-pressed={wish.includes(w)} onClick={() => toggleWish(w)} title="Save to your Saved tab">
          {wish.includes(w) ? "♥ Saved" : "♡ Want to go"}
        </button>
        <button className="tp-act" aria-pressed={inCmp} disabled={!inCmp && compare.length >= MAX_COMPARE}
          onClick={() => setCompare((x) => (inCmp ? x.filter((y) => y !== c) : [...x, c]))}>
          {inCmp ? "✓ Comparing" : "🗂 Compare"}
        </button>
        <button className="tp-act" onClick={() => shareTripCard(p, unit, changed(p))} title="Download or share a picture of this trip">🖼 Trip card</button>
      </>
    );
  };

  const surprise = () => {
    const pool = matches.filter((p) => (p.score ?? 0) >= 70);
    const pick = (pool.length ? pool : matches)[Math.floor(Math.random() * Math.max(1, (pool.length ? pool : matches).length))];
    if (pick) {
      play("flip");
      setOpen(code(pick));
    }
  };

  const relaxTo = (key: string) => {
    if (state.want[key] === "must") set({ want: { ...state.want, [key]: "nice" } });
    if (state.avoid[key] === "must") set({ avoid: { ...state.avoid, [key]: "nice" } });
  };

  const goBefore = matches.filter((p) => p.change_2050 != null && p.change_2050 <= -10).sort((a, b) => a.change_2050! - b.change_2050!).slice(0, 3);
  const heroPhoto = shown[0] ? photoOf(shown[0].park.code) : undefined;
  const drawerPark = open ? byId.get(open) : undefined;
  const monthsText = state.months.length > 3 ? `${state.months.length} months` : state.months.map((m) => MONTHS[m - 1]).join(", ");

  return (
    <div className="tp">
      <style>{TRIP_CSS}</style>
      <aside className={`tp-side${sheet ? " open" : ""}`} aria-label="Your trip">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", color: "var(--pine)", fontSize: 22 }}>Your trip</h2>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {nFilters > 0 && <button className="tp-clear" onClick={() => set(clearFilters(state))}>Clear all</button>}
            <button className="tp-act tp-edit" onClick={() => setSheet(false)}>Done</button>
          </span>
        </div>
        <TripSettings state={state} set={set} unit={unit} setUnit={setUnit} />
      </aside>

      <div className="tp-main">
        <button className="btn tp-edit" onClick={() => setSheet(true)}>⚙ Edit trip · {monthsText}</button>

        <section className="tp-hero" style={heroPhoto ? ({ "--tp-hero": `url("${heroPhoto.file}")` } as React.CSSProperties) : undefined}>
          <h2>Where should you go?</h2>
          <p>Pick a mood, or build your own trip on the left. Every score comes from NASA climate data.</p>
          <div className="tp-moods" role="group" aria-label="Trip moods">
            {MOODS.map((m) => (
              <button key={m.id} className="tp-mood" aria-pressed={mood === m.id}
                onClick={() => {
                  setState((s) => applyMood(s, m));
                  setMood(m.id);
                  play("tick");
                }}>
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </section>

        <div className="tp-bar">
          <div>
            <p className="tp-count" aria-live="polite">
              {trip ? (matches.length ? `${matches.length} park${matches.length === 1 ? "" : "s"} fit your trip` : "No park fits every must") : "Finding parks…"}
              {loading && trip ? " · updating…" : ""}
            </p>
            <span className="small muted">{monthsText} · ranked for {HORIZON_LABEL(state.horizon, trip)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div className="tp-seg" role="group" aria-label="Year">
              {(["this_year", "next_year", "y2050"] as HorizonKey[]).map((h) => (
                <button key={h} aria-pressed={state.horizon === h} onClick={() => set({ horizon: h })}>{HORIZON_LABEL(h, trip)}</button>
              ))}
            </div>
            <div className="tp-seg" role="group" aria-label="View">
              <button aria-pressed={view === "list"} onClick={() => setView("list")}>☰ List</button>
              <button aria-pressed={view === "map"} onClick={() => setView("map")}>🗺 Map</button>
            </div>
            <button className="tp-act" onClick={surprise} disabled={!matches.length}>🎲 Surprise me</button>
          </div>
        </div>

        <div className="tp-find">
          <input type="search" className="tp-search" placeholder="Search a park or state" aria-label="Search a park or state"
            value={find} onChange={(e) => setFind(e.target.value)} />
          {nFilters > 0 && (
            <button className="tp-clear" onClick={() => { set(clearFilters(state)); play("tick"); }}>
              Clear all filters ({nFilters})
            </button>
          )}
        </div>

        {error && <p className="error">Could not load parks: {error}</p>}

        {trip && find.trim() && (
          <section aria-live="polite">
            <div className="tp-h">
              {found.length ? `${found.length} park${found.length === 1 ? "" : "s"} match “${find.trim()}”` : `No park matches “${find.trim()}”`}
              <button className="tp-clear" onClick={() => setFind("")}>Clear search</button>
            </div>
            <div className="tp-rows">
              {found.map((p) => (
                <Row key={p.park.id} p={p} rank={rankOf.get(p.park.id) ?? 0} unit={unit} onOpen={() => setOpen(code(p))} actions={actions(p)} />
              ))}
            </div>
          </section>
        )}

        {trip && trip.relax.length > 0 && matches.length < TOP && (
          <section className="tp-relax">
            <b>Too strict? Relax one thing:</b>
            <div className="tp-chips" style={{ marginTop: 8 }}>
              {trip.relax.slice(0, 4).map((r) => (
                <button key={r.key} className="tp-chip" onClick={() => relaxTo(r.key)}>
                  Make “{LABEL(r.key)}” nice to have <b>+{r.parks} park{r.parks === 1 ? "" : "s"}</b>
                </button>
              ))}
            </div>
          </section>
        )}

        {!trip && !error && (
          <div className="tp-top3">{[0, 1, 2].map((i) => <div key={i} className="tp-skel" aria-hidden />)}</div>
        )}

        {trip && shown[0] && view === "list" && !find.trim() && (
          <>
            <div className="tp-why"><b>Why #1?</b> {whySentence(shown[0], unit)}</div>
            <div className="tp-top3">
              {shown.slice(0, TOP).map((p, i) => (
                <TopCard key={p.park.id} p={p} i={i} unit={unit} picked={state.months} caseFor={caseOf(p)} science={science}
                  onOpen={() => setOpen(code(p))} actions={actions(p)} />
              ))}
            </div>
            {shown.length > TOP && (
              <section>
                <div className="tp-h">{shown.length - TOP} more good fits</div>
                <div className="tp-rows">
                  {shown.slice(TOP).map((p, i) => (
                    <Row key={p.park.id} p={p} rank={i + TOP + 1} unit={unit} onOpen={() => setOpen(code(p))} actions={actions(p)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {trip && view === "list" && !find.trim() && rest.length > 0 && (
          showAll ? (
            <section>
              <div className="tp-h">
                All other parks ({rest.length})
                <button className="tp-clear" onClick={() => setShowAll(false)}>Hide</button>
              </div>
              <div className="tp-rows">
                {rest.map((p) => (
                  <Row key={p.park.id} p={p} rank={rankOf.get(p.park.id) ?? 0} unit={unit} onOpen={() => setOpen(code(p))} actions={actions(p)} />
                ))}
              </div>
            </section>
          ) : (
            <button className="btn-ghost tp-more" onClick={() => setShowAll(true)}>
              See all {trip.parks.length} parks
            </button>
          )
        )}

        {trip && view === "map" && (
          <section className="card">
            <ParkMap
              parks={[...new Map(trip.parks.map((p) => [p.park.code ?? p.park.id, p])).values()].map((p) => ({
                id: p.park.code ?? p.park.id, name: p.park.short, state: p.park.states.join(", "), lat: p.park.lat, lon: p.park.lon,
              }))}
              colorOf={(c) => {
                const p = byMapId(c);
                return !p || !p.ok ? "#b9ae97" : scoreColor(p.score);
              }}
              radius={(c) => (shown.some((p) => (p.park.code ?? p.park.id) === c) ? 8 : 4)}
              tip={(c) => {
                const p = byMapId(c);
                return p ? `${p.ok ? `score ${Math.round(p.score ?? 0)}, best in ${MONTHS[p.best_month - 1]}` : "fails a must"}` : "";
              }}
              onPick={(c) => {
                const p = byMapId(c);
                if (p) setOpen(p.park.id);
              }}
            />
            <p className="tp-note">Big dots: your top {shown.length}. Darker green = better fit. Grey = fails a must.</p>
          </section>
        )}

        {trip && goBefore.length > 0 && (
          <section className="card" style={{ background: "#fbf1e8" }}>
            <div className="tp-h">⏳ Go before it changes</div>
            <p className="small" style={{ margin: "0 0 8px" }}>These good fits score lower for the same month in the 2050 climate model.</p>
            <div className="tp-chips">
              {goBefore.map((p) => (
                <button key={p.park.id} className="tp-chip" onClick={() => setOpen(code(p))}>
                  {p.park.short} · {MONTHS[p.best_month - 1]} <b style={{ color: "var(--rust)" }}>{Math.round(p.change_2050!)}</b>
                </button>
              ))}
            </div>
            <p className="tp-note">2050: WorldClim CMIP6, 6-model average. Only temperature and rain change in the model.</p>
          </section>
        )}

        <CompareTray parks={compare.map((c) => byId.get(c)).filter((p): p is TripPark => !!p)} unit={unit}
          onRemove={(c) => setCompare((x) => x.filter((y) => y !== c))} onClear={() => setCompare([])} />

        <p className="tp-note">
          Scores 0–100 mix your choices: NASA POWER climate (1991–2020 normals, 2005–2024 extras), NASA FIRMS fires (2015–2024),
          the real trend for next year, and WorldClim CMIP6 for 2050. Not a weather forecast.
        </p>
      </div>

      {drawerPark && trip && (
        <ParkDrawer p={drawerPark} trip={trip} state={state} unit={unit} science={science} caseFor={caseOf(drawerPark)}
          onClose={() => setOpen(null)} onCase={onCase ? (c) => onCase(c.id) : undefined} actions={actions(drawerPark)} />
      )}
    </div>
  );
}
