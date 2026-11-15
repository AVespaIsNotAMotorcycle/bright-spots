// Twin finder: parks whose whole pattern of change looks most like the chosen park.
import { useMemo } from "react";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL } from "../detective/model";
import { ParkSelect } from "./Compare";
import { findTwins, type Twin } from "./insights";
import { useInsights, varLabel } from "./lib";
import { E, Source, StationStyle, Tag } from "./station";

function Meter({ score }: { score: number }) {
  const pct = Math.round(((score + 1) / 2) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: E.sand, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: score >= 0 ? E.moss : E.clay }} />
      </div>
      <b className="small" style={{ color: E.bark, minWidth: 64, textAlign: "right" }}>{score > 0 ? "+" : ""}{score.toFixed(2)}</b>
    </div>
  );
}

export default function Twins({
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
  const res = useMemo(() => (atlas ? findTwins(atlas, me) : null), [atlas, me]);
  if (!atlas || !ins || !res) return <p className="muted">Loading…</p>;
  const name = (id: string) => ins.parks.find((p) => p.id === id)?.name ?? id;
  const feat = (t: Twin) =>
    t.shared.map((f) => `${varLabel(atlas, f.variable)} (${PERIOD_LABEL[f.period] ?? f.period})`).join(", ");

  const card = (t: Twin, i: number, opposite = false) => (
    <div key={t.park} className="st-tile" style={{ cursor: "default", ["--tile" as string]: opposite ? E.clay : E.moss }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <b style={{ fontFamily: "var(--font-display)", fontSize: 17, color: E.pine }}>{opposite ? "🪞 " : `#${i + 1} `}{name(t.park)}</b>
      </div>
      <div style={{ margin: "8px 0" }}><Meter score={t.score} /></div>
      <div className="small" style={{ color: E.bark, minHeight: 34 }}>
        {opposite
          ? "Changes most unlike this park."
          : t.shared.length ? <>Both stand out on: {feat(t)}</> : "Similar overall, no single standout."}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button className="st-btn" onClick={() => onCompare(me, t.park)}>⚖ Head-to-head</button>
        <button className="st-btn ghost" onClick={() => onPark(t.park)}>Find its twins</button>
      </div>
    </div>
  );

  return (
    <div className="panel-stack">
      <StationStyle />
      <section className="st-card" style={{ padding: 18 }}>
        <Tag>👯 Twin finder</Tag>
        <p className="small" style={{ color: E.bark, margin: "8px 0 12px" }}>
          Each park gets a fingerprint: its trend in every measure, for the whole year and each season.
          Twins have the most similar fingerprints. The score is cosine similarity: +1 identical, 0 unrelated, −1 opposite.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <ParkSelect label="Park" value={me} parks={ins.parks} onChange={onPark} />
          <button className="st-btn ghost" onClick={() => onOpenPark(me)}>Open in atlas →</button>
        </div>
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {res.twins.map((t, i) => card(t, i))}
      </div>
      {res.opposite && (
        <>
          <Tag>Least alike</Tag>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {card(res.opposite, 0, true)}
          </div>
        </>
      )}
      <Source extra="Fingerprints use Sen's slopes from the atlas, scaled across parks. Similar trends do not mean the same cause." />
    </div>
  );
}
