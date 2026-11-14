import { useEffect, useRef, useState } from "react";
import { api, type Place } from "../api";

const PRESETS: Place[] = [
  { name: "New York", lat: 40.78, lon: -73.97, source: "preset" },
  { name: "London", lat: 51.48, lon: -0.45, source: "preset" },
  { name: "Tokyo", lat: 35.69, lon: 139.69, source: "preset" },
  { name: "Nairobi", lat: -1.29, lon: 36.82, source: "preset" },
  { name: "Sydney", lat: -33.87, lon: 151.21, source: "preset" },
];

export const DEFAULT_PLACE = PRESETS[0];

/** Nominatim search via /api/geocode, debounced 350 ms (spec 8.x). */
export default function PlaceSearch({ place, onPick }: { place: Place; onPick: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(() => {
      api
        .geocode(q)
        .then((r) => {
          if (id !== seq.current) return;
          setResults(r);
          setError(null);
          setOpen(true);
        })
        .catch((e) => id === seq.current && setError(String(e.message ?? e)));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  function pick(p: Place) {
    onPick(p);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  function useDevice() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const lat = +pos.coords.latitude.toFixed(3);
      const lon = +pos.coords.longitude.toFixed(3);
      pick({ name: `My location (${lat}, ${lon})`, lat, lon, source: "device" });
    });
  }

  return (
    <div className="place">
      <div className="place-row">
        <div className="search">
          <input
            type="search"
            placeholder="Search a place or type “lat, lon”"
            aria-label="Search a place"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) pick(results[0]);
              if (e.key === "Escape") setOpen(false);
            }}
          />
          {open && results.length > 0 && (
            <ul className="results-pop" role="listbox">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon},${r.name}`}>
                  <button role="option" aria-selected="false" onClick={() => pick(r)}>
                    <span>{r.name}</span>
                    <span className="micro muted num">
                      {r.lat.toFixed(3)}, {r.lon.toFixed(3)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="btn btn-ghost" onClick={useDevice}>
          My location
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
      <div className="row gap-8 wrap">
        {PRESETS.map((p) => (
          <button key={p.name} className={`chip ${place.name === p.name ? "active" : ""}`} onClick={() => pick(p)}>
            {p.name}
          </button>
        ))}
      </div>
      <p className="small muted num here">
        <span className="here-name">{place.name}</span> · {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
      </p>
    </div>
  );
}
