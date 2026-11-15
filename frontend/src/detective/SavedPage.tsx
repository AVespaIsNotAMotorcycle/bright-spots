// Saved parks: the want-to-go list, each with its best month for the user's own trip settings.
import { useEffect, useMemo, useState } from "react";
import PageHead from "../brand/PageHead";
import { SAVED_NAMES, parkKey, trendCode } from "./parkKey";
import { useWishlist } from "./wishlist";
import { DEFAULT_STATE, decodeState, fetchTrip, type Trip, type Unit } from "../planner/trip/tripModel";
import { trendTag } from "../planner/whatChanged";
import { loadAtlas, type Atlas } from "../atlas/model";
import Postcard from "../saved/Postcard";

const CSS = `
.sv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:16px}
.sv-btn{border:1px solid var(--stone);background:var(--paper);border-radius:999px;padding:5px 12px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;color:var(--bark)}
.sv-btn:hover{border-color:var(--moss);color:var(--moss)}
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

export default function SavedPage({ unit, onPlan, onExplore }: { unit: Unit; onPlan: (code: string, month?: number) => void; onExplore: (code: string) => void }) {
  const [wish, toggle] = useWishlist();
  const [find, setFind] = useState("");
  const trip = useYearTrip();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  useEffect(() => {
    loadAtlas().then(setAtlas).catch(() => undefined);
  }, []);
  const byCode = useMemo(() => new Map((trip?.parks ?? []).map((p) => [parkKey(p.park), p])), [trip]);
  const t = find.trim().toLowerCase();
  const hits = t
    ? Object.keys(SAVED_NAMES).filter((c) => SAVED_NAMES[c].toLowerCase().includes(t)).sort((a, b) => SAVED_NAMES[a].localeCompare(SAVED_NAMES[b])).slice(0, 12)
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
                {wish.includes(c) ? "♥" : "♡"} {SAVED_NAMES[c]}
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
            return (
              <Postcard
                key={c}
                name={SAVED_NAMES[c] ?? c}
                p={p}
                trip={trip}
                unit={unit}
                trend={p ? trendTag(atlas, p.park.id, p.best_month, unit === "F") : null}
                npsCode={p?.park.code ?? null}
                actions={
                  <>
                    <button className="sv-btn" onClick={() => onPlan(c === "kica" ? "kings-canyon" : c, p?.ok ? p.best_month : undefined)}>Plan</button>
                    <button className="sv-btn" onClick={() => onExplore(trendCode(c))}>Trends</button>
                  </>
                }
                onRemove={() => toggle(c)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
