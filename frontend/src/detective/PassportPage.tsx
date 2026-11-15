// Park passport page and its Home preview. Stamps come from solved cases.
import { useMemo, useState } from "react";
import { CASES, type Case } from "./cases";
import { loadProgress } from "./games";
import { PARK_NAMES } from "./parkNames";
import { caseForPark, casesByPark, stamps } from "./stamps";
import { TOPO } from "./theme";
import { PHOTOS } from "./photos";
import { useWishlist } from "./wishlist";

// Stamp: the park's photo in a round frame. Stamped = full colour with an ink ring;
// not yet = faded grey behind a dashed ring.
const CSS = `
.pp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:30px 20px}
.pp-stamp{position:relative;width:100%;aspect-ratio:1;border-radius:50%;padding:0;cursor:pointer;font:inherit;
  overflow:visible;background:var(--paper);transition:transform .2s}
.pp-stamp:hover,.pp-stamp:focus-visible{transform:scale(1.04)}
.pp-stamp:focus-visible{outline:2px solid var(--moss);outline-offset:3px}
.pp-photo{position:absolute;inset:5px;border-radius:50%;overflow:hidden;background:var(--stone)}
.pp-photo img{width:100%;height:100%;object-fit:cover;display:block}
.pp-on{border:2px solid var(--moss)}
.pp-off{border:1.5px dashed var(--stone)}
.pp-off .pp-photo img{filter:grayscale(1);opacity:.4}
.pp-name{position:absolute;left:50%;bottom:-12px;transform:translateX(-50%);white-space:nowrap;max-width:112%;overflow:hidden;text-overflow:ellipsis;
  font-family:var(--font-body);font-weight:500;font-size:12px;
  padding:3px 10px;border-radius:99px;background:var(--paper);color:var(--bark);border:1px solid var(--stone)}
.pp-off .pp-name{color:var(--bark-2)}
.pp-badge{position:absolute;top:0;right:0;font-size:14px;line-height:1;width:28px;height:28px;border-radius:50%;
  display:grid;place-items:center;background:var(--paper);border:1px solid var(--stone)}
.pp-off .pp-badge{filter:grayscale(1);opacity:.7}
.pp-stars{position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:11px;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.pp-row{display:flex;gap:16px;flex-wrap:wrap;padding-bottom:14px}
.pp-row .pp-stamp{width:96px;height:96px}
.pp-row .pp-name{font-size:10px;padding:2px 7px}
.pp-row .pp-badge{width:22px;height:22px;font-size:12px}
.pp-list{list-style:none;margin:10px 0 14px;padding:0;display:flex;flex-direction:column}
.pp-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--stone)}
.pp-item:first-child{border-top:0}
.pp-tick{width:20px;height:20px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;font-size:12px;
  border:1.5px solid var(--stone);color:var(--paper)}
.pp-tick.done{background:var(--moss);border-color:var(--moss)}
.pp-item-title{flex:1;min-width:0}
.pp-item .link-btn{white-space:nowrap}
@media (prefers-reduced-motion:reduce){.pp-stamp{transition:none}}
`;

const caseById = (id: string) => CASES.find((c) => c.id === id);

function Stamp({ park, solved, onClick, title }: { park: string; solved: string[]; onClick: () => void; title: string }) {
  const on = solved.length > 0;
  const first = on ? caseById(solved[0]) : undefined;
  const photo = PHOTOS[park];
  const name = PARK_NAMES[park] ?? park;
  return (
    <button
      className={`pp-stamp ${on ? "pp-on" : "pp-off"}`}
      onClick={onClick}
      title={photo ? `${title}\nPhoto: ${photo.credit} (${photo.license})` : title}
      aria-label={`${name}: ${title}`}
    >
      <span className="pp-photo">{photo && <img src={photo.file} alt="" loading="lazy" />}</span>
      {on && solved.length > 1 && <span className="pp-stars">{"⭐".repeat(Math.min(solved.length - 1, 5))}</span>}
      <span className="pp-badge" aria-hidden>{on ? first?.emoji : "🔒"}</span>
      <span className="pp-name">{name}</span>
    </button>
  );
}

/** Who took each photo, with its licence and Commons page. */
function PhotoCredits({ parks }: { parks: string[] }) {
  return (
    <details className="micro muted">
      <summary style={{ cursor: "pointer" }}>Photo credits (Wikimedia Commons)</summary>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
        {parks.filter((p) => PHOTOS[p]).map((p) => (
          <li key={p}>
            {PARK_NAMES[p]}: {PHOTOS[p].credit}, {PHOTOS[p].license},{" "}
            <a href={PHOTOS[p].source} target="_blank" rel="noreferrer">source</a>
          </li>
        ))}
      </ul>
    </details>
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
          <div className="section-title">Park passport</div>
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
      <p className="micro muted" style={{ margin: "10px 0 0" }}>Solve a case to stamp every park it studies. Photos: Wikimedia Commons.</p>
    </section>
  );
}

/** The full passport: every park, stamped or waiting. */
export default function Passport({ onCase, onExplore, onSaved }: Go & { onSaved?: () => void }) {
  const { progress, got, byPark } = useStamps();
  const [pick, setPick] = useState<string | null>(null);
  const [wish] = useWishlist();
  const all = Object.keys(PARK_NAMES).sort((a, b) => PARK_NAMES[a].localeCompare(PARK_NAMES[b]));
  const casePark = all.filter((p) => byPark.has(p));
  const noCase = all.filter((p) => !byPark.has(p));
  const extra = [...got.values()].reduce((n, l) => n + l.length - 1, 0);
  const picked = pick ? { park: pick, list: byPark.get(pick) ?? [], solved: got.get(pick) ?? [] } : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{CSS}</style>
      <header style={{ borderBottom: "1px solid var(--stone)", paddingBottom: 16 }}>
        <div className="section-title">Park passport</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 34, color: "var(--bark)", margin: "4px 0 6px" }}>
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
          <ul className="pp-list">
            {picked.list.map((c) => {
              const done = picked.solved.includes(c.id);
              return (
                <li key={c.id} className="pp-item">
                  <span className={`pp-tick${done ? " done" : ""}`} aria-label={done ? "Solved" : "Not solved yet"}>{done ? "✓" : ""}</span>
                  <span aria-hidden>{c.emoji}</span>
                  <span className="pp-item-title">{c.title}</span>
                  <button className="link-btn small" onClick={() => onCase(c)}>
                    {done ? "Play again" : "Solve it"} →
                  </button>
                </li>
              );
            })}
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

      {wish.length > 0 && onSaved && (
        <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={onSaved}>
          ♥ {wish.length} saved park{wish.length === 1 ? "" : "s"} →
        </button>
      )}

      <section>
        <div className="section-title" style={{ marginBottom: 6 }}>No case yet</div>
        <p className="small muted" style={{ margin: "0 0 8px" }}>These parks have NASA data but no case. Tap one to explore it.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {noCase.map((p) => (
            <button key={p} className="chip chip-sm" onClick={() => onExplore(p)}>{PARK_NAMES[p]}</button>
          ))}
        </div>
      </section>
      <PhotoCredits parks={casePark} />
    </div>
  );
}
