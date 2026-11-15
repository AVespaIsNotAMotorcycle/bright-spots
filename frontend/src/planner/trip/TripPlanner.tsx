// Trip planner, in two steps.
//   1. Preferences: when, how warm, what you're into and what to avoid.
//   2. Parks: every park ranked on the left (tick to pick), and a card per picked park on the
//      right showing this year and next year side by side.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Case } from "../../detective/cases";
import { loadProgress } from "../../detective/games";
import { parkKey } from "../../detective/parkKey";
import { photoOf } from "../../detective/photos";
import { caseForPark, casesByPark } from "../../detective/stamps";
import { useWishlist } from "../../detective/wishlist";
import { play } from "../../detective/sound";
import Postcard from "../../saved/Postcard";
import ParkDrawer from "./ParkDrawer";
import { ScoreRing } from "./TripCards";
import TripSettings from "./TripSettings";
import { TRIP_CSS } from "./tripStyles";
import {
  DEFAULT_STATE,
  HORIZON_LABEL,
  clearCount,
  isBrowse,
  clearFilters,
  searchParks,
  LABEL,
  MONTHS,
  MOODS,
  applyMood,
  decodeState,
  encodeState,
  fetchTrip,
  type HorizonKey,
  type Trip,
  type TripPark,
  type TripState,
  type Unit,
} from "./tripModel";
import { trendTag } from "../whatChanged";
import { loadAtlas, type Atlas } from "../../atlas/model";

/** How many of the best matches start ticked. */
export const DEFAULT_PICKS = 3;
/** The card columns: always both, never a toggle. */
export const CARD_HORIZONS: HorizonKey[] = ["this_year", "next_year"];
const KEY = "trip.state";

export type Stage = "prefs" | "parks";

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
  // Cards show this year and next year together, so the list is always ranked for next year.
  s = { ...s, horizon: "next_year" };
  return month && month >= 1 && month <= 12 ? { ...s, months: [month] } : s;
}

/** The ticked parks: the user's own picks, or else the top matches (plus a park a link asked for). */
export function defaultPicks(order: TripPark[], browse: boolean, wanted: string | null): string[] {
  const top = browse ? [] : order.filter((p) => p.ok).slice(0, DEFAULT_PICKS).map((p) => p.park.id);
  if (!wanted) return top;
  return [wanted, ...top.filter((id) => id !== wanted)].slice(0, Math.max(DEFAULT_PICKS, 1));
}

export default function TripPlanner({ unit, setUnit, month, park, q, stage, science = false, onState, onStage, onCase }: {
  unit: Unit;
  setUnit: (u: Unit) => void;
  month?: number | null;
  /** Park id or NPS code from a case's or a saved park's "Plan": opens step 2 with that park picked. */
  park?: string | null;
  /** Encoded settings from the URL, so a trip can be shared. */
  q?: string | null;
  /** Which step to show. */
  stage: Stage;
  /** Explorer science switch: adds p and q to "What changed?". */
  science?: boolean;
  onState?: (encoded: string) => void;
  onStage: (s: Stage) => void;
  onCase?: (caseId: string) => void;
}) {
  const [state, setState] = useState<TripState>(() => initial(q, month));
  // Settings that came from a shared link (null once the viewer changes anything).
  const [fromLink] = useState<string | null>(() => {
    const d = decodeState(q);
    if (!d) return null;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* storage unavailable */
    }
    const enc = encodeState({ ...d, horizon: "next_year" });
    return enc === saved ? null : enc;
  });
  const linkEnc = useRef<string | null>(fromLink);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); // park id in the drawer
  const [mood, setMood] = useState<string | null>(null);
  const [wish, toggleWish] = useWishlist();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [find, setFind] = useState("");
  /** The user's own ticks; null until they tick or untick something (then the top matches show). */
  const [picked, setPicked] = useState<string[] | null>(null);

  useEffect(() => {
    loadAtlas().then(setAtlas).catch(() => undefined);
  }, []);

  // A month from a case or a saved park picks that month.
  useEffect(() => {
    if (month && month >= 1 && month <= 12) setState((s) => (s.months.length === 1 && s.months[0] === month ? s : { ...s, months: [month] }));
  }, [month]);

  const progress = useMemo(loadProgress, []);
  const mysteryCodes = useMemo(
    () => [...casesByPark().entries()].filter(([, cs]) => cs.some((c) => !progress[c.id])).map(([code]) => code),
    [progress],
  );

  // New preferences mean a new ranking, so the ticks go back to the new top matches.
  const set = (patch: Partial<TripState>) => {
    setMood(null);
    setPicked(null);
    setState((s) => ({ ...s, ...patch }));
  };

  // Save, put it in the URL, and fetch (debounced so fast tapping makes one request).
  useEffect(() => {
    const enc = encodeState(state);
    // A shared link shows its settings but must not overwrite the viewer's own until they edit.
    if (linkEnc.current !== null && enc !== linkEnc.current) linkEnc.current = null;
    try {
      if (linkEnc.current === null) localStorage.setItem(KEY, enc);
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

  const browse = !!trip && isBrowse(state);
  const matches = useMemo(() => (trip?.parks ?? []).filter((p) => p.ok), [trip]);
  // No filters: nothing to rank by, so list every park A to Z with no rank or score.
  const order = useMemo(
    () => (browse ? [...(trip?.parks ?? [])].sort((a, b) => a.park.short.localeCompare(b.park.short)) : trip?.parks ?? []),
    [trip, browse],
  );
  const rankOf = useMemo(() => new Map((trip?.parks ?? []).map((p, i) => [p.park.id, i + 1])), [trip]);
  const byId = useMemo(() => new Map((trip?.parks ?? []).map((p) => [p.park.id, p])), [trip]);
  const listed = find.trim() ? searchParks(order, find) : order;

  // A park from a link: park id first (Sequoia and Kings Canyon share code seki), then NPS code.
  const wantedId = useMemo(() => {
    if (!park || !trip) return null;
    return (trip.parks.find((p) => p.park.id === park) ?? trip.parks.find((p) => p.park.code === park))?.park.id ?? null;
  }, [park, trip]);

  const ticks = picked ?? defaultPicks(order, browse, wantedId);
  // Cards follow the list order, so the best match is always first.
  const cards = order.filter((p) => ticks.includes(p.park.id));
  const toggle = (id: string) => {
    setPicked(ticks.includes(id) ? ticks.filter((x) => x !== id) : [...ticks, id]);
    play("tick");
  };

  const caseOf = (p: TripPark): Case | undefined => (p.park.code ? caseForPark(p.park.code, progress) : undefined);
  const relaxTo = (key: string) => {
    if (state.want[key] === "must") set({ want: { ...state.want, [key]: "nice" } });
    if (state.avoid[key] === "must") set({ avoid: { ...state.avoid, [key]: "nice" } });
  };

  const nClear = clearCount(state);
  const noWarmth = !state.custom && state.feels.length === 0;
  const monthsText = state.months.length === 0 ? "Any time" : state.months.length > 3 ? `${state.months.length} months` : state.months.map((m) => MONTHS[m - 1]).join(", ");
  const countText = trip
    ? browse
      ? `All ${trip.parks.length} parks`
      : matches.length
        ? `${matches.length} park${matches.length === 1 ? "" : "s"} fit your trip`
        : "No park fits every must"
    : "Finding parks…";
  const drawerPark = open ? byId.get(open) : undefined;

  if (stage === "prefs") {
    const heroPhoto = matches[0] ? photoOf(matches[0].park.code) : undefined;
    return (
      <div className="tp-prefs">
        <style>{TRIP_CSS}</style>
        <section className="tp-hero" style={heroPhoto ? ({ "--tp-hero": `url("${heroPhoto.file}")` } as React.CSSProperties) : undefined}>
          <h1>Where should you go?</h1>
          <div className="tp-moods" role="group" aria-label="Trip moods">
            {MOODS.map((m) => (
              <button key={m.id} className="tp-mood" aria-pressed={mood === m.id}
                onClick={() => {
                  setState((s) => applyMood(s, m));
                  setMood(m.id);
                  setPicked(null);
                  play("tick");
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </section>

        <section className="tp-prefs-card" aria-label="Your preferences">
          <div className="tp-prefs-head">
            <h2>Your preferences</h2>
            {nClear > 0 && <button className="tp-clear" onClick={() => set(clearFilters(state))}>Clear all</button>}
          </div>
          <TripSettings state={state} set={set} unit={unit} setUnit={setUnit} />
        </section>

        <div className="tp-go">
          <span className="tp-go-count" aria-live="polite">{countText}{loading && trip ? " · updating…" : ""}</span>
          <button className="btn tp-go-btn" onClick={() => onStage("parks")}>Show my parks</button>
        </div>
        {error && <p className="error">Could not load parks: {error}</p>}
      </div>
    );
  }

  return (
    <div className="tp tp-step2">
      <style>{TRIP_CSS}</style>
      <aside className="tp-list" aria-label="Parks">
        <div className="tp-list-head">
          <div>
            <p className="tp-count" aria-live="polite">{countText}{loading && trip ? " · updating…" : ""}</p>
            <span className="small muted">
              {browse
                ? "No filters, so no ranking. Tick parks to compare them."
                : `${monthsText} · ranked for ${HORIZON_LABEL("next_year", trip)}${noWarmth ? ` · comfy ${unit === "F" ? "59–86°F" : "15–30°C"} highs` : ""}`}
            </span>
          </div>
          <button className="tp-act" onClick={() => onStage("prefs")}>Edit preferences</button>
        </div>

        <input type="search" className="tp-search" placeholder="Search a park or state" aria-label="Search a park or state"
          value={find} onChange={(e) => setFind(e.target.value)} />

        {trip && !browse && trip.relax.length > 0 && matches.length < DEFAULT_PICKS && (
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

        {error && <p className="error">Could not load parks: {error}</p>}
        {!trip && !error && <div className="tp-skel" aria-hidden />}
        {trip && find.trim() && !listed.length && <p className="small muted">No park matches “{find.trim()}”.</p>}

        {trip && (
          <ul className="tp-picks" aria-label="Tick parks to see their cards">
            {listed.map((p) => {
              const on = ticks.includes(p.park.id);
              const photo = photoOf(p.park.code);
              return (
                <li key={p.park.id}>
                  <label className={`tp-pick${on ? " on" : ""}${!browse && !p.ok ? " off" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.park.id)} />
                    {!browse && <span className="tp-pick-rank" aria-hidden>{rankOf.get(p.park.id)}</span>}
                    {photo ? <img src={photo.file} alt="" loading="lazy" /> : <span className="tp-pick-ph" />}
                    <span className="tp-pick-name">
                      <b>{p.park.short}</b>
                      <small>
                        {p.park.states.join(", ")}
                        {!browse && (p.ok ? ` · best in ${MONTHS[p.best_month - 1]}` : ` · misses ${p.failed.map((k) => LABEL(k)).join(", ")}`)}
                      </small>
                    </span>
                    {!browse && <ScoreRing score={p.score} size={38} light={false} />}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <div className="tp-cards" aria-live="polite">
        {trip && cards.length === 0 && (
          <p className="tp-empty">Tick a park on the left to see how it looks this year and next year.</p>
        )}
        {cards.map((p) => {
          const w = parkKey(p.park);
          return (
            <Postcard
              key={p.park.id}
              name={p.park.short}
              p={p}
              trip={trip}
              unit={unit}
              horizons={CARD_HORIZONS}
              trend={trendTag(atlas, p.park.id, p.best_month, unit === "F")}
              npsCode={p.park.code}
              onRemove={() => toggle(p.park.id)}
              removeLabel={`Untick ${p.park.short}`}
              actions={
                <>
                  <button className="tp-act" aria-pressed={wish.includes(w)} onClick={() => toggleWish(w)} title="Save to your Saved tab">
                    {wish.includes(w) ? "♥ Saved" : "♡ Want to go"}
                  </button>
                  <button className="tp-act" onClick={() => setOpen(p.park.id)}>Details</button>
                </>
              }
            />
          );
        })}
        <p className="tp-note">
          Scores 0–100 mix your choices: NASA POWER climate (1991–2020 normals, 2005–2024 extras), NASA FIRMS fires (2015–2024)
          and the real trend for next year. Not a weather forecast.
        </p>
      </div>

      {drawerPark && trip && (
        <ParkDrawer p={drawerPark} trip={trip} state={state} unit={unit} science={science} plain={browse} caseFor={caseOf(drawerPark)}
          onClose={() => setOpen(null)} onCase={onCase ? (c) => onCase(c.id) : undefined}
          actions={
            <button className="tp-act" aria-pressed={wish.includes(parkKey(drawerPark.park))} onClick={() => toggleWish(parkKey(drawerPark.park))}>
              {wish.includes(parkKey(drawerPark.park)) ? "♥ Saved" : "♡ Want to go"}
            </button>
          } />
      )}
    </div>
  );
}
