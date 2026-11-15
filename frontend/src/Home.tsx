// Home: the first impression. Hero, month picker, three park picks for this month, entry cards.
import type { Atlas } from "./detective/model";
import { Safe } from "./ErrorBoundary";
import { TAGLINE } from "./brand/Logo";
import RightNow from "./home/RightNow";
import { NextCase, ParkOfTheDay } from "./detective/StudentWidgets";
import { GuessTheTwin } from "./detective/TwinGame";
import "./home/home.css";

interface Props {
  name: string;
  research: boolean;
  atlas: Atlas | null;
  onGo: (tab: string, extra?: Record<string, unknown>) => void;
}

const CARDS = [
  { tab: "planner", title: "Plan", text: "Find the best month for any park." },
  { tab: "student", title: "Mysteries", text: "Solve short puzzles about how parks are changing." },
  { tab: "passport", title: "Passport", text: "Collect a stamp for every park you solve." },
];

export default function Home({ name, research, atlas, onGo }: Props) {
  const now = new Date().getMonth() + 1;
  const explore = (park: string) => onGo("explore", { park });
  const cards = research
    ? [...CARDS, { tab: "atlas", title: "Research", text: "Trend atlas, maps, comparisons and methods." }]
    : CARDS;
  return (
    <div className="hm">
      <section className="hm-hero" aria-label="Welcome">
        <p className="hm-hello">{name ? `Welcome, ${name}` : "Welcome"}</p>
        <h1 className="hm-head">{TAGLINE}</h1>
        <p className="hm-lead">
          Canopy reads NASA climate records for every US national park and shows which month suits you best.
        </p>
        <div className="hm-actions">
          <button className="hm-cta" onClick={() => onGo("planner")}>Plan a trip</button>
          <button className="hm-quiet" onClick={() => onGo("student")}>Try a mystery</button>
        </div>
      </section>

      <Safe what="Park picks">
        <RightNow month={now} onOpen={(_code, id) => onGo("planner", { park: id })} />
      </Safe>

      <section className="hm-sec" aria-label="Play today">
        <h2 className="hm-h2">Play today</h2>
        <Safe what="Next mystery"><NextCase onPlay={(c) => onGo("student", { caseId: c.id, step: 0 })} /></Safe>
        {atlas && (
          <div className="hm-games">
            <Safe what="Park of the day"><ParkOfTheDay atlas={atlas} onExplore={explore} /></Safe>
            <Safe what="Guess the twin"><GuessTheTwin atlas={atlas} onExplore={explore} /></Safe>
          </div>
        )}
      </section>

      <section className="hm-cards" aria-label="Where to next">
        {cards.map((c) => (
          <button key={c.tab} className="hm-card" onClick={() => onGo(c.tab)}>
            <b>{c.title}</b>
            <span>{c.text}</span>
          </button>
        ))}
      </section>

      <p className="hm-credit">Data: NASA POWER, GRACE, FIRMS and GIBS night lights. Checked against NOAA GHCN-Daily. 2050 from WorldClim CMIP6. Park list and visitors: Wikipedia.</p>
    </div>
  );
}
