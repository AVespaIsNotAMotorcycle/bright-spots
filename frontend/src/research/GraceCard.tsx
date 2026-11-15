// GRACE / GRACE-FO total water storage for one park (yearly, seasonal cycle removed), with
// the same trend test as the atlas. Imports only plain modules so the atlas can use it.
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VERDICT_LABEL, fmtQ, type Verdict } from "../detective/model";
import { Tip } from "./glossary";

interface Grace {
  meta: { source: string; url: string; resolution_km: number; first_year: number; last_year: number };
  land: boolean;
  cell?: [number, number];
  years?: number[];
  values?: number[];
  n_years?: number;
  sen_per_decade?: number | null;
  p?: number | null;
  q?: number | null;
  verdict: Verdict;
}

const TWS_TIP =
  "GRACE and GRACE-FO are NASA/German satellite pairs that weigh water by measuring tiny changes in Earth's gravity. " +
  "The value is ALL water stored in the region: groundwater, soil moisture, snow, ice, lakes and rivers, in cm of water. " +
  "Each value covers about 300 km, much wider than most parks.";

export default function GraceCard({ parkId, parkName }: { parkId: string; parkName: string }) {
  const [g, setG] = useState<Grace | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setG(null);
    setErr(false);
    fetch(`/api/trends/grace/${parkId}`)
      .then((r) => (r.ok ? (r.json() as Promise<Grace>) : Promise.reject()))
      .then(setG)
      .catch(() => setErr(true));
  }, [parkId]);

  if (err) return null;
  if (!g) return <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading GRACE water storage…</div>;

  const box: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)", marginTop: 16,
  };
  if (!g.land || !g.years?.length) {
    return (
      <div style={box}>
        <b>💧 Water storage (GRACE)</b>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 0" }}>
          {parkName} sits in a mostly ocean GRACE cell, so there is no land water value here.
        </p>
      </div>
    );
  }

  // Insert empty years so the line breaks over the GRACE to GRACE-FO gap.
  const data: { year: number; v: number | null }[] = [];
  for (let y = g.years[0]; y <= g.years[g.years.length - 1]; y++) {
    const i = g.years.indexOf(y);
    data.push({ year: y, v: i >= 0 ? g.values![i] : null });
  }
  const s = g.sen_per_decade ?? null;
  const color = s == null ? "var(--text-muted)" : s < 0 ? "#8b3a1a" : "#3d5a73";
  const vColor = g.verdict === "real" ? "var(--pine)" : g.verdict === "possible" ? "#b7791f" : "var(--text-muted)";

  return (
    <div style={box}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <b>💧 Water storage from GRACE satellites<Tip text={TWS_TIP} /></b>
        <span style={{ fontSize: 12, color: vColor, fontWeight: 700 }}>
          {VERDICT_LABEL[g.verdict] ?? g.verdict}<Tip term={g.verdict === "real" ? "confirmed" : g.verdict === "possible" ? "possible" : "q"} />
        </span>
      </div>
      {s != null && (
        <div style={{ fontSize: 22, fontWeight: 700, color, margin: "6px 0 2px", fontVariantNumeric: "tabular-nums" }}>
          {s > 0 ? "+" : ""}{s.toFixed(1)} cm of water per decade<Tip term="sen" />
        </div>
      )}
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {s != null && (s < 0 ? "The region is losing stored water. " : "The region is gaining stored water. ")}
        p {fmtQ(g.p)}<Tip term="p" /> · q {fmtQ(g.q)}<Tip term="q" /> · {g.n_years} years
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} width={40} unit=" cm" />
          <ReferenceLine y={0} stroke="var(--text-faint)" />
          <Tooltip formatter={(v) => [`${v} cm`, "water vs normal"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
          <Line dataKey="v" stroke={color} strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
        Yearly mean, seasonal cycle removed. The break is the gap between GRACE and GRACE-FO (mid-2017 to mid-2018).
        Region about {g.meta.resolution_km} km wide, so nearby parks can share a value. Source: {g.meta.source}.
      </p>
    </div>
  );
}
