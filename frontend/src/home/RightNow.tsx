import { useEffect, useState } from "react";
import { PHOTOS } from "../detective/photos";
import { DEFAULT_STATE, fetchTrip, MONTHS_LONG, type TripPark } from "../planner/trip/tripModel";

/**
 * Three top parks for the current month, from the same /api/parks/trip call the planner uses
 * (default feel: mild to warm, few bugs). Scores are the planner's own; nothing is invented.
 * Shows a quiet placeholder while loading and hides itself on error or when there is no match.
 */
export default function RightNow({ month, onOpen }: { month: number; onOpen: (code: string | null, id: string) => void }) {
  const [picks, setPicks] = useState<TripPark[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "hidden">("loading");

  useEffect(() => {
    const ctl = new AbortController();
    fetchTrip({ ...DEFAULT_STATE, months: [month] }, [], ctl.signal)
      .then((t) => {
        const top = t.parks
          .filter((p) => p.ok && p.score != null)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 3);
        setPicks(top);
        setState(top.length ? "ok" : "hidden");
      })
      .catch(() => !ctl.signal.aborted && setState("hidden"));
    return () => ctl.abort();
  }, [month]);

  if (state === "hidden") return null;
  return (
    <section className="hm-sec" aria-label="Right now">
      <h2 className="hm-h2">Right now in {MONTHS_LONG[month - 1]}</h2>
      {state === "loading" || !picks ? (
        <div className="hm-picks" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="hm-skel" aria-hidden />)}
        </div>
      ) : (
        <div className="hm-picks">
          {picks.map((p) => {
            const photo = p.park.code ? PHOTOS[p.park.code] : undefined;
            return (
              <button key={p.park.id} className="hm-pick" onClick={() => onOpen(p.park.code, p.park.id)}>
                {photo && <img src={photo.file} alt={`${p.park.short} National Park`} loading="lazy" />}
                <span className="hm-pick-name">{p.park.short}</span>
                <span className="hm-muted">Score {Math.round(p.score ?? 0)} of 100</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
