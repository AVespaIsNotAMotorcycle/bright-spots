import { useState } from "react";
import { fetchCityNormals, geocode, type CityNormals, type Place } from "./model";

export interface FavouriteCityValue {
  name: string;
  normals: CityNormals;
}

/** "I like the weather in …": a place search whose 1991–2020 normals set the temperature. */
export default function FavouriteCity({ onPick }: { onPick: (v: FavouriteCityValue) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await geocode(q.trim());
      setResults(r);
      if (r.length === 0) setError("No match; try a city name.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function choose(p: Place) {
    setBusy(true);
    setError(null);
    try {
      const normals = await fetchCityNormals(p.lat, p.lon);
      setResults(null);
      setQ("");
      onPick({ name: p.name.split(",")[0], normals });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="favourite-city">
      <form className="row gap-8" onSubmit={search}>
        <input
          className="text-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="A city whose weather you like"
          aria-label="Favourite city for temperature"
        />
        <button className="btn btn-ghost" type="submit" disabled={busy}>
          {busy ? "…" : "Match"}
        </button>
      </form>
      {results && results.length > 0 && (
        <ul className="place-results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button className="link-btn small" onClick={() => choose(r)}>
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
