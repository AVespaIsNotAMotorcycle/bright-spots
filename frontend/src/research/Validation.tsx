// Our POWER temperature trends against NOAA GHCN-Daily stations.
import { useEffect, useState } from "react";

interface Cmp {
  station: { slope: number; p: number };
  power: { slope: number; p: number };
  diff: number;
  r: number;
  bias_c: number;
  n: number;
  grade: "good" | "partial" | "differs";
}
interface Row {
  park: string;
  name: string;
  station: string;
  station_name: string;
  distance_km: number;
  station_elev_m: number;
  tmax_c: Cmp;
  tmin_c: Cmp;
}
interface Val {
  grading: string;
  parks: Row[];
}

const COLOR = { good: "var(--pine)", partial: "#b7791f", differs: "var(--rust)" };
const sgn = (x: number) => (x > 0 ? "+" : "") + x;

export default function Validation() {
  const [d, setD] = useState<Val | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch("/api/trends/validation")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setErr(true));
  }, []);
  if (err)
    return (
      <div className="card">
        <p className="muted">No station check yet. Run scripts/step5_noaa_validation.py.</p>
      </div>
    );
  if (!d) return null;
  const all = d.parks.flatMap((p) => [p.tmax_c, p.tmin_c]);
  const n = (g: string) => all.filter((x) => x.grade === g).length;
  const cell = (c: Cmp) => (
    <td style={{ color: COLOR[c.grade] }}>
      <b>{c.grade}</b>
      <br />
      <span className="micro">
        station {sgn(c.station.slope)} vs ours {sgn(c.power.slope)} °C/dec, r={c.r}, bias {sgn(c.bias_c)} °C
      </span>
    </td>
  );
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Check against NOAA weather stations</h3>
      <p className="small">
        {d.parks.length} parks, nearest long-record station within 40 km (NOAA GHCN-Daily). Of {all.length} comparisons,{" "}
        <b style={{ color: COLOR.good }}>{n("good")} good</b>, <b style={{ color: COLOR.partial }}>{n("partial")} partial</b>,{" "}
        <b style={{ color: COLOR.differs }}>{n("differs")} differ</b>. Good means r ≥ 0.7 and slopes within 0.2 °C per
        decade. Partial means the same direction only. Stations sit at different spots and heights than the 50 km POWER
        cell, so some gap is expected. Treat park-level POWER slopes as a guide, and prefer the stations where they
        disagree.
      </p>
      <div className="table-wrap">
        <table className="detail-table" style={{ fontSize: 12 }}>
          <thead>
            <tr><th>Park</th><th>Station</th><th>Daytime high</th><th>Night low</th></tr>
          </thead>
          <tbody>
            {d.parks.map((p) => (
              <tr key={p.park}>
                <td>{p.name}</td>
                <td>
                  {p.station_name}
                  <br />
                  <span className="micro muted">{p.distance_km} km, {Math.round(p.station_elev_m)} m</span>
                </td>
                {cell(p.tmax_c)}
                {cell(p.tmin_c)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
