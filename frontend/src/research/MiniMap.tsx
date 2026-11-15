// Small static map: lower-48 outline with the chosen parks lit up.
import { useEffect, useState } from "react";
import type { ParkMeta } from "./lib";

type Ring = number[][];
interface Feature {
  properties: { name: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] };
}

let cache: Promise<Feature[]> | null = null;
const loadStates = () => (cache ??= fetch("/us-states.json").then((r) => r.json()).then((d) => d.features as Feature[]));

const [LON0, LON1, LAT0, LAT1] = [-125, -66.5, 24.5, 49.5];
const COS = Math.cos((37 * Math.PI) / 180);
const SPAN_X = (LON1 - LON0) * COS;
const SPAN_Y = LAT1 - LAT0;
const W = 300;
const H = Math.round((W * SPAN_Y) / SPAN_X);
const proj = (lon: number, lat: number): [number, number] => [((lon - LON0) * COS * W) / SPAN_X, ((LAT1 - lat) * H) / SPAN_Y];

const inLower48 = (p: ParkMeta) => p.lon > -130 && p.lon < -60 && p.lat > 24 && p.lat < 50 && !(p.state ?? "").includes("Alaska");

export default function MiniMap({ parks, ids, color }: { parks: ParkMeta[]; ids: string[]; color: string }) {
  const [paths, setPaths] = useState<string[]>([]);
  useEffect(() => {
    loadStates()
      .then((fs) =>
        setPaths(
          fs
            .filter((f) => !["Alaska", "Hawaii", "Puerto Rico"].includes(f.properties.name))
            .map((f) => {
              const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
              return polys
                .map((poly) =>
                  poly
                    .map((ring) => ring.map((c, i) => `${i ? "L" : "M"}${proj(c[0], c[1]).map((n) => n.toFixed(1)).join(" ")}`).join("") + "Z")
                    .join(""),
                )
                .join("");
            }),
        ),
      )
      .catch(() => setPaths([]));
  }, []);

  const mine = parks.filter((p) => ids.includes(p.id));
  const away = mine.filter((p) => !inLower48(p));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", borderRadius: 8, background: "#cfe4ef" }}
        role="img" aria-label={`Map with ${mine.length} parks highlighted`}>
        {paths.map((d, i) => <path key={i} d={d} fill="#f1ead6" stroke="#fff" strokeWidth={0.6} />)}
        {parks.filter(inLower48).map((p) => {
          const [x, y] = proj(p.lon, p.lat);
          const on = ids.includes(p.id);
          return on ? (
            <circle key={p.id} cx={x} cy={y} r={4.5} fill={color} stroke="#26331f" strokeWidth={1} />
          ) : (
            <circle key={p.id} cx={x} cy={y} r={1.6} fill="#b9ae93" />
          );
        })}
      </svg>
      {away.length > 0 && (
        <p className="micro muted" style={{ margin: "4px 0 0" }}>
          Also off this map: {away.map((p) => p.name).join(", ")}
        </p>
      )}
    </div>
  );
}
