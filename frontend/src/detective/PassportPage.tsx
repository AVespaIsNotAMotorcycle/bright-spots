// Park passport page and its Home preview. Stamps come from solved cases.
import { useMemo, useState } from "react";
import { CASES, type Case } from "./cases";
import { loadProgress } from "./games";
import { PARK_NAMES } from "./parkNames";
import { caseForPark, casesByPark, stamps } from "./stamps";
import { E, TOPO } from "./theme";

const CSS = `
.pp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:14px}
.pp-stamp{aspect-ratio:1;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;text-align:center;padding:12px;cursor:pointer;font:inherit;transition:transform .15s}
.pp-stamp:hover,.pp-stamp:focus-visible{transform:scale(1.05) rotate(0deg)!important}
.pp-on{border:3px double ${E.rust};color:${E.rust};background:rgba(247,241,227,.9);box-shadow:inset 0 0 0 4px rgba(139,58,26,.08)}
.pp-off{border:2px dashed rgba(74,55,38,.35);color:rgba(74,55,38,.55);background:transparent}
.pp-name{font-family:var(--font-display);font-weight:800;font-size:13px;line-height:1.1;text-transform:uppercase;letter-spacing:.03em}
.pp-row{display:flex;gap:10px;flex-wrap:wrap}
.pp-row .pp-stamp{width:86px;padding:8px}
.pp-row .pp-name{font-size:10px}
@media (prefers-reduced-motion:reduce){.pp-stamp{transition:none}}
`;

/** A small random-looking tilt that stays the same for each park. */
const tilt = (id: string) => ((id.charCodeAt(0) * 7 + id.charCodeAt(id.length - 1) * 3) % 17) - 8;
const caseById = (id: string) => CASES.find((c) => c.id === id);

function Stamp({ park, solved, onClick, title }: { park: string; solved: string[]; onClick: () => void; title: string }) {
  const on = solved.length > 0;
  const first = on ? caseById(solved[0]) : undefined;
  return (
    <button className={`pp-stamp ${on ? "pp-on" : "pp-off"}`} style={{ transform: `rotate(${on ? tilt(park) : 0}deg)` }} onClick={onClick} title={title}>
      <span style={{ fontSize: 22, filter: on ? "none" : "grayscale(1)", opacity: on ? 1 : 0.4 }}>{first?.emoji ?? "⛰"}</span>
      <span className="pp-name">{PARK_NAMES[park] ?? park}</span>
      {on && solved.length > 1 && <span style={{ fontSize: 11 }}>{"⭐".repeat(Math.min(solved.length - 1, 5))}</span>}
    </button>
  );
}

function useStamps() {
  return useMemo(() => {
    const progress = loadProgress();
    return { progress, got: stamps(progress), byPark: casesByPark() };
  }, []);
}

interface Go {
  onCase: (c: Case) => void;
  onExplore: (park: string) => void;
}

/** Home card: how many stamps, and a row of them. */
export function PassportPreview({ onOpen, onCase }: { onOpen: () => void; onCase: (c: Case) => void }) {
  const { progress, got, byPark } = useStamps();
  const parks = [...byPark.keys()];
  const row = [...parks.filter((p) => got.has(p)), ...parks.filter((p) => !got.has(p))].slice(0, 7);
  return (
    <section className="card" style={{ background: `${TOPO} right -60px top -40px / 300px no-repeat, var(--surface)` }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="section-title">🎫 Park passport</div>
          <h3 style={{ margin: "4px 0 10px" }}>{got.size} of {parks.length} parks stamped</h3>
        </div>
        <button className="btn-ghost" onClick={onOpen}>Open passport →</button>
      </div>
      <div className="pp-row">
        {row.map((p) => {
          const c = caseForPark(p, progress);
          return (
            <Stamp key={p} park={p} solved={got.get(p) ?? []}
              title={got.has(p) ? "Stamped" : `Solve "${c?.title}" to stamp it`}
              onClick={() => (got.has(p) ? onOpen() : c && onCase(c))} />
          );
        })}
      </div>
      <p className="micro muted" style={{ margin: "10px 0 0" }}>Solve a case to stamp every park it studies.</p>
    </section>
  );
}

/** The full passport: every park, stamped or waiting. */
export default function Passport({ onCase, onExplore }: Go) {
  const { progress, got, byPark } = useStamps();
  const [pick, setPick] = useState<string | null>(null);
  const all = Object.keys(PARK_NAMES).sort((a, b) => PARK_NAMES[a].localeCompare(PARK_NAMES[b]));
  const casePark = all.filter((p) => byPark.has(p));
  const noCase = all.filter((p) => !byPark.has(p));
  const extra = [...got.values()].reduce((n, l) => n + l.length - 1, 0);
  const picked = pick ? { park: pick, list: byPark.get(pick) ?? [], solved: got.get(pick) ?? [] } : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{CSS}</style>
      <header style={{ borderBottom: `2px solid ${E.pine}`, paddingBottom: 12 }}>
        <div className="section-title">🎫 Park passport</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: E.pine, margin: "4px 0" }}>
          {got.size} of {casePark.length} stamps
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Each solved case stamps the parks it studies. A ⭐ means another case visited that park.
          {extra > 0 && ` You have ${extra} extra ⭐.`}
        </p>
      </header>

      {picked && (
        <section className="card" aria-live="polite">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <h3 style={{ margin: 0 }}>{PARK_NAMES[picked.park]}</h3>
            <button className="link-btn small" onClick={() => setPick(null)}>Close</button>
          </div>
          <ul style={{ margin: "8px 0", paddingLeft: 18, lineHeight: 1.9 }}>
            {picked.list.map((c) => (
              <li key={c.id}>
                {picked.solved.includes(c.id) ? "✅" : "⬜"} {c.emoji} {c.title}{" "}
                <button className="link-btn small" onClick={() => onCase(c)}>
                  {picked.solved.includes(c.id) ? "Play again" : "Solve it"} →
                </button>
              </li>
            ))}
          </ul>
          <button className="btn-ghost" onClick={() => onExplore(picked.park)}>See this park's data →</button>
        </section>
      )}

      <div className="pp-grid">
        {casePark.map((p) => (
          <Stamp key={p} park={p} solved={got.get(p) ?? []} onClick={() => setPick(p)}
            title={got.has(p) ? `${got.get(p)!.length} case(s) solved here` : `Solve "${caseForPark(p, progress)?.title}" to stamp it`} />
        ))}
      </div>

      <section>
        <div className="section-title" style={{ marginBottom: 6 }}>No case yet</div>
        <p className="small muted" style={{ margin: "0 0 8px" }}>These parks have NASA data but no case. Tap one to explore it.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {noCase.map((p) => (
            <button key={p} className="chip chip-sm" onClick={() => onExplore(p)}>{PARK_NAMES[p]}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
