// Renders the Plan-a-visit page inside a shadow root with its own stylesheet, so it looks
// exactly as it does on main and neither side's CSS can leak into the other.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import css from "./planner.css?inline";

export default function PlannerShadow({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    let m = root.getElementById("pv-mount");
    if (!m) {
      const style = document.createElement("style");
      style.textContent = css;
      root.append(style);
      m = document.createElement("div");
      m.id = "pv-mount";
      m.className = "app";
      root.append(m);
    }
    setMount(m);
  }, []);

  return <div ref={host}>{mount && createPortal(children, mount)}</div>;
}
