import { useState } from "react";
import { geocode, type Place } from "./model";

/**
 * Where "near you" is measured from: the browser's location (asks permission) or a
 * place the user searches for. Either can replace the other at any time; while the
 * user is choosing a new one, the current place stays in effect.
 */
export default function LocationPicker({ place, onPlace }: { place: Place | null; onPlace: (p: Place | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(p: Place) {
    setResults(null);
    setError(null);
    setEditing(false);
    onPlace(p);
  }

  function locate() {
    if (!navigator.geolocation) return setError("This browser cannot share a location; search for a place instead.");
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        choose({ name: "your location", lat: pos.coords.latitude, lon: pos.coords.longitude, source: "device" });
      },
      (err) => {
        setBusy(false);
        setEditing(true);
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

  const usingDevice = place?.source === "device" || place?.name === "your location";

  if (place && !editing)
    return (
      <div className="row gap-12 wrap location-line">
        <span className="small">
          Parks near <strong>{usingDevice ? "your current location" : place.name.split(",").slice(0, 2).join(",")}</strong>
        </span>
        {usingDevice ? (
          <button className="link-btn small" onClick={() => setEditing(true)}>
            Enter a place instead
          </button>
        ) : (
          <>
            <button className="link-btn small" onClick={() => setEditing(true)}>
              Change place
            </button>
            <button className="link-btn small" onClick={locate} disabled={busy}>
              {busy ? "Locating…" : "Use my location"}
            </button>
          </>
        )}
      </div>
    );

  return (
    <div className="location-picker">
      <div className="row gap-8 wrap">
        <form className="row gap-8" onSubmit={search}>
          <input
            className="text-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="City or ZIP code"
            aria-label="Search for a place"
            autoFocus={editing}
          />
          <button className="btn" type="submit" disabled={busy}>
            Search
          </button>
        </form>
        {!usingDevice && (
          <>
            <span className="small muted">or</span>
            <button className="btn btn-ghost" onClick={locate} disabled={busy}>
              {busy ? "Locating…" : "Use my location"}
            </button>
          </>
        )}
        {place && (
          <button
            className="link-btn small"
            onClick={() => {
              setEditing(false);
              setResults(null);
              setError(null);
            }}
          >
            Cancel
          </button>
        )}
      </div>
      {results && results.length > 0 && (
        <ul className="place-results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button className="link-btn" onClick={() => choose({ name: r.name, lat: r.lat, lon: r.lon, source: "search" })}>
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
