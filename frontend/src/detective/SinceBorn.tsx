// "Since you were born" card: the birth year turns each park's confirmed trend into a personal number.
import { useMemo, useState } from "react";
import type { Atlas } from "./model";
import { parkName } from "./games";
import { photoOf } from "./photos";
import { changes, fmtDeg, loadBorn, saveBorn, tally, windowFor, PERIOD, VAR } from "./bornYear";

const NOW = new Date().getFullYear();

export default function SinceBorn({ atlas, science = false, onExplore }: { atlas: Atlas; science?: boolean; onExplore: (park: string) => void }) {
  const [born, setBorn] = useState<number | null>(loadBorn);
  const [draft, setDraft] = useState(born ? String(born) : "");
  const [pick, setPick] = useState("");
  const w = useMemo(() => (born ? windowFor(atlas, born) : null), [atlas, born]);
  const list = useMemo(() => (w ? changes(atlas, w) : []), [atlas, w]);
  const t = useMemo(() => tally(atlas), [atlas]);
  const parks = useMemo(
    () => (atlas.atlas[VAR]?.[PERIOD] ?? []).filter((c) => c.sen != null).map((c) => c.park_id).sort((a, b) => parkName(a).localeCompare(parkName(b))),
    [atlas],
  );

  const year = Number(draft);
  const valid = Number.isInteger(year) && year >= 1900 && year <= NOW;
  const submit = () => {
    if (!valid) return;
    saveBorn(year);
    setBorn(year);
  };

  if (!w) {
    return (
      <section className="card sb">
        <style>{CSS}</style>
        <div className="section-title">🎂 Since you were born</div>
        <h3 className="sb-q">What year were you born?</h3>
        <form className="sb-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input
            className="sb-input" inputMode="numeric" placeholder="e.g. 2008" aria-label="Birth year"
            value={draft} onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <button className="btn" disabled={!valid}>Show me</button>
        </form>
        <p className="micro muted" style={{ margin: 0 }}>Kept only in this browser.</p>
      </section>
    );
  }

  const top = list[0];
  const rest = list.slice(1, 3);
  const mine = pick ? list.find((c) => c.park_id === pick) : undefined;
  const photo = top ? photoOf(top.park_id) : undefined;
  const sci = (c: { sen: number; q: number | null }) =>
    science ? ` · ${c.sen.toFixed(2)} °C/decade × ${(w.years / 10).toFixed(1)} · q ${c.q != null ? c.q.toPrecision(2) : "–"}` : "";

  return (
    <section className="card sb">
      <style>{CSS}</style>
      <div className="sb-head">
        <div className="section-title">🎂 Since you were born</div>
        <button className="sb-link" onClick={() => { saveBorn(null); setBorn(null); }}>Change year</button>
      </div>

      {w.years < 2 || !top || top.c <= 0 ? (
        <p className="sb-big">Too few years since {w.from} to see a change yet.</p>
      ) : (
        <>
          <button className="sb-hero" onClick={() => onExplore(top.park_id)}>
            {photo && <img src={photo.file} alt="" className="sb-img" />}
            <span>
              <span className="sb-big">
                Since {w.from}, <b>{parkName(top.park_id)}</b>'s days got <b className="sb-num">{fmtDeg(top.c, true)}</b> warmer.
              </span>
              <span className="micro muted">{fmtDeg(top.c, false)}{sci(top)}</span>
            </span>
          </button>

          {rest.length > 0 && (
            <ul className="sb-list">
              {rest.map((c) => (
                <li key={c.park_id}>
                  <button className="sb-row" onClick={() => onExplore(c.park_id)}>
                    <span>{parkName(c.park_id)}</span>
                    <b className="sb-num">{fmtDeg(c.c, true)}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="small" style={{ margin: 0 }}>
            <b>{t.warmer}</b> of {t.total} parks got warmer. <b>{t.cooler}</b> cooled. The rest: too close to call.
          </p>

          <label className="sb-pick">
            <span className="small muted">Your park:</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Pick one</option>
              {parks.map((p) => <option key={p} value={p}>{parkName(p)}</option>)}
            </select>
            {pick && (
              <b className="small">
                {mine ? <>{fmtDeg(mine.c, true)} <span className="micro muted">{sci(mine)}</span></> : "No clear change. Normal ups and downs."}
              </b>
            )}
          </label>
        </>
      )}

      <p className="micro muted" style={{ margin: 0 }}>
        Daytime high, whole year. Read from the {atlas.coverage?.first_year ?? 1981}–{w.to} trend line, confirmed trends only.
        {w.clipped && ` Our NASA record starts in ${w.from}.`}
        {science && " Change = Sen's slope × decades; q = FDR-adjusted Mann-Kendall p."}
      </p>
    </section>
  );
}

const CSS = `
.sb { display: flex; flex-direction: column; gap: 14px; }
.sb-head { display: flex; justify-content: space-between; align-items: baseline; }
.sb-q { margin: 0; font-family: var(--font-display); font-size: 24px; color: var(--pine); }
.sb-form { display: flex; gap: 8px; }
.sb-input { width: 120px; font-size: 18px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
.sb-link { background: none; border: 0; color: var(--text-muted); font-size: 12px; cursor: pointer; text-decoration: underline; }
.sb-hero { display: flex; gap: 14px; align-items: center; text-align: left; background: none; border: 0; padding: 0; cursor: pointer; color: var(--text); }
.sb-hero > span { display: flex; flex-direction: column; gap: 4px; }
.sb-img { width: 84px; height: 84px; object-fit: cover; border-radius: 14px; flex: none; }
.sb-big { font-size: 20px; line-height: 1.35; }
.sb-num { color: var(--rust); font-variant-numeric: tabular-nums; }
.sb-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
.sb-row { width: 100%; display: flex; justify-content: space-between; padding: 8px 0; background: none; border: 0; border-bottom: 1px solid var(--border); cursor: pointer; color: var(--text); font-size: 15px; }
.sb-pick { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sb-pick select { padding: 6px 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
`;
