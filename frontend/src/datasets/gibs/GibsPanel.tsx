import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DatasetInfo, Place } from "../../api";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** GIBS tiles load straight from NASA into MapLibre (spec 5.6); the backend never proxies images. */
export default function GibsPanel({ place, dataset }: { place: Place; dataset: DatasetInfo }) {
  const base = dataset.layers?.base;
  const truecolor = dataset.layers?.truecolor;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [date, setDate] = useState(isoDaysAgo(3));
  const [showTrue, setShowTrue] = useState(true);

  // Create the map once.
  useEffect(() => {
    if (!container.current || !base || !truecolor) return;
    const m = new maplibregl.Map({
      container: container.current,
      center: [place.lon, place.lat],
      zoom: 6,
      maxZoom: 12,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          base: { type: "raster", tiles: [base.tiles], tileSize: 256, maxzoom: base.maxzoom },
          truecolor: {
            type: "raster",
            tiles: [truecolor.tiles.replace("{time}", date)],
            tileSize: 256,
            maxzoom: truecolor.maxzoom,
          },
        },
        layers: [
          { id: "base", type: "raster", source: "base" },
          { id: "truecolor", type: "raster", source: "truecolor" },
        ],
      },
    });
    m.addControl(new maplibregl.AttributionControl({ customAttribution: "Imagery: NASA GIBS" }));
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    marker.current = new maplibregl.Marker({ color: "#7cc4ff" }).setLngLat([place.lon, place.lat]).addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // Only on mount; later changes are applied by the effects below.
  }, [base, truecolor]);

  useEffect(() => {
    map.current?.flyTo({ center: [place.lon, place.lat], zoom: 6, essential: true });
    marker.current?.setLngLat([place.lon, place.lat]);
  }, [place.lat, place.lon]);

  useEffect(() => {
    const m = map.current;
    if (!m || !truecolor) return;
    const apply = () => {
      const src = m.getSource("truecolor") as maplibregl.RasterTileSource | undefined;
      src?.setTiles([truecolor.tiles.replace("{time}", date)]);
    };
    if (m.isStyleLoaded()) apply();
    else m.once("load", apply);
  }, [date, truecolor]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => m.setLayoutProperty("truecolor", "visibility", showTrue ? "visible" : "none");
    if (m.isStyleLoaded()) apply();
    else m.once("load", apply);
  }, [showTrue]);

  if (!base || !truecolor) return <p className="error">GIBS layer config missing from /api/datasets.</p>;

  return (
    <div className="panel-stack">
      <div className="row gap-8 wrap">
        <label className="field">
          <span>Date (MODIS Terra true colour)</span>
          <input
            type="date"
            value={date}
            min={truecolor.first_date}
            max={isoDaysAgo(0)}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <button className="btn btn-ghost" onClick={() => setDate(isoDaysAgo(3))}>
          Recent
        </button>
        <button className={`chip ${showTrue ? "active" : ""}`} aria-pressed={showTrue} onClick={() => setShowTrue((v) => !v)}>
          True colour layer
        </button>
      </div>
      <div ref={container} className="map" role="region" aria-label={`Satellite map around ${place.name}`} />
      <p className="micro muted">
        Base: Blue Marble shaded relief (z≤8). True colour: daily MODIS Terra (z≤9, overzoomed beyond). Black
        stripes are gaps between satellite swaths.
      </p>
    </div>
  );
}
