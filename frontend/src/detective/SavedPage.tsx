// Saved parks: the want-to-go list, each with its best month for the user's own trip settings.
import { useEffect, useMemo, useState } from "react";
import PageHead from "../brand/PageHead";
import { PARK_NAMES } from "./parkNames";
import { photoOf } from "./photos";
import { useWishlist } from "./wishlist";
import { DEFAULT_STATE, MONTHS, decodeState, fetchTrip, type Trip } from "../planner/trip/tripModel";

const CSS = `
.sv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.sv-card{border:1px solid var(--stone);border-radius:var(--radius);overflow:hidden;background:var(--surface);display:flex;flex-direction:column}
.sv-card img{width:100%;height:130px;object-fit:cover;display:block}
.sv-body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1}
.sv-name{font-family:var(--font-display);font-size:20px;font-weight:400;color:var(--bark);margin:0}
.sv-best{font-size:14px}
.sv-best{color:var(--bark-2)}
.sv-best b{color:var(--bark);font-weight:600}
.sv-acts{display:flex;gap:6px;margin-top:auto;padding-top:6px}
.sv-btn{border:1px solid var(--stone);background:var(--paper);border-radius:999px;padding:5px 12px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;color:var(--bark)}
.sv-btn:hover{border-color:var(--moss);color:var(--moss)}
.sv-x{margin-left:auto;color:var(--text-muted)}
.sv-search{width:100%;max-width:380px;font:inherit;font-size:15px;padding:9px 14px;border-radius:999px;border:1px solid var(--stone);background:var(--paper);color:var(--bark)}
.sv-hits{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
`;

function useYearTrip(): Trip | null {
  const [trip, setTrip] = useState<Trip | null>(null);
  useEffect(() => {
    let s = DEFAULT_STATE;
    try {
      s = decodeState(localStorage.getItem("trip.state")) ?? DEFAULT_STATE;
    } catch {
      /* storage unavailable */
    }
    const ctl = new AbortController();
    // All 12 months: the API ranks each park on its best month for these settings.
    fetchTrip({ ...s, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, [], ctl.signal).then(setTrip).catch(() => undefined);
    return () => ctl.abort();
  }, []);
  return trip;
}

export default function SavedPage({ onPlan, onExplore }: { onPlan: (code: string, month?: number) => void; onExplore: (code: string) => void }) {
  const [wish, toggle] = useWishlist();
  const [find, setFind] = useState("");
  const trip = useYearTrip();
  const byCode = useMemo(() => new Map((trip?.parks ?? []).map((p) => [p.park.code ?? p.park.id, p])), [trip]);
  const t = find.trim().toLowerCase();
  const hits = t
    ? Object.keys(PARK_NAMES).filter((c) => PARK_NAMES[c].toLowerCase().includes(t)).sort((a, b) => PARK_NAMES[a].localeCompare(PARK_NAMES[b])).slice(0, 12)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{CSS}</style>
      <PageHead
        eyebrow="Saved parks"
        title={wish.length ? `${wish.length} park${wish.length === 1 ? "" : "s"} you want to see` : "No saved parks yet"}
        lead="Best month uses your trip settings from Plan."
      />

      <section>
        <input type="search" className="sv-search" placeholder="Find a park to save" aria-label="Find a park to save"
          value={find} onChange={(e) => setFind(e.target.value)} />
        {t && (
          <div className="sv-hits">
            {hits.length === 0 && <span className="small muted">No park matches.</span>}
            {hits.map((c) => (
              <button key={c} className="chip chip-sm" aria-pressed={wish.includes(c)} onClick={() => toggle(c)}>
                {wish.includes(c) ? "♥" : "♡"} {PARK_NAMES[c]}
              </button>
            ))}
          </div>
        )}
      </section>

      {wish.length === 0 ? (
        <p className="small muted">Tap ♡ on any park in Plan, or search above.</p>
      ) : (
        <div className="sv-grid">
          {wish.map((c) => {
            const p = byCode.get(c);
            const photo = photoOf(c);
            return (
              <article key={c} className="sv-card">
                {photo ? <img src={photo.file} alt="" loading="lazy" /> : <div style={{ height: 130, background: "var(--surface-2)" }} />}
                <div className="sv-body">
                  <h3 className="sv-name">{PARK_NAMES[c] ?? c}</h3>
                  {p && <span className="micro muted">{p.park.states.join(", ")}</span>}
                  <span className="sv-best">
                    {!trip ? "…" : !p ? "No trip data" : p.ok
                      ? <>Best for you: <b>{MONTHS[p.best_month - 1]}</b> · {Math.round(p.score ?? 0)}/100</>
                      : "Misses one of your musts all year"}
                  </span>
                  <div className="sv-acts">
                    <button className="sv-btn" onClick={() => onPlan(c, p?.ok ? p.best_month : undefined)}>Plan</button>
                    <button className="sv-btn" onClick={() => onExplore(c)}>Trends</button>
                    <button className="sv-btn sv-x" onClick={() => toggle(c)} aria-label={`Remove ${PARK_NAMES[c] ?? c}`}>✕</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
