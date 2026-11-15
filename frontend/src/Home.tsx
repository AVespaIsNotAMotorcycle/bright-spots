// Home screen. Content depends on the persona chosen at sign-up.
import { CASES, type Case } from "./detective/cases";
import { PassportPreview } from "./detective/PassportPage";
import { NextCase, ParkOfTheDay, RankBanner } from "./detective/StudentWidgets";
import { GuessTheTwin } from "./detective/TwinGame";
import SinceBorn from "./detective/BirthYearCard";
import type { Atlas } from "./detective/model";
import { Safe } from "./ErrorBoundary";
import { PERSONAS, type Persona, type Tab } from "./profile";
import { AnomalyOfWeek, CampfirePreview, Leaderboard, MiniMap, SavedViews, StationHero, ToolTiles, type ToolInfo } from "./research/ResearcherWidgets";
import { CiteThis, Source } from "./research/station";
import type { NavState } from "./useNav";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  research: boolean;
  name: string;
  science?: boolean;
  atlas: Atlas | null;
  onGo: (tab: Tab, extra?: Partial<NavState>) => void;
}

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

function ExplorerHome({ atlas, onGo, science }: Pick<Props, "atlas" | "onGo" | "science">) {
  const play = (c: Case) => onGo("student", { caseId: c.id, step: 0 });
  return (
    <>
      <Safe><RankBanner /></Safe>
      <section className="card">
        <div className="section-title">🗓 Plan a trip</div>
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
      <Safe>{atlas && <SinceBorn atlas={atlas} science={science} onExplore={(park) => onGo("explore", { park })} />}</Safe>
      <Safe><NextCase onPlay={play} /></Safe>
      <Safe><PassportPreview onOpen={() => onGo("passport")} onCase={play} /></Safe>
      <Safe>{atlas && <ParkOfTheDay atlas={atlas} science={science} onExplore={(park) => onGo("explore", { park })} />}</Safe>
      <Safe>{atlas && <GuessTheTwin atlas={atlas} onExplore={(park) => onGo("explore", { park })} />}</Safe>
      <div>
        <button className="btn-ghost" onClick={() => onGo("student")}>See all {CASES.length} cases →</button>
      </div>
    </>
  );
}

const TOOLS: ToolInfo[] = [
  { tab: "map", icon: "🗺️", title: "Topo trend map", text: "Every park on one map, with contour rings for confirmed trends.", color: "#6b7f3a" },
  { tab: "analogs", icon: "🌐", title: "Analog sites", text: "Comparison sites: parks changing alike, filtered by ecoregion.", color: "#2d5a27" },
  { tab: "opposites", icon: "🧭", title: "Odd one out", text: "Neighbouring parks with confirmed trends going opposite ways.", color: "#c98a54" },
  { tab: "seasons", icon: "🌗", title: "Season wheel", text: "Which months change fastest, drawn as a wheel.", color: "#3d5a73" },
  { tab: "compare", icon: "🥊", title: "Head-to-head", text: "Two parks, one chart, scored round by round.", color: "#8b3a1a" },
  { tab: "families", icon: "🧬", title: "Park families", text: "Parks grouped by how they change, with stability checks.", color: "#a9b88a" },
  { tab: "robust", icon: "🧪", title: "Robustness", text: "Start-year test, methods, BibTeX, Python and R code.", color: "#4a3726" },
  { tab: "community", icon: "🔥", title: "The Campfire", text: "Share notes and questions with other researchers.", color: "#c98a54" },
];

function ResearcherHome({ atlas, onGo, name }: Pick<Props, "atlas" | "onGo" | "name">) {
  return (
    <>
      <Safe><StationHero name={name} atlas={atlas} onGo={(t) => onGo(t as Tab)} /></Safe>
      <Safe><SavedViews /></Safe>
      {atlas && (
        <Safe>
          <AnomalyOfWeek
            atlas={atlas}
            onRobust={(park, v, per) => onGo("robust", { park, v, per })}
            onCompare={(park, v, per) => onGo("compare", { park, v, per })}
            onDiscuss={(park, v, per) => onGo("community", { park, v, per })}
          />
        </Safe>
      )}
      <section>
        <div className="section-title" style={{ marginBottom: 8 }}>Station tools</div>
        <ToolTiles tools={TOOLS} onGo={(t) => onGo(t as Tab)} />
      </section>
      <Safe>{atlas && <MiniMap atlas={atlas} onTwins={(park) => onGo("analogs", { park })} />}</Safe>
      <Safe>{atlas && <Leaderboard atlas={atlas} onOpen={(park) => onGo("atlas", { park })} />}</Safe>
      <Safe><CampfirePreview atlas={atlas} onOpen={() => onGo("community")} /></Safe>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" onClick={() => onGo("atlas")}>Open the full atlas →</button>
        <a className="btn-ghost" href="/api/trends/atlas" download="park-trends-atlas.json" style={{ textDecoration: "none" }}>
          ⬇ Download atlas.json
        </a>
        <CiteThis ctx={{ tool: "Trend atlas" }} atlas={atlas} />
      </div>
      <Source atlas={atlas}
        extra="Method: Sen's slope, Mann-Kendall (Hamed-Rao when years are autocorrelated), Benjamini-Hochberg FDR across parks." />
    </>
  );
}

export default function Home({ research, name, atlas, onGo, science }: Props) {
  const persona: Persona = research ? "researcher" : "explorer";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {persona !== "researcher" && <Hero persona={persona} name={name} />}
      {!atlas && <p className="muted">Loading trend data…</p>}
      {persona === "explorer" && <ExplorerHome atlas={atlas} onGo={onGo} science={science} />}
      {persona === "researcher" && <ResearcherHome atlas={atlas} onGo={onGo} name={name} />}
    </div>
  );
}
