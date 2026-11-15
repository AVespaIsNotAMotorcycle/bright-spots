// Lets the user choose between the flat illustrated map and the zoomable satellite map.
import { useState } from "react";
import LeafletMap from "./LeafletMap";
import ParkMap from "./ParkMap";
import type { ParkMeta } from "./lib";

interface Props {
  parks: ParkMeta[];
  colorOf: (id: string) => string;
  tip: (id: string) => string;
  onPick?: (id: string) => void;
  selected?: string[];
  radius?: (id: string) => number;
}

export default function MapSwitch(props: Props) {
  const [mode, setMode] = useState<"flat" | "zoom">("zoom");
  return (
    <div>
      <div className="row gap-8" style={{ marginBottom: 8 }}>
        <button className={`nav-tab${mode === "zoom" ? " active" : ""}`} onClick={() => setMode("zoom")}>🛰 Zoomable map</button>
        <button className={`nav-tab${mode === "flat" ? " active" : ""}`} onClick={() => setMode("flat")}>🗺 Overview map</button>
      </div>
      {mode === "zoom" ? <LeafletMap {...props} /> : <ParkMap {...props} />}
    </div>
  );
}
