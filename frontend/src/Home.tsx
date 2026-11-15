// Home: the first impression. Hero, month picker, three park picks for this month, entry cards.
import type { Atlas } from "./detective/model";
import { Safe } from "./ErrorBoundary";
import Logo, { TAGLINE } from "./brand/Logo";
import RightNow from "./home/RightNow";
import { MONTHS } from "./planner/trip/tripModel";
import "./home/home.css";

interface Props {
  name: string;
  research: boolean;
  atlas: Atlas | null;
  onGo: (tab: string, extra?: Record<string, unknown>) => void;
}

const CARDS = [
  { tab: "planner", title: "Plan", text: "Find the best month for any park." },
  { tab: "student", title: "Cases", text: "Solve short puzzles about how parks are changing." },
  { tab: "passport", title: "Passport", text: "Collect a stamp for every park you solve." },
];

export default function Home({ name, research, onGo }: Props) {
  const now = new Date().getMonth() + 1;
  const cards = research
    ? [...CARDS, { tab: "atlas", title: "Research", text: "Trend atlas, maps, comparisons and methods." }]
    : CARDS;
  return (
    <div className="hm">
      <section className="hm-hero" aria-label="Welcome">
        <Logo size={36} />
        <p className="hm-hello">{name ? `Welcome, ${name}` : "Welcome"}</p>
        <h1 className="hm-head">{TAGLINE}</h1>
        <p className="hm-lead">
          Canopy reads NASA climate records for every US national park and shows which month suits you best.
        </p>
        <div className="hm-actions">
          <button className="hm-cta" onClick={() => onGo("planner")}>Plan a trip</button>
          <button className="hm-quiet" onClick={() => onGo("student")}>Try a case</button>
        </div>
      </section>

      <section className="hm-sec" aria-label="Pick a month">
        <h2 className="hm-h2">When do you want to go?</h2>
        <div className="hm-months">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              className="hm-pill"
              aria-current={i + 1 === now ? "true" : undefined}
              onClick={() => onGo("planner", { month: i + 1 })}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      <Safe what="Park picks">
        <RightNow month={now} onOpen={(code, id) => onGo("planner", { park: code ?? id })} />
      </Safe>

      <section className="hm-cards" aria-label="Where to next">
        {cards.map((c) => (
          <button key={c.tab} className="hm-card" onClick={() => onGo(c.tab)}>
            <b>{c.title}</b>
            <span>{c.text}</span>
          </button>
        ))}
      </section>

      <p className="hm-credit">Data: NASA POWER, NASA GRACE, NASA FIRMS and NPS visitor counts.</p>
    </div>
  );
}
