import { useState } from "react";
import { geocode, type Place } from "./model";

/** "Use my location" (browser geolocation, asks permission) or a place search. */
export default function LocationPicker({ place, onPlace }: { place: Place | null; onPlace: (p: Place | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    if (!navigator.geolocation) return setError("This browser cannot share a location; search for a place instead.");
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onPlace({ name: "your location", lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setBusy(false);
        setError(`Location unavailable (${err.message}); search for a place instead.`);
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await geocode(q.trim());
      setResults(r);
      if (r.length === 0) setError("No match; try a city or ZIP code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (place)
    return (
      <p className="small location-line">
        Parks near <strong>{place.name.split(",").slice(0, 2).join(",")}</strong>{" "}
        <button className="link-btn small" onClick={() => onPlace(null)}>
          change
        </button>
      </p>
    );

  return (
    <div className="location-picker">
      <div className="row gap-8 wrap">
        <button className="btn" onClick={locate} disabled={busy}>
          Use my location
        </button>
        <span className="small muted">or</span>
        <form className="row gap-8" onSubmit={search}>
          <input
            className="text-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="City or ZIP code"
            aria-label="Search for a place"
          />
          <button className="btn btn-ghost" type="submit" disabled={busy}>
            Search
          </button>
        </form>
      </div>
      {results && results.length > 0 && (
        <ul className="place-results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                className="link-btn"
                onClick={() => {
                  setResults(null);
                  onPlace({ name: r.name, lat: r.lat, lon: r.lon });
                }}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="small error">{error}</p>}
    </div>
  );
}
