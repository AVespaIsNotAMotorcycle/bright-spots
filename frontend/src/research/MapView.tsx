// National map: every park coloured by its trend for one variable and period.
import { useMemo, useState } from "react";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL, VERDICT_LABEL } from "../detective/model";
import { slopeText, useInsights } from "./lib";
import ParkMap from "./ParkMap";

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const GREY: [number, number, number] = [190, 180, 160];
const UP: [number, number, number] = [139, 58, 26];     // rust: rising
const DOWN: [number, number, number] = [26, 58, 92];    // night sky: falling

export default function MapView({
  atlas,
  initialVar,
  initialPeriod,
  onOpenPark,
}: {
  atlas: Atlas | null;
  initialVar?: string | null;
  initialPeriod?: string | null;
  onOpenPark: (id: string) => void;
}) {
  const { data: insights, error } = useInsights();
  const [v, setV] = useState(initialVar ?? "tmax_c");
  const [per, setPer] = useState(initialPeriod ?? "annual");
  const [onlyReal, setOnlyReal] = useState(false);

  const cells = useMemo(() => {
    const m = new Map<string, { sen: number | null; verdict: string }>();
    for (const c of atlas?.atlas[v]?.[per] ?? []) m.set(c.park_id, { sen: c.sen, verdict: c.verdict });
    return m;
  }, [atlas, v, per]);

  const maxAbs = useMemo(() => {
    let mx = 0;
    for (const c of cells.values()) if (c.sen != null) mx = Math.max(mx, Math.abs(c.sen));
    return mx || 1;
  }, [cells]);

  const counts = useMemo(() => {
    let up = 0, down = 0, none = 0;
    for (const c of cells.values()) {
      if (c.verdict === "real" && c.sen != null) c.sen > 0 ? up++ : down++;
      else none++;
    }
    return { up, down, none };
  }, [cells]);

  if (error) return <p className="error">Could not load park locations: {error}. Run step4_insights.py.</p>;
  if (!atlas || !insights) return <p className="muted">Loading map…</p>;

  const colorOf = (id: string) => {
    const c = cells.get(id);
    if (!c || c.sen == null || c.verdict === "short" || c.verdict === "flat") return mix(GREY, GREY, 0);
    if (onlyReal && c.verdict !== "real") return mix(GREY, GREY, 0);
    const strength = 0.35 + 0.65 * Math.min(1, Math.abs(c.sen) / maxAbs);
    const base = c.sen >= 0 ? UP : DOWN;
    if (c.verdict === "real") return mix(GREY, base, strength);
    if (c.verdict === "possible") return mix(GREY, base, strength * 0.5);
    return mix(GREY, GREY, 0);
  };
  const tip = (id: string) => {
    const c = cells.get(id);
    return c ? `${slopeText(c.sen, v, atlas)} · ${VERDICT_LABEL[c.verdict as keyof typeof VERDICT_LABEL] ?? c.verdict}` : "no data";
  };

  return (
    <div className="panel-stack">
      <div className="card">
        <h2 className="section-title">National trend map</h2>
        <p className="panel-intro">
          One dot per park. Dark rust means a real rise, dark blue a real fall. Pale dots are possible but unproven
          trends. Grey means no clear change.
        </p>
        <div className="row gap-12" style={{ flexWrap: "wrap", margin: "10px 0" }}>
          <label className="field">
            <span className="small muted">Variable</span>
            <select className="text-input" value={v} onChange={(e) => setV(e.target.value)}>
              {Object.entries(atlas.variables).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="small muted">Period</span>
            <select className="text-input" value={per} onChange={(e) => setPer(e.target.value)}>
              {atlas.periods.map((p) => (
                <option key={p} value={p}>{PERIOD_LABEL[p] ?? p}</option>
              ))}
            </select>
          </label>
          <label className="check" style={{ alignSelf: "end" }}>
            <input type="checkbox" checked={onlyReal} onChange={(e) => setOnlyReal(e.target.checked)} /> Only real trends
          </label>
        </div>
        <ParkMap
          parks={insights.parks}
          colorOf={colorOf}
          tip={tip}
          onPick={onOpenPark}
          radius={(id) => (cells.get(id)?.verdict === "real" ? 8 : 5.5)}
        />
        <p className="small" style={{ marginTop: 8 }}>
          <b style={{ color: "var(--rust)" }}>{counts.up}</b> rising · <b style={{ color: "var(--sky)" }}>{counts.down}</b> falling ·{" "}
          <b>{counts.none}</b> no clear change (real = passes the false-discovery-rate test, q &lt; 0.05).
        </p>
      </div>
    </div>
  );
}
