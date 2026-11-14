import { useEffect, useState } from "react";
import { api, type DatasetInfo } from "./api";
import { PANELS } from "./datasets/registry";

export default function App() {
  const [datasets, setDatasets] = useState<DatasetInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    api
      .datasets()
      .then((d) => {
        setDatasets(d);
        setActiveId(d[0]?.id ?? null);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const active = datasets?.find((d) => d.id === activeId);
  const Panel = active ? PANELS[active.id] : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="title">Bright Spots · Data dashboard</h1>
        <nav className="row gap-8 wrap" aria-label="Datasets">
          {datasets?.map((d) => (
            <button
              key={d.id}
              className={`chip ${d.id === activeId ? "active" : ""}`}
              onClick={() => setActiveId(d.id)}
            >
              {d.name}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {error && <p className="error">Backend unreachable: {error}. Is uvicorn running on :8000?</p>}
        {!datasets && !error && <p className="muted">Loading datasets…</p>}
        {active && (
          <p className="small muted source">
            Source:{" "}
            <a href={active.url} target="_blank" rel="noreferrer">
              {active.source}
            </a>
          </p>
        )}
        {active && Panel && <Panel dataset={active} />}
        {active && !Panel && <p className="muted">No panel registered for “{active.id}”.</p>}
      </main>
    </div>
  );
}
