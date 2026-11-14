import { useEffect, useMemo, useState } from "react";
import {
  FACTOR_LABEL,
  MONTHS,
  cToF,
  fToC,
  fetchPlan,
  inToMm,
  mmToIn,
  rankParks,
  type FactorKey,
  type Horizon,
  type HorizonKey,
  type ParkPlan,
  type Plan,
  type Prefs,
} from "./model";

type Unit = "F" | "C";

const HORIZONS: { key: HorizonKey; tag: string; tagClass: string }[] = [
  { key: "this_year", tag: "Measured", tagClass: "tag-measured" },
  { key: "next_year", tag: "Forecast", tagClass: "tag-forecast" },
  { key: "y2050", tag: "Projected", tagClass: "tag-projected" },
];

function horizonTitle(key: HorizonKey, plan: Plan | null): string {
  if (key === "this_year") return plan ? String(plan.this_year) : "This year";
  if (key === "next_year") return plan ? String(plan.next_year) : "Next year";
  return "2050";
}

function Meter({ h, label }: { h: Horizon; label: string }) {
  const tag = <span className="micro muted meter-label">{label}</span>;
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

function Details({ p, plan, unit }: { p: ParkPlan; plan: Plan; unit: Unit }) {
  const factorKeys = Object.keys(p.this_year.factors) as FactorKey[];
  return (
    <div className="details">
      <div className="table-wrap">
        <table className="detail-table">
          <thead>
            <tr>
              <th />
              {HORIZONS.map((hz) => (
                <th key={hz.key}>
                  {horizonTitle(hz.key, plan)} <span className={`tag ${hz.tagClass}`}>{hz.tag}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Daytime high</th>
              {HORIZONS.map((hz) => (
                <td key={hz.key} className="num">
                  {fmtTemp(p[hz.key].values.tmax, unit)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Humidity</th>
              {HORIZONS.map((hz) => (
                <td key={hz.key} className="num">
                  {p[hz.key].values.rh != null ? `${Math.round(p[hz.key].values.rh!)}%` : "–"}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Rain (month)</th>
              {HORIZONS.map((hz) => {
                const mm = p[hz.key].values.precip;
                return (
                  <td key={hz.key} className="num">
                    {mm == null ? "–" : unit === "F" ? `${mmToIn(mm).toFixed(1)} in` : `${Math.round(mm)} mm`}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row">Cloud cover</th>
              {HORIZONS.map((hz) => (
                <td key={hz.key} className="num">
                  {p[hz.key].values.cloud != null ? `${Math.round(p[hz.key].values.cloud!)}%` : "–"}
                </td>
              ))}
            </tr>
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
      <p className="micro muted">
        {p.park.name} · {p.park.states.join(", ")} · {p.park.lat}°, {p.park.lon}°
        {p.park.visitors_2025 != null && ` · ${p.park.visitors_2025.toLocaleString()} visitors in 2025`}
        {p.park.code && (
          <>
            {" · "}
            <a href={`https://www.nps.gov/${p.park.code}/`} target="_blank" rel="noreferrer">
              nps.gov
            </a>
          </>
        )}
      </p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix: string;
}) {
  return (
    <label className="field">
      <span className="micro muted">{label}</span>
      <span className="row gap-8">
        <input
          type="number"
          value={Number(value.toFixed(1))}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
        />
        <span className="small muted">{suffix}</span>
      </span>
    </label>
  );
}

const DEFAULT_MONTH = ((new Date().getMonth() + 1) % 12) + 1; // next month

export default function Planner() {
  const [unit, setUnit] = useState<Unit>("F");
  const [prefs, setPrefs] = useState<Prefs>({
    month: DEFAULT_MONTH,
    tLo: fToC(65),
    tHi: fToC(82),
    rhMax: null,
    rainMax: null,
    avoidBugs: false,
    stars: false,
    snowmelt: false,
    scenario: "ssp245",
  });
  const [rankBy, setRankBy] = useState<HorizonKey>("next_year");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

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

  const ranked = useMemo(() => (plan ? rankParks(plan.parks, rankBy) : []), [plan, rankBy]);
  const set = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const toUnit = (c: number) => (unit === "F" ? cToF(c) : c);
  const fromUnit = (v: number) => (unit === "F" ? fToC(v) : v);

  return (
    <div className="planner">
      <section className="card prefs" aria-label="Your preferences">
        <div className="row gap-16 wrap">
          <label className="field">
            <span className="micro muted">Travel month</span>
            <select value={prefs.month} onChange={(e) => set({ month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Ideal daytime high, from"
            value={toUnit(prefs.tLo)}
            onChange={(v) => set({ tLo: fromUnit(v) })}
            min={unit === "F" ? -20 : -30}
            max={unit === "F" ? 115 : 46}
            suffix={`°${unit}`}
          />
          <NumberField
            label="to"
            value={toUnit(prefs.tHi)}
            onChange={(v) => set({ tHi: fromUnit(v) })}
            min={unit === "F" ? -20 : -30}
            max={unit === "F" ? 115 : 46}
            suffix={`°${unit}`}
          />
          <div className="field">
            <span className="micro muted">Units</span>
            <span className="row gap-8">
              {(["F", "C"] as Unit[]).map((u) => (
                <button key={u} className={`chip ${unit === u ? "active" : ""}`} aria-pressed={unit === u} onClick={() => setUnit(u)}>
                  °{u}
                </button>
              ))}
            </span>
          </div>
        </div>

        <div className="row gap-16 wrap">
          <label className="check">
            <input type="checkbox" checked={prefs.rhMax != null} onChange={(e) => set({ rhMax: e.target.checked ? 65 : null })} />
            Limit humidity
          </label>
          {prefs.rhMax != null && (
            <NumberField label="Max humidity" value={prefs.rhMax} onChange={(v) => set({ rhMax: Math.min(100, Math.max(0, v)) })} min={0} max={100} suffix="%" />
          )}
          <label className="check">
            <input type="checkbox" checked={prefs.rainMax != null} onChange={(e) => set({ rainMax: e.target.checked ? inToMm(3) : null })} />
            Limit rain
          </label>
          {prefs.rainMax != null && (
            <NumberField
              label="Max rain per month"
              value={unit === "F" ? mmToIn(prefs.rainMax) : prefs.rainMax}
              onChange={(v) => set({ rainMax: Math.max(0, unit === "F" ? inToMm(v) : v) })}
              min={0}
              max={unit === "F" ? 30 : 750}
              step={unit === "F" ? 0.5 : 10}
              suffix={unit === "F" ? "in" : "mm"}
            />
          )}
          <label className="check">
            <input type="checkbox" checked={prefs.avoidBugs} onChange={(e) => set({ avoidBugs: e.target.checked })} />
            Avoid bugs
          </label>
        </div>

        <div className="row gap-16 wrap">
          <span className="micro muted">Interested in</span>
          <label className="check">
            <input type="checkbox" checked={prefs.stars} onChange={(e) => set({ stars: e.target.checked })} />
            Stargazing (clear skies)
          </label>
          <label className="check">
            <input type="checkbox" checked={prefs.snowmelt} onChange={(e) => set({ snowmelt: e.target.checked })} />
            Snowmelt season (waterfalls, wildflower blooms)
          </label>
        </div>
      </section>

      <div className="row gap-16 wrap results-bar">
        <div className="row gap-8 wrap" role="group" aria-label="Rank by">
          <span className="micro muted">Rank by</span>
          {HORIZONS.map((hz) => (
            <button key={hz.key} className={`chip ${rankBy === hz.key ? "active" : ""}`} aria-pressed={rankBy === hz.key} onClick={() => setRankBy(hz.key)}>
              {horizonTitle(hz.key, plan)}
            </button>
          ))}
        </div>
        <div className="row gap-8 wrap" role="group" aria-label="2050 scenario">
          <span className="micro muted">2050 scenario</span>
          {(
            [
              ["ssp245", "SSP2-4.5 (middle)"],
              ["ssp585", "SSP5-8.5 (high)"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={`chip ${prefs.scenario === k ? "active" : ""}`} aria-pressed={prefs.scenario === k} onClick={() => set({ scenario: k })}>
              {label}
            </button>
          ))}
        </div>
        {loading && <span className="small muted">Updating…</span>}
      </div>

      {error && <p className="error">Could not load the plan: {error}</p>}

      {plan && (
        <section className="card" aria-label="Parks ranked">
          <header className="park-row park-head micro muted">
            <span>#</span>
            <span>Park · {MONTHS[plan.month - 1]}</span>
            {HORIZONS.map((hz) => (
              <span key={hz.key}>
                {horizonTitle(hz.key, plan)} <span className={`tag ${hz.tagClass}`}>{hz.tag}</span>
              </span>
            ))}
          </header>
          <ol className="park-list">
            {ranked.map((p, i) => {
              const isOpen = open === p.park.id;
              return (
                <li key={p.park.id}>
                  <button className="park-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.park.id)}>
                    <span className="num muted">{i + 1}</span>
                    <span className="park-name">
                      {p.park.short}
                      <span className="micro muted"> {p.park.states.join(", ")}</span>
                    </span>
                    {HORIZONS.map((hz) => (
                      <Meter key={hz.key} h={p[hz.key]} label={horizonTitle(hz.key, plan)} />
                    ))}
                  </button>
                  {isOpen && <Details p={p} plan={plan} unit={unit} />}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <footer className="micro muted sources">
        Scores are 0–100: the mean of the factor scores you turned on for the chosen month. {plan?.this_year ?? "This year"}: NASA
        POWER monthly values where already measured, otherwise the 1991–2020 normal (marked). {plan?.next_year ?? "Next year"}: that
        month's 1991-onward trend extended one year, range = year-to-year scatter; not a weather forecast. 2050: WorldClim 2.1
        CMIP6 downscaled 2041–2060, six models, range across models; temperature and rain only. Bugs are a weather-based
        estimate. Park list: Wikipedia (CC BY-SA 4.0).
      </footer>
    </div>
  );
}
