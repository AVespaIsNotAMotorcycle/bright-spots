import Planner from "./planner/Planner";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1 className="title">Park visit planner</h1>
          <p className="small muted">
            Which US national parks suit you in a given month: this year measured, next year forecast, 2050 projected.
          </p>
        </div>
      </header>
      <main>
        <Planner />
      </main>
    </div>
  );
}
