// Home screen. Content depends on the persona chosen at sign-up.
import { useMemo } from "react";
import { CASES } from "./detective/cases";
import { NextCase, ParkOfTheDay, RankBanner } from "./detective/StudentWidgets";
import { PARK_NAMES } from "./detective/Detective";
import type { Atlas, AtlasCell } from "./detective/model";
import { PERSONAS, type Persona, type Tab } from "./profile";
import type { NavState } from "./useNav";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  persona: Persona;
  name: string;
  atlas: Atlas | null;
  onGo: (tab: Tab, extra?: Partial<NavState>) => void;
}

/** Real annual warming trends (daytime high), strongest first. */
function topWarming(atlas: Atlas | null, n: number): AtlasCell[] {
  const cells = atlas?.atlas["tmax_c"]?.["annual"] ?? [];
  return cells
    .filter((c) => c.verdict === "real" && c.sen != null && c.sen > 0)
    .sort((a, b) => b.sen! - a.sen!)
    .slice(0, n);
}

function verdictTotals(atlas: Atlas | null) {
  const t = { real: 0, possible: 0, total: 0 };
  if (!atlas) return t;
  for (const byPeriod of Object.values(atlas.atlas))
    for (const cells of Object.values(byPeriod))
      for (const c of cells) {
        t.total++;
        if (c.verdict === "real") t.real++;
        else if (c.verdict === "possible") t.possible++;
      }
  return t;
}

const f = (c: number) => `${c > 0 ? "+" : ""}${(c * 1.8).toFixed(2)}°F`;

function Hero({ persona, name }: { persona: Persona; name: string }) {
  const info = PERSONAS[persona];
  return (
    <div style={{ borderBottom: "2px solid var(--pine)", paddingBottom: 14 }}>
      <div className="section-title">{info.emoji} {info.label} home</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--pine)", margin: "4px 0" }}>
        {name ? `Welcome, ${name}` : "Welcome"}
      </h2>
      <p className="muted" style={{ margin: 0 }}>{info.tagline}.</p>
    </div>
  );
}

function ParkChip({ cell, onClick }: { cell: AtlasCell; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{ textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}
    >
      <strong>{PARK_NAMES[cell.park_id] ?? cell.park_id}</strong>
      <span style={{ color: "var(--rust)", fontWeight: 600 }}>{f(cell.sen!)} per decade</span>
      <span className="micro muted">daytime high · confirmed, not luck</span>
    </button>
  );
}

function VisitorHome({ atlas, onGo }: Pick<Props, "atlas" | "onGo">) {
  const warming = useMemo(() => topWarming(atlas, 3), [atlas]);
  return (
    <>
      <section className="card">
        <div className="section-title">Plan a trip</div>
        <h3 style={{ margin: "4px 0 12px" }}>Which month are you thinking of?</h3>
        <div className="month-grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", maxWidth: 520 }}>
          {MONTHS.map((m, i) => (
            <button key={m} className="chip" onClick={() => onGo("planner", { month: i + 1 })}>{m}</button>
          ))}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          We score every park for that month: this year, next year and 2050.
        </p>
      </section>
      <section>
        <div className="section-title" style={{ marginBottom: 8 }}>Parks warming fastest</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {warming.map((c) => (
            <ParkChip key={c.park_id} cell={c} onClick={() => onGo("explore", { park: c.park_id })} />
          ))}
        </div>
      </section>
    </>
  );
}

function StudentHome({ atlas, onGo }: Pick<Props, "atlas" | "onGo">) {
  return (
    <>
      <RankBanner />
      <NextCase onPlay={(c) => onGo("student", { caseId: c.id, step: 0 })} />
      {atlas && <ParkOfTheDay atlas={atlas} onExplore={(park) => onGo("explore", { park })} />}
      <div>
        <button className="btn-ghost" onClick={() => onGo("student")}>See all {CASES.length} cases →</button>
      </div>
    </>
  );
}

function ResearcherHome({ atlas, onGo }: Pick<Props, "atlas" | "onGo">) {
  const totals = useMemo(() => verdictTotals(atlas), [atlas]);
  const top = useMemo(() => topWarming(atlas, 5), [atlas]);
  const tile = (label: string, value: string) => (
    <div className="stat">
      <div className="micro muted">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
  return (
    <>
      <div className="stat-row">
        {tile("Trend tests", totals.total.toLocaleString())}
        {tile("Real (q < 0.05)", totals.real.toLocaleString())}
        {tile("Possible (p < 0.05)", totals.possible.toLocaleString())}
        {tile("Record", "1981–2026")}
      </div>
      <section className="card">
        <div className="section-title">Strongest annual warming (daytime high)</div>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr><th>Park</th><th>Sen's slope / decade</th><th>q</th></tr>
          </thead>
          <tbody>
            {top.map((c) => (
              <tr key={c.park_id}>
                <td>
                  <button className="link-btn" onClick={() => onGo("atlas", { park: c.park_id })}>
                    {PARK_NAMES[c.park_id] ?? c.park_id}
                  </button>
                </td>
                <td>{f(c.sen!)}</td>
                <td>{c.q != null ? c.q.toFixed(4) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <div className="section-title">Research tools</div>
        <div className="card-grid" style={{ marginTop: 8 }}>
          {([
            ["map", "🗺 National map", "Every park coloured by its trend for any variable and period."],
            ["families", "🧬 Park families", "Parks grouped by how they change, with bootstrap stability."],
            ["opposites", "↔ Opposite trends", "Where the same variable rises in one park and falls in another, with driver data."],
            ["seasons", "🌗 Season shifts", "Which months change fastest in each park, as a heat table."],
            ["compare", "⚖ Compare parks", "Two parks on one chart, with their statistics side by side."],
            ["robust", "🧪 Robustness", "Start-year test, signal-to-noise, methods, BibTeX, Python and R code."],
          ] as const).map(([t, title, text]) => (
            <button key={t} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => onGo(t)}>
              <b>{title}</b>
              <div className="small muted" style={{ marginTop: 4 }}>{text}</div>
            </button>
          ))}
        </div>
      </section>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => onGo("atlas")}>Open the full atlas →</button>
        <a className="btn-ghost" href="/api/trends/atlas" download="park-trends-atlas.json" style={{ textDecoration: "none" }}>
          ⬇ Download atlas.json
        </a>
      </div>
      <p className="micro muted" style={{ margin: 0 }}>
        Method: Sen's slope, Mann-Kendall (Hamed-Rao correction when autocorrelated), Benjamini-Hochberg FDR across parks.
      </p>
    </>
  );
}

export default function Home({ persona, name, atlas, onGo }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Hero persona={persona} name={name} />
      {!atlas && <p className="muted">Loading trend data…</p>}
      {persona === "visitor" && <VisitorHome atlas={atlas} onGo={onGo} />}
      {persona === "student" && <StudentHome atlas={atlas} onGo={onGo} />}
      {persona === "researcher" && <ResearcherHome atlas={atlas} onGo={onGo} />}
    </div>
  );
}
