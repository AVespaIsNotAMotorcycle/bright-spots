// Analog sites: parks whose climate trends match a park's, optionally in the same EPA ecoregion,
// with a feature-by-feature table of what matches and what differs, and each park's baseline climate.
import { useEffect, useMemo, useState } from "react";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL } from "../detective/model";
import { ParkSelect } from "./Compare";
import { analogSites, featureRows, type EcoLevel } from "./insights";
import { findRow, slopeText, useInsights, usePark, varLabel } from "./lib";
import { E, Source, StationStyle, Tag, Tip, VAR_TIP } from "./station";

const LEVELS: { id: EcoLevel; label: string }[] = [
  { id: "any", label: "Any ecoregion" },
  { id: "l1", label: "Same Level I (broad)" },
  { id: "l2", label: "Same Level II" },
  { id: "l3", label: "Same Level III (fine)" },
];

const ECO_TIP =
  "EPA ecoregions group land by similar ecosystems (vegetation, soils, landform, climate). Level I is broadest (~15 in North America), " +
  "Level III finest. We use the ecoregion at each park's centre point. EPA covers the lower 48 only, so Alaska, Hawaii, " +
  "the territories and some coastal parks have none.";

function Score({ s }: { s: number }) {
  const pct = Math.round(((s + 1) / 2) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: E.sand, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: s >= 0 ? E.moss : E.clay }} />
      </div>
      <b className="small" style={{ color: E.bark, minWidth: 44, textAlign: "right" }}>{s > 0 ? "+" : ""}{s.toFixed(2)}</b>
    </div>
  );
}

interface KClass { code: string; name: string }
const KOPPEN_TIP =
  "Köppen-Geiger climate class at the park's centre (0.5° grid), 1991–2020, and the projection for 2041–2070 " +
  "under the middle emissions path SSP2-4.5. Source: Beck et al. 2023, Scientific Data. Not NASA data.";
const kCache = new Map<string, Promise<{ now: KClass | null; future: KClass | null } | null>>();

function useKoppen(lat?: number, lon?: number) {
  const [k, setK] = useState<{ now: KClass | null; future: KClass | null } | null>(null);
  useEffect(() => {
    if (lat == null || lon == null) return;
    const key = `${lat},${lon}`;
    let p = kCache.get(key);
    if (!p) {
      p = fetch(`/api/datasets/koppen/lookup?lat=${lat}&lon=${lon}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      kCache.set(key, p);
    }
    let live = true;
    p.then((x) => live && setK(x));
    return () => { live = false; };
  }, [lat, lon]);
  return k;
}

export function Koppen({ lat, lon }: { lat?: number; lon?: number }) {
  const k = useKoppen(lat, lon);
  if (!k?.now) return null;
  return (
    <span className="micro" style={{ color: E.bark }}>
      Köppen <b>{k.now.code}</b> {k.now.name.toLowerCase()}
      {k.future && k.future.code !== k.now.code ? <> → <b>{k.future.code}</b> by 2041–70</> : null}
      <Tip text={KOPPEN_TIP} />
    </span>
  );
}

function Baseline({ id }: { id: string }) {
  const { data } = usePark(id);
  const t = findRow(data, "tmax_c", "annual");
  const lo = findRow(data, "tmin_c", "annual");
  const p = findRow(data, "prcp_mm", "annual");
  const f = (c: number | null | undefined) => (c == null ? "–" : `${(c * 1.8 + 32).toFixed(0)}°F`);
  if (!data) return <span className="micro" style={{ color: E.moss }}>loading…</span>;
  return (
    <span className="micro" style={{ color: E.bark }}>
      Avg high {f(t?.mean)} · low {f(lo?.mean)} · {p?.mean != null ? `${Math.round(p.mean)} mm/yr` : "–"}
    </span>
  );
}

export default function Analogs({
  atlas, park, onPark, onCompare, onOpenPark,
}: {
  atlas: Atlas | null;
  park?: string | null;
  onPark: (id: string) => void;
  onCompare: (a: string, b: string) => void;
  onOpenPark: (id: string) => void;
}) {
  const { data: ins } = useInsights();
  const me = park ?? "zion";
  const [level, setLevel] = useState<EcoLevel>("any");
  const [sel, setSel] = useState<string | null>(null);
  const eco = ins?.families.ecoregions?.parks ?? null;
  const list = useMemo(() => (atlas ? analogSites(atlas, me, eco, level) : []), [atlas, me, eco, level]);
  const chosen = list.find((t) => t.park === sel) ?? list[0];
  const rows = useMemo(() => (atlas && chosen ? featureRows(atlas, me, chosen.park) : []), [atlas, me, chosen]);
  const sen = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const [v, byP] of Object.entries(atlas?.atlas ?? {}))
      for (const [p, cells] of Object.entries(byP)) for (const c of cells) m.set(`${c.park_id}|${v}|${p}`, c.sen);
    return m;
  }, [atlas]);

  if (!atlas || !ins) return <p className="muted">Loading…</p>;
  const name = (id: string) => ins.parks.find((p) => p.id === id)?.name ?? id;
  const pos = (id: string) => ins.parks.find((p) => p.id === id);
  const myEco = eco?.[me];
  const ecoLine = (id: string) => {
    const e = eco?.[id];
    return e?.l3 ?? e?.l2 ?? e?.l1 ?? "no EPA ecoregion";
  };
  const sameBadges = (id: string) =>
    (["l1", "l2", "l3"] as const).filter((l) => myEco?.[l] && eco?.[id]?.[l] === myEco[l]).map((l) => l.toUpperCase());

  return (
    <div className="panel-stack">
      <StationStyle />
      <section className="st-card" style={{ padding: 18 }}>
        <Tag>🌐 Analog sites</Tag>
        <p className="small" style={{ color: E.bark, margin: "8px 0 12px" }}>
          Parks whose climate has changed the most like this one, for every measure and season since 1981
          <Tip term="twin" />. Use them as comparison or replicate sites. Filter by ecoregion<Tip text={ECO_TIP} /> to keep
          only parks with similar ecosystems.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <ParkSelect label="Focal park" value={me} parks={ins.parks} onChange={(id) => { setSel(null); onPark(id); }} />
          <label className="field">
            <span className="small muted">Ecoregion filter<Tip text={ECO_TIP} /></span>
            <select className="text-input" value={level} onChange={(e) => { setSel(null); setLevel(e.target.value as EcoLevel); }}>
              {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <button className="st-btn ghost" onClick={() => onOpenPark(me)}>Open in atlas →</button>
        </div>
        <p className="micro" style={{ margin: "10px 0 0", color: E.bark }}>
          <b>{name(me)}</b>: {myEco?.l1 ? `${myEco.l1.toLowerCase()} › ${(myEco.l2 ?? "–").toLowerCase()} › ${myEco.l3 ?? "–"}` : "no EPA ecoregion (outside the lower 48 coverage)"}
          {" · "}<Baseline id={me} />{" · "}<Koppen lat={pos(me)?.lat} lon={pos(me)?.lon} />
        </p>
      </section>

      {list.length === 0 && (
        <p className="small" style={{ color: E.bark }}>
          {level !== "any" && !myEco?.[level as "l1"]
            ? `${name(me)} has no EPA ecoregion at this level, so it cannot be filtered. Choose "Any ecoregion".`
            : "No other park shares this ecoregion. Try a broader level."}
        </p>
      )}

      {list.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
          {list.map((t, i) => {
            const on = chosen?.park === t.park;
            return (
              <button key={t.park} className="st-tile" onClick={() => setSel(t.park)}
                style={{ ["--tile" as string]: on ? E.pine : E.sage, outline: on ? `2px solid ${E.pine}` : undefined }}>
                <b style={{ fontFamily: "var(--font-display)", fontSize: 16, color: E.pine }}>#{i + 1} {name(t.park)}</b>
                <div style={{ margin: "8px 0 6px" }}><Score s={t.score} /></div>
                <div className="micro" style={{ color: E.bark }}>{ecoLine(t.park)}</div>
                <div><Koppen lat={pos(t.park)?.lat} lon={pos(t.park)?.lon} /></div>
                <div style={{ display: "flex", gap: 4, marginTop: 6, minHeight: 18 }}>
                  {sameBadges(t.park).map((b) => (
                    <span key={b} className="micro" style={{ background: E.sand, border: `1px solid ${E.sage}`, borderRadius: 8, padding: "0 6px" }}>
                      same {b}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {chosen && (
        <section className="st-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Tag>What matches, what differs</Tag>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="st-btn" onClick={() => onCompare(me, chosen.park)}>🥊 Head-to-head</button>
              <button className="st-btn ghost" onClick={() => { setSel(null); onPark(chosen.park); }}>Use as focal park</button>
            </div>
          </div>
          <p className="micro" style={{ color: E.bark, margin: "8px 0" }}>
            <b>{name(chosen.park)}</b>: <Baseline id={chosen.park} /> · <Koppen lat={pos(chosen.park)?.lat} lon={pos(chosen.park)?.lon} />. Same trends do not mean the same baseline climate or the same cause.
          </p>
          <div className="table-wrap" style={{ maxHeight: 380, overflowY: "auto" }}>
            <table className="detail-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Measure</th>
                  <th>{name(me)}</th>
                  <th>{name(chosen.park)}</th>
                  <th>Gap<Tip text="Difference in each park's position among all parks (z-scores). Under 0.5 = alike, over 1.5 = clearly different." /></th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const alike = r.gap != null && r.gap < 0.5;
                  const differ = r.gap != null && r.gap > 1.5;
                  return (
                    <tr key={r.variable + r.period}>
                      <td style={{ textAlign: "left" }}>
                        {varLabel(atlas, r.variable)}<Tip term={VAR_TIP[r.variable]} /> · {PERIOD_LABEL[r.period] ?? r.period}
                      </td>
                      <td>{slopeText(sen.get(`${me}|${r.variable}|${r.period}`), r.variable, atlas)}</td>
                      <td>{slopeText(sen.get(`${chosen.park}|${r.variable}|${r.period}`), r.variable, atlas)}</td>
                      <td>{r.gap != null ? r.gap.toFixed(2) : "–"}</td>
                      <td style={{ color: alike ? E.pine : differ ? E.rust : E.moss, fontWeight: 600 }}>
                        {alike ? "alike" : differ ? "differs" : "close"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Source atlas={atlas} extra="Ecoregions: US EPA Level I–III, at each park's centre point." />
        </section>
      )}
    </div>
  );
}
