// Map of the parks: coloured states, real park boundaries filled with the trend colour,
// Alaska/Hawaii insets, and a zoom panel that shows the selected park's actual shape.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ParkMeta } from "./lib";

type Pos = [number, number];
type Ring = number[][];
interface Feature {
  properties: { name: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] };
}
type Shapes = Record<string, Ring[][]>; // park id -> polygons -> rings -> [lon, lat]

const W = 1000;
const H = 600;

interface Region {
  lon0: number; lon1: number; lat0: number; lat1: number;
  x: number; y: number; w: number; h: number;
}

const CONUS: Region = { lon0: -125, lon1: -66.5, lat0: 24.5, lat1: 49.5, x: 0, y: 0, w: 1000, h: 543 };
const ALASKA: Region = { lon0: -168, lon1: -130, lat0: 54, lat1: 71.5, x: 18, y: 418, w: 230, h: 170 };
const HAWAII: Region = { lon0: -160.5, lon1: -154.5, lat0: 18.8, lat1: 22.4, x: 285, y: 508, w: 130, h: 80 };

function project(lon: number, lat: number, r: Region): Pos {
  const cosLat = Math.cos((((r.lat0 + r.lat1) / 2) * Math.PI) / 180);
  const spanX = (r.lon1 - r.lon0) * cosLat;
  const spanY = r.lat1 - r.lat0;
  const s = Math.min(r.w / spanX, r.h / spanY);
  const offX = r.x + (r.w - spanX * s) / 2;
  const offY = r.y + (r.h - spanY * s) / 2;
  return [offX + (lon - r.lon0) * cosLat * s, offY + (r.lat1 - lat) * s];
}

type Reg = "ak" | "hi" | "conus" | "other";
function regionOf(p: ParkMeta): Reg {
  const st = p.state ?? "";
  if (st.includes("Alaska")) return "ak";
  if (st.includes("Hawaii")) return "hi";
  if (p.lon > -130 && p.lon < -60 && p.lat > 24 && p.lat < 50) return "conus";
  return "other";
}
const REGION: Record<Exclude<Reg, "other">, Region> = { ak: ALASKA, hi: HAWAII, conus: CONUS };

function ringPath(ring: Ring, r: Region, dropEast = false): string {
  if (dropEast && ring.some((c) => c[0] > 0)) return "";
  return (
    ring
      .map((c, i) => {
        const [x, y] = project(c[0], c[1], r);
        return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join("") + "Z"
  );
}

function statePath(f: Feature, r: Region, dropEast: boolean): string {
  const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
  return polys.map((poly) => poly.map((ring) => ringPath(ring, r, dropEast)).join("")).join("");
}

const LAND = ["#e6eed2", "#f1e6c8", "#dbe8d4", "#efdcc4", "#e0e9e6", "#ece3d2"];
const tint = (name: string) => LAND[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % LAND.length];

/** The selected park's real outline, scaled to fit a small box. */
function ParkShape({ rings, fill }: { rings: Ring[][]; fill: string }) {
  const pts = rings.flat(2) as unknown as number[][];
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const cos = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const bw = (x1 - x0) * cos || 1e-3;
  const bh = y1 - y0 || 1e-3;
  const s = Math.min(240 / bw, 150 / bh);
  const ox = (260 - bw * s) / 2;
  const oy = (170 - bh * s) / 2;
  const d = rings
    .map((poly) =>
      poly
        .map((ring) =>
          ring.map((c, i) => `${i ? "L" : "M"}${(ox + (c[0] - x0) * cos * s).toFixed(1)} ${(oy + (y1 - c[1]) * s).toFixed(1)}`).join("") + "Z",
        )
        .join(""),
    )
    .join("");
  const km = Math.round(bw * 111);
  return (
    <svg viewBox="0 0 260 190" style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Park outline">
      <defs>
        <pattern id="pk-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="260" height="190" rx="10" fill="#dbe9d2" />
      <path d={d} fill={fill} stroke="#26331f" strokeWidth={1.6} strokeLinejoin="round" fillRule="evenodd" />
      <path d={d} fill="url(#pk-hatch)" fillRule="evenodd" />
      <text x={10} y={174} fontSize={10} fill="#26331f">about {km} km wide</text>
    </svg>
  );
}

interface Props {
  parks: ParkMeta[];
  colorOf: (id: string) => string;
  tip: (id: string) => string;
  /** Opens the park elsewhere (shown as a button in the detail panel). */
  onPick?: (id: string) => void;
  selected?: string[];
  radius?: (id: string) => number;
  /** Contour rings around a marker (0-3), like a topo map: more rings = stronger trend. */
  rings?: (id: string) => number;
}

export default function ParkMap({ parks, colorOf, tip, onPick, selected = [], radius, rings }: Props) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [shapes, setShapes] = useState<Shapes>({});
  const [hover, setHover] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [mouse, setMouse] = useState<Pos>([0, 0]);
  const [pinPos, setPinPos] = useState<Pos>([0, 0]);
  const wrap = useRef<HTMLDivElement>(null);
  const track = (e: React.MouseEvent) => {
    const r = wrap.current?.getBoundingClientRect();
    if (r) setMouse([e.clientX - r.left, e.clientY - r.top]);
  };

  useEffect(() => {
    fetch("/us-states.json").then((r) => r.json()).then((d: { features: Feature[] }) => setFeatures(d.features)).catch(() => setFeatures([]));
    fetch("/park-shapes.json").then((r) => r.json()).then(setShapes).catch(() => setShapes({}));
  }, []);

  const states = useMemo(
    () =>
      features
        .filter((f) => f.properties.name !== "Puerto Rico")
        .map((f) => {
          const n = f.properties.name;
          const [r, drop] = n === "Alaska" ? [ALASKA, true] : n === "Hawaii" ? [HAWAII, false] : [CONUS, false];
          return { name: n, d: statePath(f, r as Region, drop as boolean) };
        }),
    [features],
  );

  const placed = useMemo(() => {
    let other = 0;
    return parks.map((p) => {
      const reg = regionOf(p);
      const pos: Pos = reg === "other" ? [470 + 55 * other++, 568] : project(p.lon, p.lat, REGION[reg]);
      let d = "";
      if (reg !== "other" && shapes[p.id])
        d = shapes[p.id].map((poly) => poly.map((ring) => ringPath(ring, REGION[reg])).join("")).join("");
      return { p, pos, d };
    });
  }, [parks, shapes]);

  const focus = hover ?? chosen;
  const cardPos = hover ? mouse : pinPos;
  const cardW = 280;
  const wrapW = wrap.current?.clientWidth ?? 1000;
  const cardLeft = cardPos[0] + 16 + cardW > wrapW ? cardPos[0] - 16 - cardW : cardPos[0] + 16;
  const cardTop = Math.max(4, cardPos[1] - 120);
  const focusPark = parks.find((p) => p.id === focus);
  const frame = (r: Region, label: string) => (
    <g>
      <rect x={r.x - 8} y={r.y - 8} width={r.w + 16} height={r.h + 16} rx={8} fill="rgba(255,255,255,.35)" stroke="#8fb4c8" strokeDasharray="4 3" />
      <text x={r.x - 2} y={r.y + r.h + 4} fontSize={11} fill="#4a6b7c" fontWeight={600}>{label}</text>
    </g>
  );

  return (
    <div ref={wrap} style={{ position: "relative" }} onMouseMove={track}>
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, boxShadow: "0 2px 10px rgba(30,50,70,.18)" }} role="img" aria-label="Map of US national parks">
          <defs>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#bcdcec" />
              <stop offset="1" stopColor="#8fc1db" />
            </linearGradient>
            <filter id="land-shadow" x="-2%" y="-2%" width="104%" height="104%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#35607a" floodOpacity=".35" />
            </filter>
          </defs>
          <rect width={W} height={H} fill="url(#sea)" />
          {frame(ALASKA, "Alaska")}
          {frame(HAWAII, "Hawaiʻi")}
          <g>
            <rect x={455} y={538} width={200} height={50} rx={8} fill="rgba(255,255,255,.35)" stroke="#8fb4c8" strokeDasharray="4 3" />
            <text x={462} y={553} fontSize={11} fill="#4a6b7c" fontWeight={600}>Territories</text>
          </g>
          <g filter="url(#land-shadow)">
            {states.map((s) => (
              <path key={s.name} d={s.d} fill={tint(s.name)} stroke="#fff" strokeWidth={0.9} strokeLinejoin="round" />
            ))}
          </g>
          {/* real park boundaries, filled with the trend colour */}
          {placed.map(({ p, d }) =>
            d ? (
              <path key={"s" + p.id} d={d} fill={colorOf(p.id)} fillOpacity={0.85} stroke="#26331f" strokeWidth={0.8} fillRule="evenodd"
                pointerEvents="none" />
            ) : null,
          )}
          {/* topo contour rings: more rings = stronger confirmed trend; the strongest pulse */}
          {rings &&
            placed.map(({ p, pos }) => {
              const n = rings(p.id);
              if (!n) return null;
              const r0 = radius?.(p.id) ?? 6;
              const col = colorOf(p.id);
              return (
                <g key={"t" + p.id} pointerEvents="none">
                  {Array.from({ length: n }, (_, k) => (
                    <circle key={k} cx={pos[0]} cy={pos[1]} r={r0 + 5 + k * 5} fill="none" stroke={col}
                      strokeOpacity={0.75 - k * 0.18} strokeWidth={1.3} strokeDasharray={k ? "3 2" : undefined} />
                  ))}
                  {n >= 3 && <circle className="st-ring" cx={pos[0]} cy={pos[1]} r={r0 + 8} fill="none" stroke={col} strokeWidth={2} />}
                </g>
              );
            })}
          {/* markers keep small parks visible at this scale */}
          {placed.map(({ p, pos }) => {
            const sel = selected.includes(p.id) || chosen === p.id;
            const r0 = radius?.(p.id) ?? 6;
            return (
              <g key={p.id} style={{ cursor: "pointer" }} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}
                onClick={() => {
                  setPinPos(mouse);
                  setChosen((c) => (c === p.id ? null : p.id));
                }}>
                <circle cx={pos[0]} cy={pos[1]} r={(sel ? r0 + 3 : r0) + 2.5} fill="#fff" fillOpacity={0.9} />
                <circle cx={pos[0]} cy={pos[1]} r={sel ? r0 + 3 : r0} fill={colorOf(p.id)} stroke="#26331f" strokeWidth={sel ? 2.2 : 1} />
                <title>{`${p.name}: ${tip(p.id)}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {focusPark && (
        <div
          className="card"
          style={{
            position: "absolute", left: cardLeft, top: cardTop, width: cardW, padding: 12, zIndex: 5,
            boxShadow: "0 8px 24px rgba(20,30,20,.35)", pointerEvents: hover ? "none" : "auto",
          }}
        >
          <h3 style={{ margin: "0 0 2px" }}>{focusPark.name}</h3>
          <p className="small muted" style={{ margin: "0 0 8px" }}>{focusPark.state}</p>
          {shapes[focusPark.id] ? (
            <ParkShape rings={shapes[focusPark.id]} fill={colorOf(focusPark.id)} />
          ) : (
            <p className="small muted">No boundary shape available.</p>
          )}
          <p className="small" style={{ margin: "8px 0 0" }}>{tip(focusPark.id)}</p>
          {!hover && chosen === focusPark.id && (
            <div className="row gap-8" style={{ marginTop: 8 }}>
              {onPick && <button className="btn" onClick={() => onPick(focusPark.id)}>Open this park →</button>}
              <button className="btn-ghost" onClick={() => setChosen(null)}>Close</button>
            </div>
          )}
          {hover && onPick && <p className="micro muted" style={{ margin: "6px 0 0" }}>Click to pin and open.</p>}
        </div>
      )}
    </div>
  );
}
