// Design-system sandbox: every specimen uses the app's real classes from styles.css, so this page
// shows the current state. Postcard pieces come from postcard.css (proposed). The token editor
// overrides :root custom properties inline; nothing is written back to the source files.
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { FAMILY_COLORS, VERDICT_COLOR } from "../research/lib";
import { OFF_TOKEN, TOKEN_GROUPS } from "./tokens";
import { HORIZONS, fmtDistance, fmtRain, fmtTemp, horizonTitle, pct } from "../planner/ParkDetails";
import { FACTOR_LABEL, MONTHS, distanceKm, type FactorKey, type Horizon, type HorizonKey, type ParkPlan, type Place, type Plan } from "../planner/model";
import type { Unit } from "../planner/PrefsPanel";
import type { TrendBadge } from "../detective/useParkTrendBadge";

const STORE_KEY = "ds-sandbox-overrides";
const ALL_TOKENS = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name));

/** Authored :root values (keeps `var(--pine)` aliases intact, unlike getComputedStyle). */
function readAuthored(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin (Google Fonts)
    }
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule && r.selectorText === ":root") {
        for (const name of ALL_TOKENS) {
          const v = r.style.getPropertyValue(name).trim();
          if (v) out[name] = v;
        }
      }
    }
  }
  return out;
}

function loadOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

const HEX6 = /^#[0-9a-f]{6}$/i;

function resolvedHex(name: string): string | null {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return HEX6.test(v) ? v : null;
}

// ─────────────────────────────── Token editor ───────────────────────────────

function TokenEditor() {
  const authored = useMemo(readAuthored, []);
  const [overrides, setOverrides] = useState<Record<string, string>>(loadOverrides);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    const root = document.documentElement.style;
    for (const name of ALL_TOKENS) {
      if (overrides[name]) root.setProperty(name, overrides[name]);
      else root.removeProperty(name);
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(overrides));
    } catch {
      /* private mode: edits just won't persist */
    }
  }, [overrides]);

  const set = (name: string, value: string) =>
    setOverrides((o) => {
      const next = { ...o };
      if (!value || value === authored[name]) delete next[name];
      else next[name] = value;
      return next;
    });

  const changed = Object.keys(overrides);
  const css = `:root {\n${changed.map((n) => `  ${n}: ${overrides[n]};`).join("\n")}\n}`;

  return (
    <aside className="card ds-editor" aria-label="Token editor">
      <div className="row gap-8" style={{ justifyContent: "space-between" }}>
        <p className="section-title">Token editor</p>
        <span className="micro muted">{changed.length} changed</span>
      </div>
      <p className="micro muted" style={{ margin: "6px 0 0" }}>
        Edits apply live to this page and are saved in this browser only. styles.css is never touched;
        copy the changed block out when you like it.
      </p>
      <div className="row gap-8 wrap" style={{ marginTop: 10 }}>
        <button className="btn" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setShowExport((s) => !s)} disabled={!changed.length}>
          {showExport ? "Hide CSS" : "Show changed CSS"}
        </button>
        <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => setOverrides({})} disabled={!changed.length}>
          Reset all
        </button>
      </div>
      {showExport && changed.length > 0 && (
        <>
          <pre className="ds-export">{css}</pre>
          <button className="link-btn" onClick={() => navigator.clipboard?.writeText(css)}>Copy to clipboard</button>
        </>
      )}

      {TOKEN_GROUPS.map((g) => (
        <div key={g.title}>
          <h3>{g.title}</h3>
          {g.note && <p className="micro muted" style={{ margin: "0 0 4px" }}>{g.note}</p>}
          {g.tokens.map((t) => {
            const value = overrides[t.name] ?? authored[t.name] ?? "";
            const hex = HEX6.test(value) ? value : resolvedHex(t.name);
            const isColorish = !t.name.includes("shadow") && !t.name.includes("font") && !t.name.includes("radius") && !t.name.includes("edge");
            return (
              <div key={t.name} className={`ds-token${overrides[t.name] ? " changed" : ""}`}>
                {isColorish && hex && !value.startsWith("rgba") ? (
                  <input type="color" value={hex} onChange={(e) => set(t.name, e.target.value)} aria-label={`${t.name} colour`} />
                ) : (
                  <span className="ds-nocolor" style={isColorish ? { background: `var(${t.name})` } : undefined} />
                )}
                <input type="text" value={value} onChange={(e) => set(t.name, e.target.value)} aria-label={t.name} spellCheck={false} />
                <span className="ds-token-name">
                  <code className="micro">{t.name}</code>
                  {overrides[t.name] && (
                    <button className="link-btn micro" onClick={() => set(t.name, "")}>reset</button>
                  )}
                </span>
                {t.note && <span className="micro muted" style={{ gridColumn: 2 }}>{t.note}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

// ─────────────────────────────── Helpers ───────────────────────────────

function Section({ id, title, kicker, proposed, intro, children }: {
  id: string; title: string; kicker: string; proposed?: boolean; intro?: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} className="ds-section">
      <header>
        <div className="row gap-8">
          <p className="section-title">{kicker}</p>
          {proposed && <span className="ds-proposed">Proposed · postcard.css</span>}
        </div>
        <h2 className="headline">{title}</h2>
        {intro && <p className="small muted">{intro}</p>}
      </header>
      {children}
    </section>
  );
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ds-specimen">
      <span className="ds-label">{label}</span>
      <div className="ds-specimen-row">{children}</div>
    </div>
  );
}

function Swatch({ name, value, note }: { name: string; value?: string; note?: string }) {
  return (
    <div className="ds-swatch">
      <div className="ds-swatch-chip" style={{ background: value ?? `var(${name})` }} />
      <div className="ds-swatch-meta">
        <code>{name}</code>
        {note && <span className="micro muted">{note}</span>}
      </div>
    </div>
  );
}

/** Inline badge exactly as ExplainerCard draws verdicts today. */
function VerdictBadge({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color }}>
      {children}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, marginRight: 6 }} />;
}

// ─────────────────────────────── Postcard parts ───────────────────────────────

type Mood = "dawn" | "forest" | "night";

const MOODS: Record<Mood, { skyTop: string; skyBottom: string; far: string; mid: string; near: string; sun: string }> = {
  dawn:   { skyTop: "var(--rust)", skyBottom: "var(--surface-3)", far: "var(--text-faint)", mid: "var(--rust)", near: "var(--pine)", sun: "var(--surface)" },
  forest: { skyTop: "var(--sky)", skyBottom: "var(--surface-2)", far: "var(--pine-light)", mid: "var(--pine)", near: "var(--text)", sun: "var(--surface)" },
  night:  { skyTop: "var(--text)", skyBottom: "var(--sky)", far: "var(--sky)", mid: "var(--pine)", near: "var(--text)", sun: "var(--surface-3)" },
};

/** An illustrated park scene drawn only from palette tokens, so it re-themes with them. */
function Scene({ mood = "dawn", crop = "xMidYMid" }: { mood?: Mood; crop?: string }) {
  const id = useId();
  const m = MOODS[mood];
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio={`${crop} slice`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: m.skyTop }} />
          <stop offset="1" style={{ stopColor: m.skyBottom }} />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill={`url(#${id}-sky)`} />
      {mood === "night" &&
        [[30, 30], [80, 18], [140, 40], [200, 22], [250, 50], [270, 15], [110, 60]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" style={{ fill: "var(--surface)" }} />
        ))}
      <circle cx="242" cy="44" r="20" style={{ fill: m.sun, opacity: 0.9 }} />
      <path d="M0 130 L45 82 L80 112 L130 60 L175 108 L220 74 L260 104 L300 80 V200 H0 Z" style={{ fill: m.far, opacity: 0.55 }} />
      <path d="M0 150 L60 108 L105 140 L150 100 L205 145 L250 118 L300 140 V200 H0 Z" style={{ fill: m.mid }} />
      <path d="M0 200 V165 Q75 145 150 170 T300 160 V200 Z" style={{ fill: m.near }} />
      {[20, 38, 250, 268, 285].map((x, i) => (
        <path key={x} d={`M${x} ${172 - (i % 2) * 6} l-7 18 h14 Z M${x} ${162 - (i % 2) * 6} l-6 15 h12 Z`} style={{ fill: m.near }} />
      ))}
    </svg>
  );
}

/** Value rows paired with the factor score that rates them; bugs and snowmelt have no value. */
const PC_ROWS: { label: string; value?: (h: Horizon, unit: Unit) => string; factor: FactorKey }[] = [
  { label: "Daytime high", value: (h, u) => fmtTemp(h.values.tmax, u), factor: "temperature" },
  { label: "Humidity", value: (h) => pct(h.values.rh), factor: "humidity" },
  { label: "Rain (month)", value: (h, u) => fmtRain(h.values.precip, u), factor: "rain" },
  { label: "Cloud cover", value: (h) => pct(h.values.cloud), factor: "stars" },
  { label: FACTOR_LABEL.bugs, factor: "bugs" },
  { label: FACTOR_LABEL.snowmelt, factor: "snowmelt" },
];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** What each horizon's score range is made of (from SPEC: scoring). */
const RANGE_NOTE: Record<HorizonKey, string> = {
  this_year: "Measured, so there is one score and no range",
  next_year: "Scores at the low and high ends of the forecast window",
  y2050: "Scores across the six climate models",
};

/** Map location marker. */
function PinIcon() {
  return (
    <svg className="pc-pin" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M8 1.2a4.8 4.8 0 0 0-4.8 4.8c0 3.6 4.8 8.8 4.8 8.8s4.8-5.2 4.8-8.8A4.8 4.8 0 0 0 8 1.2Z" fill="currentColor" />
      <circle cx="8" cy="6" r="1.8" fill="var(--pc-paper)" />
    </svg>
  );
}

/** The one-sided postcard: park photo on the left, the full park card on the right. */
function Postcard({ p, plan, unit, place, trend, mood = "dawn", onRemove, onViewTrend }: {
  p: ParkPlan; plan: Plan; unit: Unit; place: Place | null; trend?: TrendBadge | null; mood?: Mood;
  onRemove?: () => void; onViewTrend?: () => void;
}) {
  const rows = PC_ROWS.filter((r) => r.value || r.factor in p.this_year.factors);
  const month = MONTHS[plan.month - 1];
  return (
    <div className="postcard-wrap">
      <article className="postcard" aria-labelledby={`pc-${p.park.id}`}>
        <div className="pc-photo"><Scene mood={mood} crop="xMaxYMid" /></div>
        <div className="pc-info">
          <header className="pc-head">
            <div>
              <h3 id={`pc-${p.park.id}`} className="park-card-title">{p.park.name}</h3>
              <p className="micro muted pc-meta">
                <span>{p.park.states.join(", ")}</span>
                {place && (
                  <span title={`Distance from ${place.name}`}>
                    <PinIcon />{fmtDistance(distanceKm(place, p.park), unit)}
                  </span>
                )}
                {p.park.visitors_2025 != null && <span>{compact.format(p.park.visitors_2025)} visitors in 2025</span>}
              </p>
            </div>
            {onRemove && <button type="button" className="pc-remove" onClick={onRemove} aria-label={`Remove ${p.park.short}`}>×</button>}
          </header>

          {trend && (trend.verdict === "real" || trend.verdict === "possible") && (
            <div className="pc-trend">
              <span className={`trend-pill ${trend.verdict}`}>
                Warming {trend.slope_f > 0 ? "+" : ""}{trend.slope_f.toFixed(2)}°F/decade · {trend.verdict === "real" ? "Real, not luck" : "Possible trend"}
              </span>
              {onViewTrend && <button type="button" className="link-btn micro" onClick={onViewTrend}>See trend →</button>}
            </div>
          )}

          <table className="pc-table">
            <colgroup><col className="pc-label-col" /><col /><col /><col /></colgroup>
            <thead>
              <tr>
                <td />
                {HORIZONS.map((hz) => (
                  <th key={hz.key} scope="col">
                    <span className="pc-year">{month} {horizonTitle(hz.key, plan)}</span>
                    <span className={`tag ${hz.tagClass}`}>{hz.tag}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="pc-score-row">
                <th scope="row">Match score</th>
                {HORIZONS.map((hz) => {
                  const h = p[hz.key];
                  const lo = h.low ?? h.score, hi = h.high ?? h.score;
                  const ranged = h.score != null && lo != null && hi != null && lo !== hi;
                  return (
                    <td key={hz.key} className="num">
                      <span className="big-score">{h.score == null ? "n/a" : Math.round(h.score)}</span>
                      {h.score != null && (
                        <div className="meter-track">
                          {ranged && <div className="meter-range" style={{ left: `${lo}%`, width: `${hi! - lo!}%` }} />}
                          <div className="meter-dot" style={{ left: `${h.score}%` }} />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th scope="row">Score range</th>
                {HORIZONS.map((hz) => {
                  const h = p[hz.key];
                  const lo = h.low ?? h.score, hi = h.high ?? h.score;
                  const ranged = h.score != null && lo != null && hi != null && lo !== hi;
                  return (
                    <td key={hz.key} className="num" title={RANGE_NOTE[hz.key]}>
                      {ranged ? `${Math.round(lo!)}–${Math.round(hi!)}` : "–"}
                    </td>
                  );
                })}
              </tr>
              {rows.map((r) => (
                <tr key={r.factor}>
                  <th scope="row">{r.label}</th>
                  {HORIZONS.map((hz) => {
                    const h = p[hz.key];
                    const f = h.factors[r.factor];
                    const score = f == null ? null : Math.round(f * 100);
                    return (
                      <td key={hz.key} className="num" title={score == null ? undefined : `${FACTOR_LABEL[r.factor]}: fits your preferences ${score}/100`}>
                        {r.value ? r.value(h, unit) : score == null ? "–" : `${score}/100`}
                        {score != null && <span className="pc-bar" aria-hidden="true"><span style={{ width: `${score}%` }} /></span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="micro muted pc-foot">
            <span className="pc-key"><span className="pc-bar" aria-hidden="true"><span style={{ width: "70%" }} /></span>Fit to your preferences</span>
            {p.park.code && <a href={`https://www.nps.gov/${p.park.code}/`} target="_blank" rel="noreferrer">{p.park.short} on nps.gov →</a>}
          </p>
        </div>
      </article>
    </div>
  );
}

// Sample data in the planner's own shape (metric, like the API), for layout only.
// A measured year has no range (low = high = score); the other two do.
const SAMPLE_PLAN: Plan = { month: 11, this_year: 2026, next_year: 2027, scenario: "ssp245", parks: [] };
const SAMPLE_PLACE: Place = { name: "Los Angeles, CA", lat: 34.05, lon: -118.24 };
function sampleHorizon(score: number, low: number, high: number, values: Horizon["values"], factors: Horizon["factors"]): Horizon {
  return { score, low, high, values, factors, notes: [] };
}
const SAMPLE_PARK: ParkPlan = {
  park: { id: "jotr", code: "jotr", name: "Joshua Tree National Park", short: "Joshua Tree", states: ["CA"], lat: 33.87, lon: -115.9, visitors_2025: 3_000_000 },
  this_year: sampleHorizon(82, 82, 82, { tmax: 21.7, rh: 24, precip: 10, cloud: 12 }, { temperature: 0.92, humidity: 0.95, rain: 0.97, stars: 0.9, bugs: 0.85 }),
  next_year: sampleHorizon(74, 61, 85, { tmax: 22.8, rh: 26, precip: 13, cloud: 14 }, { temperature: 0.86, humidity: 0.93, rain: 0.94, stars: 0.86, bugs: 0.8 }),
  y2050: sampleHorizon(69, 50, 83, { tmax: 24.4, rh: 25, precip: 8, cloud: 12 }, { temperature: 0.74, humidity: 0.94, rain: 0.98, stars: 0.9, bugs: 0.72 }),
};
const SAMPLE_TREND: TrendBadge = { slope_f: 0.48, verdict: "real" };

// ─────────────────────────────── Page ───────────────────────────────

const TOC: [string, string][] = [
  ["colour", "Colour"], ["type", "Type"], ["shape", "Shape & space"], ["buttons", "Buttons"],
  ["forms", "Forms"], ["badges", "Badges"], ["data", "Data display"], ["feedback", "Feedback"],
  ["cards", "Cards"], ["postcard", "Postcard"],
];

const TYPE_SCALE: { label: string; spec: string; el: ReactNode }[] = [
  { label: "Landing h1 (inline)", spec: "display 30 / 1.1 · pine", el: <span style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--pine)", lineHeight: 1.1, fontWeight: 800 }}>Park Trend Detective</span> },
  { label: ".big-score", spec: "body 700 30 / 1.1", el: <span className="big-score num">82 <span className="small muted">76–88</span></span> },
  { label: ".title", spec: "display 800 26 / 1.1 · pine", el: <h1 className="title">Park Trend Detective</h1> },
  { label: ".stat-value", spec: "body 700 24 · pine", el: <span className="stat-value num">+0.48°F</span> },
  { label: ".headline", spec: "display 700 20 / 1.2", el: <h2 className="headline">Is Yosemite getting warmer?</h2> },
  { label: ".park-card-title", spec: "display 700 20 / 1.1 · pine", el: <h3 className="park-card-title">Great Smoky Mountains</h3> },
  { label: ".score-num", spec: "body 700 18", el: <span className="score-num num">74</span> },
  { label: "body", spec: "body 400 15 / 1.6", el: <span>Fifty years of NASA POWER data say the valley warms in autumn.</span> },
  { label: ".pref-title", spec: "body 600 14", el: <p className="pref-title">Daytime high</p> },
  { label: ".small", spec: "13", el: <span className="small">California · 312 km from Los Angeles</span> },
  { label: ".small.muted", spec: "13 · text-muted", el: <span className="small muted">Stored only in this browser.</span> },
  { label: ".micro", spec: "11", el: <span className="micro">Match score 0–100 for November</span> },
  { label: ".section-title", spec: "600 11 caps · 0.12em · rust", el: <span className="section-title">Your parks</span> },
  { label: ".tag", spec: "600 10 caps · 0.06em", el: <span className="tag tag-measured">Measured</span> },
  { label: ".num", spec: "tabular-nums", el: <span className="num">1,234 · 98.6 · 0.07</span> },
];

export default function Sandbox() {
  const [chips, setChips] = useState<Set<string>>(new Set(["Nov"]));
  const [tab, setTab] = useState("Temperature");
  const [range, setRange] = useState<[number, number]>([55, 78]);
  const [persona, setPersona] = useState("Visitor");
  const [navTab, setNavTab] = useState("Planner");

  const toggleChip = (c: string) =>
    setChips((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1 className="title">Park Trend Detective</h1>
          <p className="small muted">Design system sandbox · reads styles.css live</p>
        </div>
        <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {["Home", "Planner", "Explore", "Map"].map((t) => (
            <button key={t} className={`nav-tab${navTab === t ? " active" : ""}`} onClick={() => setNavTab(t)}>{t}</button>
          ))}
          <a className="btn-ghost" href="/" style={{ textDecoration: "none", fontSize: 13 }}>Open app →</a>
        </nav>
      </header>

      <nav className="ds-toc" aria-label="Sections">
        {TOC.map(([id, label]) => <a key={id} href={`#${id}`} className="chip">{label}</a>)}
      </nav>

      <div className="ds-layout">
        <main className="ds-main">
          {/* ── Colour ── */}
          <Section id="colour" kicker="Foundations" title="Colour" intro="Tokens on :root in styles.css. Swatches use var(), so they follow the editor.">
            {TOKEN_GROUPS.filter((g) => !["Elevation", "Typography", "Postcard (proposed)"].includes(g.title)).map((g) => (
              <Specimen key={g.title} label={g.title}>
                <div className="ds-swatches" style={{ width: "100%" }}>
                  {g.tokens.map((t) => <Swatch key={t.name} name={t.name} note={t.note} />)}
                </div>
              </Specimen>
            ))}
            <Specimen label="Off-token: hard-coded in components today (not editable here)">
              <div className="ds-swatches" style={{ width: "100%" }}>
                {OFF_TOKEN.map((c) => <Swatch key={c.hex} name={c.hex} value={c.hex} note={`${c.role} · ${c.where}`} />)}
              </div>
            </Specimen>
            <Specimen label="FAMILY_COLORS (research/lib.ts) · categorical series">
              {FAMILY_COLORS.map((c) => <span key={c} className="swatch" style={{ background: c }} title={c} />)}
            </Specimen>
            <Specimen label="Page background: --bg + topographic SVG texture on body">
              <div style={{ width: "100%", height: 80, borderRadius: 12, border: "1px solid var(--border)", background: "inherit", backgroundImage: "inherit" }} />
            </Specimen>
          </Section>

          {/* ── Type ── */}
          <Section id="type" kicker="Foundations" title="Typography" intro="Playfair Display (700, 800) for display; Inter (400–600) for everything else. Base body is 15/1.6.">
            <div className="card">
              {TYPE_SCALE.map((t) => (
                <div key={t.label} className="ds-type-row">
                  <div className="ds-specimen">
                    <span className="ds-label">{t.label}</span>
                    <span className="micro muted">{t.spec}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>{t.el}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Shape & space ── */}
          <Section id="shape" kicker="Foundations" title="Shape, space and elevation" intro="Radii and spacing aren't tokens yet; these are the values used across styles.css and inline styles.">
            <Specimen label="Radius: 2 · 3 · 6 · 8 · 10 · 12 · 14 · 16 · 24 · 999">
              {[2, 3, 6, 8, 10, 12, 14, 16, 24, 999].map((r) => (
                <div key={r} className="ds-specimen" style={{ alignItems: "center" }}>
                  <div className="ds-box" style={{ borderRadius: r }} />
                  <span className="ds-label">{r}</span>
                </div>
              ))}
            </Specimen>
            <Specimen label="Spacing: gap helpers .gap-8 · .gap-12 · .gap-16, plus 4 · 6 · 18 · 20 · 24 · 28 in layouts">
              <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                {[4, 6, 8, 12, 16, 18, 20, 24, 28].map((s) => (
                  <div key={s} className="row gap-12">
                    <span className="ds-label" style={{ width: 24 }}>{s}</span>
                    <div className="ds-space" style={{ width: s * 4 }} />
                  </div>
                ))}
              </div>
            </Specimen>
            <Specimen label="Elevation: --shadow-sm · --shadow-md · --shadow-lg">
              {["sm", "md", "lg"].map((s) => (
                <div key={s} className="ds-specimen" style={{ alignItems: "center" }}>
                  <div className="ds-shadow" style={{ boxShadow: `var(--shadow-${s})` }} />
                  <span className="ds-label">--shadow-{s}</span>
                </div>
              ))}
            </Specimen>
            <Specimen label="Borders: 1px card · 1.5px controls · 2px nav/topbar · 4px accent edge">
              {[1, 1.5, 2].map((w) => <div key={w} className="ds-box" style={{ borderWidth: w, borderColor: "var(--border)", borderRadius: 10 }} />)}
              <div className="ds-box" style={{ border: "1px solid var(--border)", borderLeft: "4px solid var(--pine)", borderRadius: 10 }} />
            </Specimen>
          </Section>

          {/* ── Buttons ── */}
          <Section id="buttons" kicker="Components" title="Buttons and toggles">
            <Specimen label=".btn · .btn-ghost · .link-btn">
              <button className="btn">Create profile →</button>
              <button className="btn-ghost">Cancel</button>
              <button className="link-btn">Remove</button>
              <button className="btn" disabled title="styles.css has no :disabled style">.btn:disabled (no style yet)</button>
            </Specimen>
            <Specimen label=".nav-tab (topbar) · profile button (inline)">
              {["Home", "Planner", "Explore"].map((t) => (
                <button key={t} className={`nav-tab${navTab === t ? " active" : ""}`} onClick={() => setNavTab(t)}>{t}</button>
              ))}
              <button style={{ padding: "7px 12px", borderRadius: 20, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>⚙ Profile</button>
            </Specimen>
            <Specimen label=".chip · .chip.active (month grid)">
              <div className="month-grid" style={{ width: "min(100%, 420px)" }}>
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => (
                  <button key={m} className={`chip${chips.has(m) ? " active" : ""}`} onClick={() => toggleChip(m)}>{m}</button>
                ))}
              </div>
            </Specimen>
            <Specimen label="Segmented control: Landing persona picker (inline)">
              <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, background: "var(--surface-2)", padding: 5, borderRadius: 14, width: "min(100%, 420px)" }}>
                {[["🥾", "Visitor"], ["🧑‍🎓", "Student"], ["🔬", "Researcher"]].map(([e, p]) => {
                  const on = persona === p;
                  return (
                    <button key={p} type="button" role="radio" aria-checked={on} onClick={() => setPersona(p)}
                      style={{ border: 0, borderRadius: 10, padding: "10px 6px", cursor: "pointer", background: on ? "var(--pine)" : "transparent", color: on ? "var(--on-pine)" : "var(--text)", fontWeight: on ? 700 : 500, fontSize: 14, boxShadow: on ? "var(--shadow-sm)" : "none" }}>
                      <div style={{ fontSize: 20 }}>{e}</div>{p}
                    </button>
                  );
                })}
              </div>
            </Specimen>
            <Specimen label=".tabs / .tab (dataset tabs)">
              <div className="tabs" style={{ width: "100%", marginBottom: 0 }}>
                {[["Temperature", "Daymet"], ["Rain", "NASA POWER"], ["Snow", "GSOM"]].map(([t, s]) => (
                  <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                    {t}<span className="micro muted">{s}</span>
                  </button>
                ))}
              </div>
            </Specimen>
          </Section>

          {/* ── Forms ── */}
          <Section id="forms" kicker="Components" title="Form controls">
            <Specimen label=".field input · .field select">
              <label className="field">Month<select defaultValue="11"><option value="11">November</option></select></label>
              <label className="field">Latitude<input defaultValue="37.75" /></label>
              <label className="field" style={{ fontSize: 12, width: 260 }}>What should we call you? (optional)<input placeholder="Your name" style={{ width: "100%" }} /></label>
            </Specimen>
            <Specimen label=".search input + .results-pop">
              <div className="search" style={{ marginBottom: 128 }}>
                <input placeholder="Search a city or ZIP" defaultValue="Denv" />
                <ul className="results-pop">
                  <li><button>Denver<span className="micro muted">Colorado, United States</span></button></li>
                  <li><button>Denville<span className="micro muted">New Jersey, United States</span></button></li>
                </ul>
              </div>
            </Specimen>
            <Specimen label=".text-input · .check">
              <input className="text-input" placeholder="Filter parks…" />
              <label className="check"><input type="checkbox" defaultChecked /> Show °F</label>
              <label className="check"><input type="radio" name="r" defaultChecked /> 1981–2025</label>
            </Specimen>
            <Specimen label=".slider-row · single range">
              <div className="slider-row" style={{ width: "min(100%, 360px)" }}>
                <span className="micro muted">Dry</span><input type="range" defaultValue={40} /><span className="micro muted">Humid</span>
              </div>
            </Specimen>
            <Specimen label=".range2 · two-thumb slider (RangeSlider)">
              <div style={{ width: "min(100%, 360px)" }}>
                <div className="range2-values num"><span>{range[0]}°F</span><span className="muted small">to</span><span>{range[1]}°F</span></div>
                <div className="range2-track">
                  <div className="range2-fill" style={{ left: `${range[0]}%`, width: `${range[1] - range[0]}%` }} />
                  <input type="range" min={0} max={100} value={range[0]} onChange={(e) => setRange([Math.min(+e.target.value, range[1]), range[1]])} aria-label="Low" />
                  <input type="range" min={0} max={100} value={range[1]} onChange={(e) => setRange([range[0], Math.max(+e.target.value, range[0])])} aria-label="High" />
                </div>
                <div className="range2-scale micro muted"><span>0°F</span><span>100°F</span></div>
              </div>
            </Specimen>
          </Section>

          {/* ── Badges ── */}
          <Section id="badges" kicker="Components" title="Tags, pills and badges" intro="The horizon tags and trend pills use tokens. The verdict and difficulty badges are inline styles with hard-coded colours.">
            <Specimen label=".tag · measured / forecast / projected / illustration">
              <span className="tag tag-measured">Measured</span>
              <span className="tag tag-forecast">Forecast</span>
              <span className="tag tag-projected">Projected</span>
              <span className="tag tag-illustration">Illustration</span>
            </Specimen>
            <Specimen label=".trend-pill.real · .trend-pill.possible">
              <span className="trend-pill real">Warming +0.48°F/decade</span>
              <span className="trend-pill possible">Possible trend</span>
            </Specimen>
            <Specimen label="Verdict badge (ExplainerCard, inline)">
              <VerdictBadge bg="#d4edda" color="#155724">Real, not luck</VerdictBadge>
              <VerdictBadge bg="#fff3cd" color="#856404">Possible, not proven</VerdictBadge>
              <VerdictBadge bg="var(--surface-2)" color="var(--text-muted)">No clear change</VerdictBadge>
            </Specimen>
            <Specimen label="Difficulty badge (StudentDetective, inline)">
              <VerdictBadge bg="#d4edda" color="#155724">Easy</VerdictBadge>
              <VerdictBadge bg="#fff3cd" color="#856404">Medium</VerdictBadge>
              <VerdictBadge bg="#f8d7da" color="#721c24">Hard</VerdictBadge>
            </Specimen>
            <Specimen label="Verdict dots: Detective (hex) vs research VERDICT_COLOR (tokens + #b7791f)">
              {[["real", "#2a7d4f"], ["possible", "#b8860b"], ["none", "#aaa"], ["short", "#ccc"]].map(([k, c]) => (
                <span key={k} className="small row"><Dot color={c} />{k}</span>
              ))}
              <span className="muted">|</span>
              {Object.entries(VERDICT_COLOR).slice(0, 3).map(([k, c]) => (
                <span key={k} className="small row"><Dot color={c} />{k}</span>
              ))}
            </Specimen>
            <Specimen label=".suggestion-why · good / ok / bad">
              <span className="suggestion-why good">Right in your range</span>
              <span className="suggestion-why ok">A little warm</span>
              <span className="suggestion-why bad">Too hot in November</span>
            </Specimen>
          </Section>

          {/* ── Data display ── */}
          <Section id="data" kicker="Components" title="Data display">
            <Specimen label=".stat-row / .stat">
              <div className="stat-row" style={{ width: "100%" }}>
                <div className="stat"><div className="micro muted">Warming</div><div className="stat-value num">+0.48°F</div><div className="micro muted">per decade, 1981–2025</div></div>
                <div className="stat"><div className="micro muted">Parks with a real trend</div><div className="stat-value num">41</div><div className="micro muted">of 63</div></div>
              </div>
            </Specimen>
            <Specimen label=".meter (score + range band)">
              <div style={{ width: "min(100%, 360px)", display: "flex", flexDirection: "column", gap: 10 }}>
                {[[82, 76, 88], [74, 61, 85], [69, 50, 83]].map(([v, lo, hi]) => (
                  <div key={v} className="meter">
                    <div className="meter-track">
                      <div className="meter-range" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
                      <div className="meter-dot" style={{ left: `${v}%` }} />
                    </div>
                    <span className="num meter-value">{v} <span className="micro muted">{lo}–{hi}</span></span>
                  </div>
                ))}
              </div>
            </Specimen>
            <Specimen label=".suggestion (planner list row) · .suggestion.selected">
              <div className="suggest-list" style={{ width: "100%", margin: 0 }}>
                {[false, true].map((sel) => (
                  <label key={String(sel)} className={`suggestion${sel ? " selected" : ""}`}>
                    <input type="checkbox" defaultChecked={sel} />
                    <span className="suggestion-main">
                      <span className="suggestion-name">{sel ? "Joshua Tree" : "Zion"} <span className="trend-pill real">+0.48°F/dec</span></span>
                      <span className="suggestion-sub">California · 312 km · 3.2 M visitors</span>
                      <span className="suggestion-why good">Right in your range</span>
                    </span>
                    <span className="suggestion-scores num">
                      {[82, 74, 69].map((s) => <span key={s} className="score-col"><span className="score-num">{s}</span><span className="score-range">{s - 6}–{s + 6}</span></span>)}
                    </span>
                  </label>
                ))}
              </div>
            </Specimen>
            <Specimen label="table · .detail-table · td.has-tip">
              <div className="table-wrap" style={{ width: "100%" }}>
                <table>
                  <thead><tr><th>Measure</th><th>Normal</th><th>2026</th><th>2050</th></tr></thead>
                  <tbody>
                    <tr><td>Daytime high</td><td className="has-tip" tabIndex={0}>68 °F</td><td>70 °F</td><td>73 °F</td></tr>
                    <tr><td>Humidity</td><td className="has-tip" tabIndex={0}>41 %</td><td>39 %</td><td>38 %</td></tr>
                    <tr><td>Rain days</td><td>3</td><td>2</td><td>3</td></tr>
                  </tbody>
                </table>
              </div>
            </Specimen>
            <Specimen label=".yc-legend · chart series styles">
              <div className="yc-legend micro">
                <span><span className="yc-swatch" />Normal</span>
                <span><span className="yc-swatch tag-measured" />Measured</span>
                <span><span className="yc-swatch tag-forecast" />Forecast</span>
                <span><span className="yc-swatch tag-projected" />Projected</span>
              </div>
            </Specimen>
            <Specimen label=".daily-tip (hover chart popover, shown static)">
              <div className="daily-tip" style={{ position: "static" }}>
                <div className="daily-tip-title small">Daytime high · a year of days</div>
                <svg viewBox="0 0 300 80" width="100%" height="80" aria-hidden="true">
                  <rect className="yc-month" x="225" y="0" width="25" height="70" />
                  <line className="yc-axis" x1="0" y1="70" x2="300" y2="70" />
                  <path className="yc-normal" d="M0 60 C60 55 100 15 150 12 S240 50 300 60" />
                  <path className="yc-series tag-measured" d="M0 58 C55 50 100 10 150 8 S230 46 260 52" />
                  <path className="yc-series tag-forecast" d="M260 52 L300 57" />
                </svg>
                <p className="daily-tip-note micro muted">1991–2020 average vs 2026 measured days.</p>
              </div>
            </Specimen>
          </Section>

          {/* ── Feedback ── */}
          <Section id="feedback" kicker="Components" title="Callouts and feedback">
            <Specimen label=".score-explainer">
              <p className="score-explainer small" style={{ width: "100%" }}>
                <strong>How the score works.</strong> Each park gets 0–100 for how well its November weather matches your preferences.
              </p>
            </Specimen>
            <Specimen label="Persona info panel (Landing, inline)">
              <div style={{ background: "var(--pine-tint)", borderRadius: 12, padding: "14px 16px", width: "100%" }}>
                <div style={{ fontWeight: 700, color: "var(--pine)" }}>Plan a trip that fits the weather you like</div>
                <p className="small muted" style={{ margin: "4px 0 0" }}>Scores every park for your month and shows how sure each number is.</p>
              </div>
            </Specimen>
            <Specimen label="Answer feedback (StudentDetective, inline)">
              <div style={{ background: "#d4edda", border: "1px solid #2a7d4f", borderRadius: 10, padding: "10px 14px" }} className="small">✓ Correct: the trend is real.</div>
              <div style={{ background: "#fff3cd", border: "1px solid #b8860b", borderRadius: 10, padding: "10px 14px" }} className="small">Not quite: look at the p-value.</div>
            </Specimen>
            <Specimen label=".error · .muted · .empty">
              <span className="error small">Couldn't reach NASA POWER. Try again.</span>
              <span className="muted small">Loading 63 parks…</span>
            </Specimen>
          </Section>

          {/* ── Cards ── */}
          <Section id="cards" kicker="Components" title="Cards" intro=".card is the base surface: 16px radius, 1px border, --shadow-sm.">
            <div className="ds-grid">
              <div className="card">
                <div className="card-head"><h3 className="headline">.card + .card-head</h3><button className="link-btn">Action</button></div>
                <p className="small muted" style={{ margin: 0 }}>Base surface for panels, prefs and charts.</p>
              </div>
              <div className="card" style={{ boxShadow: "var(--shadow-md)" }}>
                <h3 className="headline">.card + --shadow-md</h3>
                <p className="small muted" style={{ margin: "4px 0 0" }}>The raised variant the Landing form uses.</p>
              </div>
            </div>
            <Specimen label=".card.park-card (planner)">
              <article className="card park-card" style={{ width: "min(100%, 520px)" }}>
                <header className="park-card-head">
                  <div>
                    <h3 className="park-card-title">Joshua Tree</h3>
                    <p className="small muted">California · 312 km from Los Angeles · 3,200,000 visitors in 2025</p>
                  </div>
                  <button className="link-btn small">Remove</button>
                </header>
                <div style={{ display: "inline-flex", gap: 8, background: "#d4edda", color: "#155724", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, margin: "10px 0 0" }}>
                  📈 Warming +0.48°F/decade · Real, not luck
                </div>
                <p className="micro muted" style={{ margin: "10px 0 0" }}>Match score 0–100 for November.</p>
                <div className="park-card-scores">
                  {[["Nov 2026", "Measured", "tag-measured", 82], ["Nov 2027", "Forecast", "tag-forecast", 74], ["Nov 2050", "Projected", "tag-projected", 69]].map(([t, tag, cls, v]) => (
                    <div key={t} className="park-card-score">
                      <div className="micro muted">{t} <span className={`tag ${cls}`}>{tag}</span></div>
                      <div className="big-score num">{v}</div>
                      <div className="meter-track"><div className="meter-range" style={{ left: `${+v - 8}%`, width: "16%" }} /><div className="meter-dot" style={{ left: `${v}%` }} /></div>
                    </div>
                  ))}
                </div>
              </article>
            </Specimen>
          </Section>

          {/* ── Postcard ── */}
          <Section id="postcard" kicker="Aesthetic" title="Postcard" proposed
            intro="A one-sided park postcard: photo on the left, the full park card on the right (all three year scores, conditions with factor-score bars, trend, links), on white card stock with square paper corners. The illustration is a placeholder until park photos land; edit the --pc-* tokens in the panel.">
            <Specimen label=".postcard · photo 40% | park card 60%">
              <div style={{ width: "min(100%, 880px)" }}>
                <Postcard p={SAMPLE_PARK} plan={SAMPLE_PLAN} unit="F" place={SAMPLE_PLACE} trend={SAMPLE_TREND}
                  onRemove={() => {}} onViewTrend={() => {}} />
              </div>
            </Specimen>
            <Specimen label=".postcard in a narrow slot (container < 600px) · stacks">
              <div style={{ width: "min(100%, 380px)" }}>
                <Postcard p={SAMPLE_PARK} plan={SAMPLE_PLAN} unit="C" place={SAMPLE_PLACE} trend={SAMPLE_TREND} mood="forest" />
              </div>
            </Specimen>
          </Section>
        </main>

        <TokenEditor />
      </div>
    </div>
  );
}
