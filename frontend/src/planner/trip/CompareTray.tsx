// Compare up to 3 parks side by side; the best value in each row gets a trophy.
import { useState } from "react";
import { photoOf } from "../../detective/photos";
import { EMOJI, LABEL, MONTHS, reasonText, type TripPark, type Unit } from "./tripModel";

export const MAX_COMPARE = 3;

export default function CompareTray({ parks, unit, onRemove, onClear }: {
  parks: TripPark[]; unit: Unit; onRemove: (code: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!parks.length) return null;
  const keys = [...new Set(parks.flatMap((p) => p.reasons.map((r) => r.key)))];
  const best = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v != null);
    return xs.length > 1 ? Math.max(...xs) : null;
  };
  const rows: { label: string; cells: { text: string; score: number | null }[] }[] = [
    { label: "⭐ Score", cells: parks.map((p) => ({ text: String(Math.round(p.score ?? 0)), score: p.score })) },
    { label: "📅 Best month", cells: parks.map((p) => ({ text: MONTHS[p.best_month - 1], score: null })) },
    ...keys.map((k) => ({
      label: `${EMOJI(k)} ${LABEL(k)}`,
      cells: parks.map((p) => {
        const r = p.reasons.find((x) => x.key === k);
        return { text: r ? reasonText(r, unit) : "–", score: r?.score ?? null };
      }),
    })),
    { label: "⏳ 2050 change", cells: parks.map((p) => ({ text: p.change_2050 == null ? "–" : `${p.change_2050 > 0 ? "+" : ""}${Math.round(p.change_2050)}`, score: p.change_2050 })) },
  ];
  return (
    <>
      {open && (
        <section className="card" aria-label="Compare parks" style={{ overflowX: "auto" }}>
          <div className="tp-h">Side by side <small><button className="link-btn small" onClick={() => setOpen(false)}>hide</button></small></div>
          <table className="tp-cmp">
            <thead>
              <tr>
                <th />
                {parks.map((p) => {
                  const ph = photoOf(p.park.code);
                  return (
                    <th key={p.park.id}>
                      {ph && <img src={ph.file} alt="" style={{ width: "100%", maxWidth: 160, height: 70, objectFit: "cover", borderRadius: 10, display: "block" }} />}
                      {p.park.short}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const top = best(r.cells.map((c) => c.score));
                return (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {r.cells.map((c, i) => <td key={i} className={top != null && c.score === top ? "win" : undefined}>{c.text}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      <div className="tp-tray" role="region" aria-label="Compare tray">
        <b>🗂 Compare</b>
        {parks.map((p) => (
          <span key={p.park.id} className="tp-badge" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>
            {p.park.short} <button aria-label={`Remove ${p.park.short}`} onClick={() => onRemove(p.park.id)}
              style={{ border: 0, background: "none", color: "#fff", cursor: "pointer" }}>✕</button>
          </span>
        ))}
        <span className="micro" style={{ opacity: 0.7 }}>{parks.length}/{MAX_COMPARE}</span>
        <span style={{ flex: 1 }} />
        <button className="tp-act" onClick={() => setOpen((o) => !o)} disabled={parks.length < 2}>{open ? "Hide table" : parks.length < 2 ? "Add one more" : "Compare now"}</button>
        <button className="tp-act" onClick={onClear}>Clear</button>
      </div>
    </>
  );
}
