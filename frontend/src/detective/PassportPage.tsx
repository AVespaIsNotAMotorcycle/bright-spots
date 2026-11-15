// Park passport page and its Home preview. Stamps come from solved cases.
import { useMemo, useState } from "react";
import { CASES, type Case } from "./cases";
import { loadProgress } from "./games";
import { PARK_NAMES } from "./parkNames";
import { caseForPark, casesByPark, stamps } from "./stamps";
import { E, TOPO } from "./theme";
import { PHOTOS } from "./photos";
import { useWishlist } from "./wishlist";

// Stamp: the park's photo in a round frame. Stamped = full colour with an ink ring;
// not yet = faded grey behind a dashed ring.
const CSS = `
.pp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:18px}
.pp-stamp{position:relative;width:100%;aspect-ratio:1;border-radius:50%;padding:0;cursor:pointer;font:inherit;
  overflow:visible;background:${E.cream};transition:transform .2s}
.pp-stamp:hover,.pp-stamp:focus-visible{transform:scale(1.06) rotate(0deg)!important}
.pp-photo{position:absolute;inset:6px;border-radius:50%;overflow:hidden;background:#d9ccb0}
.pp-photo img{width:100%;height:100%;object-fit:cover;display:block}
.pp-on{border:4px double ${E.rust};box-shadow:0 4px 10px rgba(74,55,38,.25)}
.pp-on .pp-photo img{filter:saturate(1.1) contrast(1.05)}
.pp-on .pp-photo::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 3px rgba(247,241,227,.7),inset 0 -40px 30px -20px rgba(0,0,0,.55)}
.pp-off{border:2px dashed rgba(74,55,38,.4)}
.pp-off .pp-photo img{filter:grayscale(1) sepia(.3);opacity:.35}
.pp-name{position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);white-space:nowrap;max-width:118%;overflow:hidden;text-overflow:ellipsis;
  font-family:var(--font-display);font-weight:800;font-size:11px;letter-spacing:.04em;text-transform:uppercase;
  padding:3px 9px;border-radius:4px;background:${E.cream};color:${E.rust};border:1.5px solid ${E.rust}}
.pp-off .pp-name{color:rgba(74,55,38,.6);border-color:rgba(74,55,38,.35);border-style:dashed}
.pp-badge{position:absolute;top:-4px;right:-4px;font-size:18px;line-height:1;width:30px;height:30px;border-radius:50%;
  display:grid;place-items:center;background:${E.cream};border:2px solid ${E.rust}}
.pp-off .pp-badge{border:2px dashed rgba(74,55,38,.35);filter:grayscale(1);opacity:.6}
.pp-stars{position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:12px;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.pp-row{display:flex;gap:16px;flex-wrap:wrap;padding-bottom:10px}
.pp-row .pp-stamp{width:96px;height:96px}
.pp-row .pp-name{font-size:9px;padding:2px 6px}
.pp-row .pp-badge{width:24px;height:24px;font-size:13px}
@media (prefers-reduced-motion:reduce){.pp-stamp{transition:none}}
`;

/** A small random-looking tilt that stays the same for each park. */
const tilt = (id: string) => ((id.charCodeAt(0) * 7 + id.charCodeAt(id.length - 1) * 3) % 17) - 8;
const caseById = (id: string) => CASES.find((c) => c.id === id);

function Stamp({ park, solved, onClick, title }: { park: string; solved: string[]; onClick: () => void; title: string }) {
  const on = solved.length > 0;
  const first = on ? caseById(solved[0]) : undefined;
  const photo = PHOTOS[park];
  const name = PARK_NAMES[park] ?? park;
  return (
    <button
      className={`pp-stamp ${on ? "pp-on" : "pp-off"}`}
      style={{ transform: `rotate(${on ? tilt(park) : 0}deg)` }}
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
      <p className="micro muted" style={{ margin: "10px 0 0" }}>Solve a case to stamp every park it studies. Photos: Wikimedia Commons.</p>
    </section>
  );
}

/** The full passport: every park, stamped or waiting. */
export default function Passport({ onCase, onExplore }: Go) {
  const { progress, got, byPark } = useStamps();
  const [pick, setPick] = useState<string | null>(null);
  const [wish, toggleWish] = useWishlist();
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

      {wish.length > 0 && (
        <section>
          <div className="section-title" style={{ marginBottom: 6 }}>♡ Want to go ({wish.length})</div>
          <p className="small muted" style={{ margin: "0 0 10px" }}>Saved from the Trip Planner. Solve a case there to stamp it.</p>
          <div className="pp-row">
            {wish.map((p) => (
              <Stamp key={p} park={p} solved={got.get(p) ?? []} onClick={() => (byPark.has(p) ? setPick(p) : onExplore(p))}
                title={got.has(p) ? "Stamped and on your list" : "On your want-to-go list"} />
            ))}
          </div>
          <button className="link-btn small" onClick={() => wish.forEach(toggleWish)}>Clear the list</button>
        </section>
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
