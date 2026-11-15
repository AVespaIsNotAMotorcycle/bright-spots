import { useEffect, useState } from "react";
import FavouriteCity, { type FavouriteCityValue } from "./FavouriteCity";
import RangeSlider from "./RangeSlider";
import { MONTHS, cToF, fToC, inToMm, mmToIn, rangeFromCity, type Prefs } from "./model";

export type Unit = "F" | "C";

// Slider bounds in display units.
const TEMP_RANGE = { F: { min: 20, max: 110, step: 1 }, C: { min: -7, max: 43, step: 0.5 } };
const RAIN_RANGE = { F: { min: 0, max: 12, step: 0.5 }, C: { min: 0, max: 300, step: 10 } };
const DEW_RANGE = { F: { min: 35, max: 80, step: 1 }, C: { min: 2, max: 27, step: 0.5 } };
// PROVISIONAL default when the limit is switched on: 60 °F is a common "starts to
// feel muggy" guideline, not a value from the spec.
const DEW_DEFAULT_F = 60;

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
  const d = DEW_RANGE[unit];
  const rainShown = prefs.rainMax == null ? null : unit === "F" ? mmToIn(prefs.rainMax) : prefs.rainMax;
  const [city, setCity] = useState<FavouriteCityValue | null>(null);
  // A favourite city sets the range from its normal for the travel month, and
  // follows month changes until the user moves the slider.
  useEffect(() => {
    if (!city) return;
    const r = rangeFromCity(city.normals, prefs.month);
    if (r) set({ tLo: r[0], tHi: r[1] });
    // set is recreated each render; city and month are the inputs.
  }, [city, prefs.month]);
  const cityHigh = city?.normals.months[prefs.month - 1]?.tmax;

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
            onChange={(lo, hi) => {
              setCity(null);
              set({ tLo: fromT(lo), tHi: fromT(hi) });
            }}
            labelLow="Lowest comfortable daytime high"
            labelHigh="Highest comfortable daytime high"
            format={(v) => `${unit === "F" ? Math.round(v) : v.toFixed(1)}°${unit}`}
          />
          {city && cityHigh != null ? (
            <p className="small city-note">
              Matched to <strong>{city.name}</strong> in {MONTHS[prefs.month - 1]}: average high{" "}
              {unit === "F" ? `${Math.round(cToF(cityHigh))}°F` : `${cityHigh.toFixed(1)}°C`} (NASA POWER, {city.normals.period}).{" "}
              <button className="link-btn small" onClick={() => setCity(null)}>
                unlink
              </button>
            </p>
          ) : (
            <>
              <span className="micro muted">or match a city you like:</span>
              <FavouriteCity onPick={setCity} />
            </>
          )}
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
          <label className="check pref-title">
            <input
              type="checkbox"
              checked={prefs.dewMax != null}
              onChange={(e) => set({ dewMax: e.target.checked ? fToC(DEW_DEFAULT_F) : null })}
            />
            Limit dew point (mugginess)
          </label>
          {prefs.dewMax != null ? (
            <label className="slider-row">
              <input
                type="range"
                min={d.min}
                max={d.max}
                step={d.step}
                value={Math.round(toT(prefs.dewMax) / d.step) * d.step}
                aria-label="Maximum dew point"
                onChange={(e) => set({ dewMax: fromT(Number(e.target.value)) })}
              />
              <span className="num">
                ≤ {unit === "F" ? `${Math.round(cToF(prefs.dewMax))}°F` : `${prefs.dewMax.toFixed(1)}°C`}
              </span>
            </label>
          ) : (
            <p className="small muted">Dew point doesn't matter.</p>
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
