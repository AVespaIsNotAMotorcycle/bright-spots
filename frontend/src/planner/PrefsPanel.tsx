import RangeSlider from "./RangeSlider";
import { MONTHS, cToF, fToC, inToMm, mmToIn, type Prefs } from "./model";

export type Unit = "F" | "C";

// Slider bounds in display units.
const TEMP_RANGE = { F: { min: 20, max: 110, step: 1 }, C: { min: -7, max: 43, step: 0.5 } };
const RAIN_RANGE = { F: { min: 0, max: 12, step: 0.5 }, C: { min: 0, max: 300, step: 10 } };

export default function PrefsPanel({
  prefs,
  set,
  unit,
  setUnit,
}: {
  prefs: Prefs;
  set: (patch: Partial<Prefs>) => void;
  unit: Unit;
  setUnit: (u: Unit) => void;
}) {
  const t = TEMP_RANGE[unit];
  const toT = (c: number) => (unit === "F" ? cToF(c) : c);
  const fromT = (v: number) => (unit === "F" ? fToC(v) : v);
  const snap = (v: number) => Math.round(v / t.step) * t.step;
  const r = RAIN_RANGE[unit];
  const rainShown = prefs.rainMax == null ? null : unit === "F" ? mmToIn(prefs.rainMax) : prefs.rainMax;

  return (
    <section className="card prefs-panel" aria-labelledby="prefs-title">
      <header className="row gap-16 wrap prefs-head">
        <h2 id="prefs-title" className="section-title">
          Your preferences
        </h2>
        <div className="row gap-8" role="group" aria-label="Units">
          {(["F", "C"] as Unit[]).map((u) => (
            <button key={u} className={`chip ${unit === u ? "active" : ""}`} aria-pressed={unit === u} onClick={() => setUnit(u)}>
              {u === "F" ? "°F, inches" : "°C, mm"}
            </button>
          ))}
        </div>
      </header>

      <div className="prefs-grid">
        <div className="pref-block">
          <h3 className="pref-title">When are you going?</h3>
          <div className="month-grid" role="radiogroup" aria-label="Travel month">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                role="radio"
                aria-checked={prefs.month === i + 1}
                className={`chip ${prefs.month === i + 1 ? "active" : ""}`}
                onClick={() => set({ month: i + 1 })}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="pref-block">
          <h3 className="pref-title">Ideal daytime high</h3>
          <RangeSlider
            min={t.min}
            max={t.max}
            step={t.step}
            low={snap(toT(prefs.tLo))}
            high={snap(toT(prefs.tHi))}
            onChange={(lo, hi) => set({ tLo: fromT(lo), tHi: fromT(hi) })}
            labelLow="Lowest comfortable daytime high"
            labelHigh="Highest comfortable daytime high"
            format={(v) => `${unit === "F" ? Math.round(v) : v.toFixed(1)}°${unit}`}
          />
        </div>

        <div className="pref-block">
          <label className="check pref-title">
            <input type="checkbox" checked={prefs.rhMax != null} onChange={(e) => set({ rhMax: e.target.checked ? 65 : null })} />
            Limit humidity
          </label>
          {prefs.rhMax != null ? (
            <label className="slider-row">
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={prefs.rhMax}
                aria-label="Maximum humidity"
                onChange={(e) => set({ rhMax: Number(e.target.value) })}
              />
              <span className="num">≤ {prefs.rhMax}%</span>
            </label>
          ) : (
            <p className="small muted">Any humidity is fine.</p>
          )}
        </div>

        <div className="pref-block">
          <label className="check pref-title">
            <input type="checkbox" checked={prefs.rainMax != null} onChange={(e) => set({ rainMax: e.target.checked ? inToMm(3) : null })} />
            Limit rain
          </label>
          {rainShown != null ? (
            <label className="slider-row">
              <input
                type="range"
                min={r.min}
                max={r.max}
                step={r.step}
                value={Math.round(rainShown / r.step) * r.step}
                aria-label="Maximum rain per month"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  set({ rainMax: unit === "F" ? inToMm(v) : v });
                }}
              />
              <span className="num">
                ≤ {unit === "F" ? `${rainShown.toFixed(1)} in` : `${Math.round(rainShown)} mm`} / month
              </span>
            </label>
          ) : (
            <p className="small muted">Rain doesn't matter.</p>
          )}
        </div>

        <div className="pref-block">
          <h3 className="pref-title">Avoid</h3>
          <label className="check">
            <input type="checkbox" checked={prefs.avoidBugs} onChange={(e) => set({ avoidBugs: e.target.checked })} />
            Bugs (mosquitoes, biting flies)
          </label>
        </div>

        <div className="pref-block">
          <h3 className="pref-title">Interested in</h3>
          <label className="check">
            <input type="checkbox" checked={prefs.stars} onChange={(e) => set({ stars: e.target.checked })} />
            Stargazing (clear skies)
          </label>
          <label className="check">
            <input type="checkbox" checked={prefs.snowmelt} onChange={(e) => set({ snowmelt: e.target.checked })} />
            Snowmelt season (waterfalls, wildflower blooms)
          </label>
        </div>
      </div>
    </section>
  );
}
