// Dot map of the parks over US state outlines, with Alaska and Hawaii insets.
import { useEffect, useMemo, useState } from "react";
import type { ParkMeta } from "./lib";

type Pos = [number, number];
type Ring = number[][];
interface Feature {
  properties: { name: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] };
}

const W = 1000;
const H = 600;

interface Region {
  lon0: number; lon1: number; lat0: number; lat1: number; // lon0 west, lat1 north
  x: number; y: number; w: number; h: number;             // target box in the svg
}

const CONUS: Region = { lon0: -125, lon1: -66.5, lat0: 24.5, lat1: 49.5, x: 0, y: 0, w: 1000, h: 543 };
const ALASKA: Region = { lon0: -168, lon1: -130, lat0: 54, lat1: 71.5, x: 8, y: 410, w: 250, h: 185 };
const HAWAII: Region = { lon0: -160.5, lon1: -154.5, lat0: 18.8, lat1: 22.4, x: 275, y: 505, w: 140, h: 90 };

function project(lon: number, lat: number, r: Region): Pos {
  const cosLat = Math.cos((((r.lat0 + r.lat1) / 2) * Math.PI) / 180);
  const spanX = (r.lon1 - r.lon0) * cosLat;
  const spanY = r.lat1 - r.lat0;
  const s = Math.min(r.w / spanX, r.h / spanY);
  const offX = r.x + (r.w - spanX * s) / 2;
  const offY = r.y + (r.h - spanY * s) / 2;
  return [offX + (lon - r.lon0) * cosLat * s, offY + (r.lat1 - lat) * s];
}

function regionOf(p: ParkMeta): "ak" | "hi" | "conus" | "other" {
  const st = p.state ?? "";
  if (st.includes("Alaska")) return "ak";
  if (st.includes("Hawaii")) return "hi";
  if (p.lon > -130 && p.lon < -60 && p.lat > 24 && p.lat < 50) return "conus";
  return "other";
}

function pathOf(f: Feature, r: Region, dropEast = false): string {
  const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
  let d = "";
  for (const poly of polys) {
    for (const ring of poly) {
      if (dropEast && ring.some((c) => c[0] > 0)) continue; // Aleutians that cross 180°
      d +=
        ring
          .map((c, i) => {
            const [x, y] = project(c[0], c[1], r);
            return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join("") + "Z";
    }
  }
  return d;
}

interface Props {
  parks: ParkMeta[];
  colorOf: (id: string) => string;
  tip: (id: string) => string;
  onPick?: (id: string) => void;
  selected?: string[];
  radius?: (id: string) => number;
}

export default function ParkMap({ parks, colorOf, tip, onPick, selected = [], radius }: Props) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    fetch("/us-states.json")
      .then((r) => r.json())
      .then((d: { features: Feature[] }) => setFeatures(d.features))
      .catch(() => setFeatures([]));
  }, []);

  const outlines = useMemo(
    () =>
      features
        .filter((f) => f.properties.name !== "Puerto Rico")
        .map((f) => {
          const n = f.properties.name;
          const [r, drop] = n === "Alaska" ? [ALASKA, true] : n === "Hawaii" ? [HAWAII, false] : [CONUS, false];
          return { name: n, d: pathOf(f, r as Region, drop as boolean) };
        }),
    [features],
  );

  const placed = useMemo(() => {
    let other = 0;
    return parks.map((p) => {
      const reg = regionOf(p);
      let pos: Pos;
      if (reg === "ak") pos = project(p.lon, p.lat, ALASKA);
      else if (reg === "hi") pos = project(p.lon, p.lat, HAWAII);
      else if (reg === "conus") pos = project(p.lon, p.lat, CONUS);
      else pos = [470 + 55 * other++, 565];
      return { p, pos, reg };
    });
  }, [parks]);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img"
        aria-label="Map of US national parks">
        <rect x={0} y={0} width={W} height={H} fill="var(--sky-tint)" rx={10} />
        {outlines.map((o) => (
          <path key={o.name} d={o.d} fill="var(--surface)" stroke="var(--border)" strokeWidth={0.8} />
        ))}
        <text x={10} y={402} fontSize={11} fill="var(--text-faint)">Alaska</text>
        <text x={275} y={500} fontSize={11} fill="var(--text-faint)">Hawaiʻi</text>
        <text x={440} y={540} fontSize={11} fill="var(--text-faint)">Territories</text>
        {placed.map(({ p, pos }) => {
          const sel = selected.includes(p.id);
          const r0 = radius?.(p.id) ?? 6;
          return (
            <circle
              key={p.id}
              cx={pos[0]}
              cy={pos[1]}
              r={sel ? r0 + 2 : r0}
              fill={colorOf(p.id)}
              fillOpacity={0.9}
              stroke={sel ? "var(--text)" : "var(--surface)"}
              strokeWidth={sel ? 2.5 : 1}
              style={{ cursor: onPick ? "pointer" : "default" }}
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick?.(p.id)}
            >
              <title>{`${p.name}: ${tip(p.id)}`}</title>
            </circle>
          );
        })}
      </svg>
      <p className="small muted" style={{ minHeight: 20, margin: "6px 0 0" }}>
        {hover
          ? `${parks.find((p) => p.id === hover)?.name}: ${tip(hover)}`
          : onPick
            ? "Hover for details, click a dot to pick a park."
            : "Hover a dot for details."}
      </p>
    </div>
  );
}
