// Zoomable satellite / terrain map (Leaflet) with real park boundaries filled by trend colour.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { ParkMeta } from "./lib";

interface Props {
  parks: ParkMeta[];
  colorOf: (id: string) => string;
  tip: (id: string) => string;
  onPick?: (id: string) => void;
  selected?: string[];
  radius?: (id: string) => number;
}

type Shapes = Record<string, number[][][][]>;

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const BASEMAPS = {
  satellite: {
    label: "Satellite",
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    labels: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
  },
  terrain: {
    label: "Terrain",
    url: `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: "Tiles © Esri — Esri, HERE, Garmin, USGS, NPS",
    labels: null,
  },
} as const;
type BaseKey = keyof typeof BASEMAPS;

const JUMPS: Record<string, L.LatLngBoundsExpression> = {
  "Lower 48": [[24, -125], [50, -66]],
  Alaska: [[51, -170], [72, -129]],
  "Hawaiʻi": [[18.8, -160.6], [22.4, -154.7]],
};

export default function LeafletMap({ parks, colorOf, tip, onPick, selected = [], radius }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const base = useRef<L.LayerGroup | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [bm, setBm] = useState<BaseKey>("satellite");
  const [shapes, setShapes] = useState<Shapes>({});

  useEffect(() => {
    fetch("/park-shapes.json").then((r) => r.json()).then(setShapes).catch(() => setShapes({}));
  }, []);

  // create the map once
  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomSnap: 0.5, minZoom: 2, worldCopyJump: true }).fitBounds(JUMPS["Lower 48"]);
    base.current = L.layerGroup().addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // basemap
  useEffect(() => {
    const g = base.current;
    if (!g) return;
    g.clearLayers();
    const b = BASEMAPS[bm];
    L.tileLayer(b.url, { attribution: b.attribution, maxZoom: 17 }).addTo(g);
    if (b.labels) L.tileLayer(b.labels, { maxZoom: 17, opacity: 0.9 }).addTo(g);
  }, [bm]);

  // parks: rebuilt only when colours, text or shapes change
  const sig = parks.map((p) => colorOf(p.id) + tip(p.id) + (selected.includes(p.id) ? "*" : "")).join("|") + Object.keys(shapes).length;
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const p of parks) {
      const color = colorOf(p.id);
      const sel = selected.includes(p.id);
      const html = () => {
        const el = document.createElement("div");
        el.style.minWidth = "180px";
        el.innerHTML = `<b style="font-size:14px"></b><div style="color:#6b5d49;font-size:12px"></div><div style="margin-top:4px;font-size:13px"></div>`;
        (el.children[0] as HTMLElement).textContent = p.name;
        (el.children[1] as HTMLElement).textContent = p.state ?? "";
        (el.children[2] as HTMLElement).textContent = tip(p.id);
        return el;
      };
      const poly = shapes[p.id];
      if (poly) {
        const gj = L.polygon(
          poly.map((rings) => rings.map((ring) => ring.map(([lon, lat]) => [lat, lon] as [number, number]))) as unknown as L.LatLngExpression[][][],
          { color: sel ? "#fff" : "#1b2a14", weight: sel ? 3 : 1.8, fillColor: color, fillOpacity: 0.7 },
        );
        gj.bindTooltip(html(), { sticky: true, className: "park-tip" });
        gj.on("click", () => openCard(p, gj.getBounds().getCenter()));
        gj.addTo(g);
      }
      // marker so small parks stay visible when zoomed out
      const dot = L.circleMarker([p.lat, p.lon], {
        radius: (radius?.(p.id) ?? 6) + (sel ? 3 : 0), color: "#fff", weight: 2, fillColor: color, fillOpacity: 1,
      });
      dot.bindTooltip(html(), { sticky: true, className: "park-tip" });
      dot.on("click", () => openCard(p, [p.lat, p.lon]));
      dot.addTo(g);
    }
    function openCard(p: ParkMeta, at: L.LatLngExpression) {
      const el = document.createElement("div");
      el.style.minWidth = "190px";
      const h = document.createElement("b");
      h.textContent = p.name;
      const t = document.createElement("div");
      t.style.cssText = "margin:4px 0 8px;font-size:13px";
      t.textContent = tip(p.id);
      el.append(h, t);
      if (onPickRef.current) {
        const b = document.createElement("button");
        b.textContent = "Open this park →";
        b.className = "btn";
        b.onclick = () => onPickRef.current?.(p.id);
        el.append(b);
      }
      L.popup({ offset: [0, -4] }).setLatLng(at).setContent(el).openOn(map.current!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <div>
      <div className="row gap-8" style={{ flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        {(Object.keys(BASEMAPS) as BaseKey[]).map((k) => (
          <button key={k} className={`nav-tab${bm === k ? " active" : ""}`} onClick={() => setBm(k)}>
            {BASEMAPS[k].label}
          </button>
        ))}
        <span className="muted small" style={{ margin: "0 4px" }}>Jump to</span>
        {Object.entries(JUMPS).map(([name, b]) => (
          <button key={name} className="btn-ghost" onClick={() => map.current?.flyToBounds(b, { duration: 0.8 })}>
            {name}
          </button>
        ))}
      </div>
      <div ref={box} style={{ height: 560, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(30,50,70,.25)" }} />
      <p className="micro muted" style={{ margin: "4px 0 0" }}>
        Scroll or pinch to zoom, drag to pan. Hover a park for details, click for the open button. Map tiles need an internet connection.
      </p>
    </div>
  );
}
