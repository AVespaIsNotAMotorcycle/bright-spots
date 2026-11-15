// Left panel: when, feel, I'm into, avoid, and more settings.
import { useRef } from "react";
import FavouriteCity from "../FavouriteCity";
import RangeSlider from "../RangeSlider";
import { rangeFromCity } from "../model";
import {
  AVOIDS,
  FEELS,
  MONTHS,
  MONTHS_LONG,
  SEASONS,
  SOURCE_LABEL,
  WANTS,
  nextLevel,
  temp,
  type Chip,
  type Level,
  type TripState,
  type Unit,
} from "./tripModel";

interface Props {
  state: TripState;
  set: (patch: Partial<TripState>) => void;
  unit: Unit;
  setUnit: (u: Unit) => void;
}

/** The next 12 months from today, each with its year, so Dec this year and Dec next year never mix. */
export function nextTwelve(today = new Date()): { m: number; y: number; now: boolean }[] {
  const start = today.getMonth() + 1;
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((start - 1 + i) % 12) + 1;
    return { m, y: today.getFullYear() + (m < start ? 1 : 0), now: i === 0 };
  });
}

function Months({ state, set }: Pick<Props, "state" | "set">) {
  const last = useRef<number | null>(null);
  const pick = (m: number, e: React.MouseEvent) => {
    const on = state.months.includes(m);
    let next: number[];
    if (e.shiftKey && last.current != null) {
      // Shift-click: every month from the last one clicked to this one (wrapping past December).
      next = [...state.months];
      for (let i = last.current; ; i = (i % 12) + 1) {
        if (!next.includes(i)) next.push(i);
        if (i === m) break;
      }
    } else next = on ? state.months.filter((x) => x !== m) : [...state.months, m];
    last.current = m;
    set({ months: next.sort((a, b) => a - b) });
  };
  // Each month's next occurrence, so Dec this year and Feb next year are labelled right.
  const upcoming = new Map(nextTwelve().map((x) => [x.m, x]));
  const exactly = (ms: number[]) => ms.length === state.months.length && ms.every((m) => state.months.includes(m));
  return (
    <section aria-labelledby="tp-when">
      <h3 className="tp-h" id="tp-when">
        When are you going? <small>{state.months.length === 0 ? "any time" : state.months.length > 1 ? "best month wins" : "tap more to compare"}</small>
      </h3>
      {/* One column per season: its button, then its own three months (Dec, Jan, Feb under Winter). */}
      <div className="tp-seasons">
        {SEASONS.map((s) => (
          <div key={s.id} className="tp-season-col" role="group" aria-label={`${s.label} months`}>
            <button className="tp-season" aria-pressed={exactly(s.months)} onClick={() => set({ months: exactly(s.months) ? [] : [...s.months].sort((a, b) => a - b) })}
              title={`Pick all of ${s.label.toLowerCase()}`}>
              {s.label}
            </button>
            {s.months.map((m) => {
              const { y, now } = upcoming.get(m)!;
              return (
                <button key={m} className="tp-month" aria-pressed={state.months.includes(m)} onClick={(e) => pick(m, e)}
                  aria-label={`${MONTHS_LONG[m - 1]} ${y}`} title={`${MONTHS_LONG[m - 1]} ${y}${now ? " (this month)" : ""}`}>
                  {MONTHS[m - 1]}
                  <small className="tp-month-y">{now ? "now" : `'${String(y).slice(2)}`}</small>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {state.months.length === 0 && <p className="tp-note">Any time: each park uses its best month of the year.</p>}
    </section>
  );
}

function Feel({ state, set, unit }: Pick<Props, "state" | "set" | "unit">) {
  return (
    <section aria-labelledby="tp-feel">
      <h3 className="tp-h" id="tp-feel">How warm? <small>daytime high</small></h3>
      <div className="tp-feels">
        {FEELS.map((f) => {
          const on = !state.custom && state.feels.includes(f.id);
          return (
            <button key={f.id} className="tp-feel" aria-pressed={on}
              onClick={() => {
                const has = state.feels.includes(f.id) && !state.custom;
                const feels = state.custom ? [f.id] : has ? state.feels.filter((x) => x !== f.id) : [...state.feels, f.id];
                set({ custom: null, feels });
              }}>
              {f.label}
              <small>{f.id === "cool" ? `< ${temp(f.hi, unit)}` : f.id === "hot" ? `> ${temp(f.lo, unit)}` : `${temp(f.lo, unit)}–${temp(f.hi, unit)}`}</small>
            </button>
          );
        })}
      </div>
      {!state.custom && state.feels.length === 0 && <p className="tp-note">None picked: we rank for comfy highs, {temp(15, unit)} to {temp(30, unit)}.</p>}
      {state.custom && (
        <p className="tp-note">
          Custom: {temp(state.custom[0], unit)} to {temp(state.custom[1], unit)}.{" "}
          <button className="link-btn small" onClick={() => set({ custom: null })}>Use the chips</button>
        </p>
      )}
    </section>
  );
}

function Chips({ title, chips, value, onChange, kind }: {
  title: string; chips: Chip[]; value: Record<string, Level>; onChange: (v: Record<string, Level>) => void; kind: "want" | "avoid";
}) {
  const n = Object.keys(value).length;
  return (
    <section aria-label={title}>
      <h3 className="tp-h">
        {title}
        <small>
          {n ? `${n} on · ` : ""}
          {n > 0 && <button className="link-btn small" onClick={() => onChange({})}>clear</button>}
        </small>
      </h3>
      <div className={`tp-chips ${kind}`}>
        {chips.map((c) => {
          const l = value[c.key];
          return (
            <button key={c.key} className={`tp-chip${l ? ` ${l}` : ""}`} aria-pressed={!!l}
              aria-label={`${c.label}: ${l === "must" ? "must have" : l === "nice" ? "nice to have" : "off"}`}
              title={`${c.hint}\nSource: ${SOURCE_LABEL[c.source]}`}
              onClick={() => {
                const next = { ...value };
                const lv = nextLevel(l);
                if (lv) next[c.key] = lv;
                else delete next[c.key];
                onChange(next);
              }}>
              {c.label}
              {c.source === "estimate" && <span className="tp-src" aria-hidden>est.</span>}
              {l && <span className="lvl">{l === "must" ? kind === "avoid" ? "never" : "must" : kind === "avoid" ? "avoid" : "nice"}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function TripSettings({ state, set, unit, setUnit }: Props) {
  const lo = state.custom?.[0] ?? Math.min(...FEELS.filter((f) => state.feels.includes(f.id)).map((f) => f.lo), 15);
  const hi = state.custom?.[1] ?? Math.max(...FEELS.filter((f) => state.feels.includes(f.id)).map((f) => f.hi), 27);
  return (
    <>
      <Months state={state} set={set} />
      <Feel state={state} set={set} unit={unit} />
      <Chips title="I'm into" kind="want" chips={WANTS} value={state.want} onChange={(want) => set({ want })} />
      <Chips title="Avoid" kind="avoid" chips={AVOIDS} value={state.avoid} onChange={(avoid) => set({ avoid })} />
      <details className="tp-more">
        <summary>More settings</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="tp-h">Exact daytime high</div>
            <RangeSlider
              min={-15} max={42} step={0.5} low={lo} high={hi}
              onChange={(a, b) => set({ custom: [a, b] })}
              labelLow="Lowest ideal high" labelHigh="Highest ideal high"
              format={(v) => temp(v, unit, 0)}
            />
          </div>
          <div>
            <div className="tp-h">Match a city you like</div>
            <FavouriteCity onPick={(v) => {
              const r = rangeFromCity(v.normals, state.months[0] ?? new Date().getMonth() + 1);
              if (r) set({ custom: [Math.round(r[0] * 2) / 2, Math.round(r[1] * 2) / 2] });
            }} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span className="tp-h" style={{ margin: 0 }}>Units</span>
            <div className="tp-seg">
              <button aria-pressed={unit === "F"} onClick={() => setUnit("F")}>°F, mph</button>
              <button aria-pressed={unit === "C"} onClick={() => setUnit("C")}>°C, km/h</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span className="tp-h" style={{ margin: 0 }}>2050 path</span>
            <div className="tp-seg">
              <button aria-pressed={state.scenario === "ssp245"} onClick={() => set({ scenario: "ssp245" })}>Middle</button>
              <button aria-pressed={state.scenario === "ssp585"} onClick={() => set({ scenario: "ssp585" })}>High emissions</button>
            </div>
          </div>
        </div>
      </details>
    </>
  );
}
