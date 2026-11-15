// National map: every park coloured by its trend for one variable and period.
import { useMemo, useState } from "react";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL, VERDICT_LABEL } from "../detective/model";
import { slopeText, useInsights } from "./lib";
import ParkMap from "./ParkMap";
import { Source, StationStyle, Tip, VAR_TIP } from "./station";

type RGB = [number, number, number];
function lerp(a: RGB, b: RGB, t: number): RGB {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
}
const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
/** Colour ramp through several stops, t in 0..1. */
function ramp(stops: RGB[], t: number): RGB {
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  return lerp(stops[i], stops[i + 1], x - i);
}

const POSSIBLE: RGB = [155, 89, 182];                                // violet: possible, not proven
const NONE: RGB = [150, 170, 140];                                   // sage: no clear change
const UP: RGB[] = [[255, 214, 102], [250, 140, 40], [214, 60, 30], [140, 20, 40]];   // gold > orange > red > maroon
const DOWN: RGB[] = [[150, 220, 220], [60, 160, 210], [30, 90, 190], [40, 40, 120]]; // aqua > blue > indigo
const rampCss = (stops: RGB[]) => `linear-gradient(90deg, ${stops.map(css).join(",")})`;

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
  const [topo, setTopo] = useState(true);

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
      if (c.verdict === "real" && c.sen != null) {
        if (c.sen > 0) up++;
        else down++;
      }
      else none++;
    }
    return { up, down, none };
  }, [cells]);

  if (error) return <p className="error">Could not load park locations: {error}. Run step4_insights.py.</p>;
  if (!atlas || !insights) return <p className="muted">Loading map…</p>;

  const colorOf = (id: string) => {
    const c = cells.get(id);
    if (!c || c.sen == null || c.verdict === "short" || c.verdict === "flat") return css(NONE);
    const t = Math.min(1, Math.abs(c.sen) / maxAbs);
    const stops = c.sen >= 0 ? UP : DOWN;
    if (c.verdict === "real") return css(ramp(stops, 0.25 + 0.75 * t));
    if (c.verdict === "possible") return css(POSSIBLE);
    return css(NONE);
  };
  const ringsOf = (id: string) => {
    const c = cells.get(id);
    if (!c || c.verdict !== "real" || c.sen == null) return 0;
    const t = Math.abs(c.sen) / maxAbs;
    return t >= 0.75 ? 3 : t >= 0.5 ? 2 : 1;
  };
  const tip = (id: string) => {
    const c = cells.get(id);
    return c ? `${slopeText(c.sen, v, atlas)} · ${VERDICT_LABEL[c.verdict as keyof typeof VERDICT_LABEL] ?? c.verdict}` : "no data";
  };

  return (
    <div className="panel-stack">
      <div className="card">
        <StationStyle />
        <h2 className="section-title">Topo trend map</h2>
        <p className="panel-intro">
          Each park is drawn with its real boundary. Warm colours (gold to maroon) mean a real rise, cool colours
          (aqua to indigo) a real fall. Violet means a possible but unproven trend (it passes p &lt; 0.05 but not the multiple-testing
          test). Sage green means no clear change. Big parks show as shapes, small ones as dots.
        </p>
        <div className="row gap-12" style={{ flexWrap: "wrap", margin: "10px 0" }}>
          <label className="field">
            <span className="small muted">Variable<Tip term={VAR_TIP[v]} /></span>
            <select className="text-input" value={v} onChange={(e) => setV(e.target.value)}>
              {Object.entries(atlas.variables).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="small muted">Period<Tip term="seasons" /></span>
            <select className="text-input" value={per} onChange={(e) => setPer(e.target.value)}>
              {atlas.periods.map((p) => (
                <option key={p} value={p}>{PERIOD_LABEL[p] ?? p}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="check" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={topo} onChange={(e) => setTopo(e.target.checked)} /> Topo rings (confirmed trends only)
        </label>
        <ParkMap
          parks={insights.parks}
          colorOf={colorOf}
          tip={tip}
          onPick={onOpenPark}
          radius={(id) => (cells.get(id)?.verdict === "real" ? 8 : 5.5)}
          rings={topo ? ringsOf : undefined}
        />
        {topo && (
          <p className="micro muted" style={{ margin: "6px 0 0" }}>
            Rings around a dot: 1 = confirmed trend, 2 = at least half the biggest change on this map,
            3 (pulsing) = at least three quarters of it.
          </p>
        )}
        <div className="row small" style={{ gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <span>falling</span>
          <span style={{ width: 130, height: 12, borderRadius: 6, background: rampCss([...DOWN].reverse()) }} />
          <span style={{ width: 14, height: 12, borderRadius: 6, background: css(NONE) }} title="no clear change" />
          <span className="muted">no change</span>
          <span style={{ width: 14, height: 12, borderRadius: 6, background: css(POSSIBLE) }} title="possible, not proven" />
          <span className="muted">possible</span>
          <span style={{ width: 130, height: 12, borderRadius: 6, background: rampCss(UP) }} />
          <span>rising</span>
          <span className="muted">(bigger change = stronger colour; scale is per map)</span>
        </div>
        <p className="small" style={{ marginTop: 8 }}>
          <b style={{ color: "#d63c1e" }}>{counts.up}</b> rising · <b style={{ color: "#1e5abe" }}>{counts.down}</b> falling ·{" "}
          <b>{counts.none}</b> no clear change (real = passes the false-discovery-rate test, q &lt; 0.05)<Tip term="q" />.
        </p>
        <Source atlas={atlas} />
      </div>
    </div>
  );
}
