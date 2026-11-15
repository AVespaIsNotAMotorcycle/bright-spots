import { useEffect, useMemo, useState } from "react";
import LocationPicker from "./LocationPicker";
import { useParkTrendBadge } from "../detective/useParkTrendBadge";
import { HORIZONS, Meter, ParkCard, fmtDistance, horizonTitle } from "./ParkDetails";
import PrefsPanel, { type Unit } from "./PrefsPanel";
import {
  MONTHS,
  distanceKm,
  explainTemp,
  fToC,
  fetchPlan,
  nearestParks,
  prefsSummary,
  popularParks,
  rankParks,
  type HorizonKey,
  type ParkPlan,
  type Place,
  type Plan,
  type Prefs,
} from "./model";

const SUGGEST_N = 5;

// Per-viewer conveniences only; the app works without storage.
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

const DEFAULT_MONTH = ((new Date().getMonth() + 1) % 12) + 1; // next month

function ScenarioChips({ value, onChange }: { value: Prefs["scenario"]; onChange: (s: Prefs["scenario"]) => void }) {
  return (
    <div className="row gap-8 wrap" role="group" aria-label="2050 scenario">
      <span className="micro muted">2050 scenario</span>
      {(
        [
          ["ssp245", "SSP2-4.5 (middle)"],
          ["ssp585", "SSP5-8.5 (high)"],
        ] as const
      ).map(([k, label]) => (
        <button key={k} className={`chip ${value === k ? "active" : ""}`} aria-pressed={value === k} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function TrendPill({ code, unit }: { code: string | null; unit: Unit }) {
  const b = useParkTrendBadge(code);
  if (!b || (b.verdict !== "real" && b.verdict !== "possible")) return null;
  const slope = unit === "F" ? b.slope_f : b.slope_f / 1.8;
  const real = b.verdict === "real";
  return (
    <span
      className={`trend-pill ${real ? "real" : "possible"}`}
      title={`Daytime high trend since 1981: ${real ? "confirmed, very unlikely to be luck" : "possible, not yet confirmed"}`}
    >
      {slope >= 0 ? "▲" : "▼"} {slope > 0 ? "+" : ""}
      {slope.toFixed(1)}°{unit}/decade{real ? "" : "?"}
    </span>
  );
}

function SuggestHead({ plan }: { plan: Plan }) {
  return (
    <div className="suggest-head micro muted" aria-hidden="true">
      {HORIZONS.map((hz) => (
        <span key={hz.key} className="score-col">
          <strong>{horizonTitle(hz.key, plan)}</strong>
          <span>{hz.key === "this_year" ? "measured or typical" : hz.tag.toLowerCase()}</span>
        </span>
      ))}
    </div>
  );
}

function Suggestion({
  p,
  plan,
  sub,
  selected,
  onToggle,
  prefs,
  unit,
}: {
  p: ParkPlan;
  plan: Plan;
  sub: string;
  selected: boolean;
  onToggle: () => void;
  prefs: Prefs;
  unit: Unit;
}) {
  const why = explainTemp(p.this_year.values.tmax, prefs.tLo, prefs.tHi, unit);
  const states = p.park.states.join(", ");
  return (
    <li>
      <label className={`suggestion ${selected ? "selected" : ""}`}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <span className="suggestion-main">
          <span className="suggestion-name">
            {p.park.short} <TrendPill code={p.park.code} unit={unit} />
          </span>
          <span className="suggestion-sub" title={`${states} · ${sub}`}>
            {states} · {sub}
          </span>
          {why && <span className={`suggestion-why ${why.tone}`}>{why.text}</span>}
        </span>
        <span className="suggestion-scores num">
          {HORIZONS.map((hz) => {
            const h = p[hz.key];
            const range = h.score != null && h.low != null && h.high != null && Math.round(h.low) !== Math.round(h.high);
            return (
              <span
                key={hz.key}
                className="score-col"
                title={`${horizonTitle(hz.key, plan)} ${hz.tag.toLowerCase()} score${range ? `, range ${Math.round(h.low!)}–${Math.round(h.high!)}` : ""}`}
              >
                <span className="score-num">{h.score == null ? "–" : Math.round(h.score)}</span>
                {range && hz.key !== "this_year" && (
                  <span className="score-range">
                    {Math.round(h.low!)}–{Math.round(h.high!)}
                  </span>
                )}
              </span>
            );
          })}
        </span>
      </label>
    </li>
  );
}

export default function Planner({ onViewTrend, initialMonth }: { onViewTrend?: (parkCode: string) => void; initialMonth?: number }) {
  const [unit, setUnit] = useState<Unit>(() => load("planner.unit", "F" as Unit));
  const [prefs, setPrefs] = useState<Prefs>({
    month: initialMonth ?? DEFAULT_MONTH,
    tLo: fToC(65),
    tHi: fToC(82),
    rhMax: null,
    rainMax: null,
    avoidBugs: false,
    stars: false,
    snowmelt: false,
    scenario: "ssp245",
  });
  const [place, setPlace] = useState<Place | null>(() => load<Place | null>("planner.place", null));
  const [selected, setSelected] = useState<string[]>(() => load<string[]>("planner.selected", []));
  const [rankBy, setRankBy] = useState<HorizonKey>("next_year");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => save("planner.unit", unit), [unit]);
  useEffect(() => save("planner.place", place), [place]);
  useEffect(() => save("planner.selected", selected), [selected]);

  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetchPlan(prefs, ctl.signal)
        .then((p) => {
          setPlan(p);
          setError(null);
        })
        .catch((e) => {
          if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => !ctl.signal.aborted && setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [prefs]);

  const set = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const near = useMemo(() => (plan && place ? nearestParks(plan.parks, place, SUGGEST_N) : []), [plan, place]);
  const popular = useMemo(
    () => (plan ? popularParks(plan.parks, SUGGEST_N, new Set(near.map((p) => p.park.id))) : []),
    [plan, near],
  );
  const ranked = useMemo(() => (plan ? rankParks(plan.parks, rankBy) : []), [plan, rankBy]);
  const byId = useMemo(() => new Map(plan?.parks.map((p) => [p.park.id, p]) ?? []), [plan]);
  const chosen = selected.map((id) => byId.get(id)).filter((p): p is ParkPlan => p != null);

  return (
    <div className="planner">
      <PrefsPanel prefs={prefs} set={set} unit={unit} setUnit={setUnit} />

      {error && <p className="error">Could not load the plan: {error}</p>}

      <section className="card" aria-labelledby="pick-title">
        <header className="row gap-16 wrap pick-head">
          <h2 id="pick-title" className="section-title">
            Pick parks to compare
          </h2>
          <span className="small muted">{loading ? "Updating…" : ""}</span>
        </header>
        <p className="score-explainer small">
          <strong>What the number means.</strong> Each park gets a <strong>match score from 0 to 100</strong> for a trip in{" "}
          <strong>{MONTHS[prefs.month - 1]}</strong>, based on what you picked above: {prefsSummary(prefs, unit).join(", ")}.
          100 means the park fits all of it, 0 means it fits none. Use it to compare parks and choose which to look at
          closely. It is not a quality rating. Tick parks to compare them below.
        </p>
        <LocationPicker place={place} onPlace={setPlace} />
        {plan && (
          <div className="suggest-grid">
            <div>
              <h3 className="pref-title">Near you</h3>
              {place ? (
                <>
                <SuggestHead plan={plan} />
                <ul className="suggest-list">
                  {near.map((p) => (
                    <Suggestion
                      key={p.park.id}
                      p={p}
                      plan={plan}
                      sub={fmtDistance(distanceKm(place, p.park), unit)}
                      selected={selected.includes(p.park.id)}
                      onToggle={() => toggle(p.park.id)}
                      prefs={prefs}
                      unit={unit}
                    />
                  ))}
                </ul>
                </>
              ) : (
                <p className="small muted">Share a location or search for a place to see the five closest parks.</p>
              )}
            </div>
            <div>
              <h3 className="pref-title">Most visited nationwide</h3>
              <SuggestHead plan={plan} />
              <ul className="suggest-list">
                {popular.map((p) => (
                  <Suggestion
                    key={p.park.id}
                    p={p}
                    plan={plan}
                    sub={`${((p.park.visitors_2025 ?? 0) / 1e6).toFixed(1)}M visitors in 2025`}
                    selected={selected.includes(p.park.id)}
                    onToggle={() => toggle(p.park.id)}
                    prefs={prefs}
                    unit={unit}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {plan && (
        <section aria-labelledby="cards-title" className="cards-section">
          <header className="row gap-16 wrap cards-head">
            <h2 id="cards-title" className="section-title">
              Your parks{chosen.length ? ` (${chosen.length})` : ""}
            </h2>
            <ScenarioChips value={prefs.scenario} onChange={(s) => set({ scenario: s })} />
            {chosen.length > 0 && (
              <button className="link-btn small" onClick={() => setSelected([])}>
                Clear all
              </button>
            )}
          </header>
          {chosen.length === 0 ? (
            <p className="small muted empty-cards">Select parks above, or from the full list below, to see a detailed card for each.</p>
          ) : (
            <div className="card-grid">
              {chosen.map((p) => (
                <ParkCard key={p.park.id} p={p} plan={plan} unit={unit} place={place} onRemove={() => toggle(p.park.id)} onViewTrend={onViewTrend} />
              ))}
            </div>
          )}
        </section>
      )}

      {plan && (
        <details className="card all-parks">
          <summary className="section-title">All {plan.parks.length} parks, ranked</summary>
          <div className="row gap-16 wrap results-bar">
            <div className="row gap-8 wrap" role="group" aria-label="Rank by">
              <span className="micro muted">Rank by</span>
              {HORIZONS.map((hz) => (
                <button key={hz.key} className={`chip ${rankBy === hz.key ? "active" : ""}`} aria-pressed={rankBy === hz.key} onClick={() => setRankBy(hz.key)}>
                  {horizonTitle(hz.key, plan)}
                </button>
              ))}
            </div>
            <ScenarioChips value={prefs.scenario} onChange={(s) => set({ scenario: s })} />
          </div>
          <div className="park-row park-head micro muted" aria-hidden="true">
            <span>#</span>
            <span>Park · {MONTHS[plan.month - 1]}</span>
            {HORIZONS.map((hz) => (
              <span key={hz.key}>
                {horizonTitle(hz.key, plan)} <span className={`tag ${hz.tagClass}`}>{hz.tag}</span>
              </span>
            ))}
          </div>
          <ol className="park-list">
            {ranked.map((p, i) => (
              <li key={p.park.id}>
                <label className={`park-row ${selected.includes(p.park.id) ? "selected" : ""}`}>
                  <span className="num muted">{i + 1}</span>
                  <span className="park-name">
                    <input type="checkbox" checked={selected.includes(p.park.id)} onChange={() => toggle(p.park.id)} /> {p.park.short}
                    <span className="micro muted"> {p.park.states.join(", ")}</span>
                  </span>
                  {HORIZONS.map((hz) => (
                    <Meter key={hz.key} h={p[hz.key]} label={horizonTitle(hz.key, plan)} />
                  ))}
                </label>
              </li>
            ))}
          </ol>
        </details>
      )}

      <footer className="micro muted sources">
        Scores are 0–100: the mean of the factor scores you turned on for the chosen month. {plan?.this_year ?? "This year"}: NASA
        POWER monthly values where already measured, otherwise the 1991–2020 normal (marked). {plan?.next_year ?? "Next year"}: that
        month's 1991-onward trend extended one year, range = year-to-year scatter; not a weather forecast. 2050: WorldClim 2.1
        CMIP6 downscaled 2041–2060, six models, range across models; temperature and rain only. Bugs are a weather-based
        estimate. NASA POWER cells are about 50 km wide, so mountain and canyon parks (for example Great Smoky Mountains and
        Grand Canyon) can read warmer than their visitor areas. Park list and 2025 visitors: Wikipedia (CC BY-SA 4.0). Place search: OpenStreetMap Nominatim.
      </footer>
    </div>
  );
}
