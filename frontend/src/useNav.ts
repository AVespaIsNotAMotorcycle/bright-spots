/**
 * Hash-based navigation that makes the browser back/forward buttons work.
 *
 * URL shape:  #tab=student&case=crater-lake-warming&step=2
 *             #tab=atlas&park=crla
 *             #tab=planner&month=6
 *
 * Rules:
 *  - navigate()  pushes a new history entry  (back button returns here)
 *  - replace()   replaces the current entry   (no extra back stop)
 *  - Reading the URL on mount restores the right view after a refresh or share.
 */

import { useCallback, useEffect, useState } from "react";

export interface NavState {
  tab: "student" | "passport" | "saved" | "explore" | "atlas" | "planner" | "map" | "families" | "opposites" | "compare" | "robust" | "seasons" | "analogs" | "community" | null;
  caseId: string | null;
  step: number | null;
  park: string | null;
  month: number | null;
  park2: string | null;
  v: string | null;
  per: string | null;
  /** Trip planner settings, encoded (see planner/trip/tripModel.ts). */
  q: string | null;
}

/** A whole number in [lo, hi], else null (guards bad links like step=abc). */
function intIn(v: string | null, lo: number, hi: number): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}

export function parseHash(): NavState {
  const p = new URLSearchParams(location.hash.slice(1));
  return {
    tab:    (p.get("tab") as NavState["tab"]) ?? null,
    caseId: p.get("case"),
    step:   intIn(p.get("step"), 0, 999),
    park:   p.get("park"),
    month:  intIn(p.get("month"), 1, 12),
    park2:  p.get("park2"),
    v:      p.get("v"),
    per:    p.get("per"),
    q:      p.get("trip"),
  };
}

export function toHash(s: Partial<NavState>): string {
  const p = new URLSearchParams();
  if (s.tab)    p.set("tab", s.tab);
  if (s.caseId) p.set("case", s.caseId);
  if (s.step != null) p.set("step", String(s.step));
  if (s.park)   p.set("park", s.park);
  if (s.month != null) p.set("month", String(s.month));
  if (s.park2)  p.set("park2", s.park2);
  if (s.v)      p.set("v", s.v);
  if (s.per)    p.set("per", s.per);
  if (s.q)      p.set("trip", s.q);
  const str = p.toString();
  return str ? "#" + str : "#";
}

export function useNav() {
  const [nav, setNav] = useState<NavState>(parseHash);

  // Stay in sync when the user presses back/forward.
  useEffect(() => {
    // hashchange also covers a hash typed in the address bar or an <a href="#...">.
    const handler = () => setNav(parseHash());
    window.addEventListener("popstate", handler);
    window.addEventListener("hashchange", handler);
    return () => {
      window.removeEventListener("popstate", handler);
      window.removeEventListener("hashchange", handler);
    };
  }, []);

  const navigate = useCallback((next: Partial<NavState>) => {
    const hash = toHash(next);
    // Same place again (e.g. clicking the active tab): no extra back stop.
    if (hash === (location.hash || "#")) return;
    history.pushState(null, "", hash);
    setNav(parseHash());
    window.scrollTo(0, 0);
  }, []);

  const replace = useCallback((next: Partial<NavState>) => {
    const hash = toHash(next);
    history.replaceState(null, "", hash);
    setNav(parseHash());
  }, []);

  return { nav, navigate, replace };
}
