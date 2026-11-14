import { useEffect, useState } from "react";
import { api, type DatasetInfo, type Place } from "./api";
import PlaceSearch, { DEFAULT_PLACE } from "./components/PlaceSearch";
import { PANELS } from "./datasets/registry";

const ACCESS_LABEL: Record<DatasetInfo["access"], string> = {
  live: "Live API",
  bundled: "Bundled file",
  browser: "Browser tiles",
};

function readHash(): string | null {
  return window.location.hash.slice(1) || null;
}

export default function App() {
  const [datasets, setDatasets] = useState<DatasetInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(readHash());
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);

  useEffect(() => {
    api
      .datasets()
      .then((d) => {
        setDatasets(d);
        setActiveId((cur) => (cur && d.some((x) => x.id === cur) ? cur : (d[0]?.id ?? null)));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (activeId) history.replaceState(null, "", `#${activeId}`);
  }, [activeId]);

  const active = datasets?.find((d) => d.id === activeId);
  const Panel = active ? PANELS[active.id] : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="title">Bright Spots · Data dashboard</h1>
        <PlaceSearch place={place} onPick={setPlace} />
      </header>

      {error && <p className="error">Backend unreachable: {error}. Is uvicorn running on :8000?</p>}
      {!datasets && !error && <p className="muted">Loading datasets…</p>}

      {datasets && (
        <nav className="tabs" aria-label="Datasets" role="tablist">
          {datasets.map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={d.id === activeId}
              className={`tab ${d.id === activeId ? "active" : ""}`}
              onClick={() => setActiveId(d.id)}
            >
              <span>{d.name}</span>
              <span className="micro muted">{ACCESS_LABEL[d.access]}</span>
            </button>
          ))}
        </nav>
      )}

      {active && (
        <main className="panel" role="tabpanel">
          <div className="panel-intro">
            <p>{active.gives}</p>
            <p className="small muted">
              Source:{" "}
              <a href={active.url} target="_blank" rel="noreferrer">
                {active.source}
              </a>
            </p>
          </div>
          {Panel ? (
            <Panel key={active.id} dataset={active} place={place} onPlace={setPlace} />
          ) : (
            <p className="muted">No panel registered for “{active.id}”.</p>
          )}
        </main>
      )}
    </div>
  );
}
