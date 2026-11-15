/**
 * Path-based navigation that makes the browser back/forward buttons work.
 *
 * URL shape:  /mysteries?case=crater-lake-warming&step=2
 *             /research/trend-atlas?park=crla
 *             /plan?month=6&park=zion
 *             /login?next=/saved     (account pages: /signup, /login, /logout, /profile)
 *
 * Rules:
 *  - navigate()  pushes a new history entry  (back button returns here)
 *  - replace()   replaces the current entry   (no extra back stop)
 *  - Reading the URL on mount restores the right view after a refresh or share.
 *  - Old links (#tab=planner&month=6) still open, and are rewritten to the new path.
 * The server sends index.html for any unknown path (backend/app/main.py), so deep links load.
 */

import { useCallback, useEffect, useState } from "react";

export type Tab = "student" | "passport" | "saved" | "explore" | "atlas" | "planner" | "map" | "families" | "opposites" | "compare" | "robust" | "seasons" | "analogs" | "community";

export interface NavState {
  tab: Tab | null;
  caseId: string | null;
  step: number | null;
  park: string | null;
  month: number | null;
  park2: string | null;
  v: string | null;
  per: string | null;
  /** Trip planner settings, encoded (see planner/trip/tripModel.ts). */
  q: string | null;
  /** An account page instead of a tab. */
  page?: AuthPage | null;
  /** Where to go after logging in, e.g. "/saved". */
  next?: string | null;
}

export type AuthPage = "signup" | "login" | "logout" | "profile";
const AUTH_PAGES: AuthPage[] = ["signup", "login", "logout", "profile"];

/** A same-site path to go back to after logging in; anything else is dropped. */
export const safeNext = (v: string | null | undefined): string | null =>
  v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;

/** Each tab's path. Research tools live under /research/, named as in the menu. */
export const PATHS: Record<Tab, string> = {
  planner: "/plan",
  student: "/mysteries",
  saved: "/saved",
  passport: "/passport",
  explore: "/explore",
  atlas: "/research/trend-atlas",
  map: "/research/topo-map",
  analogs: "/research/analog-sites",
  families: "/research/park-families",
  opposites: "/research/odd-one-out",
  seasons: "/research/season-shifts",
  compare: "/research/head-to-head",
  robust: "/research/robustness",
  community: "/research/campfire",
};
// There is no Home page: the site root is Plan.
const BY_PATH = new Map<string, Tab>([["/", "planner"], ...Object.entries(PATHS).map(([t, p]) => [p, t as Tab] as [string, Tab])]);

/** A whole number in [lo, hi], else null (guards bad links like step=abc). */
function intIn(v: string | null, lo: number, hi: number): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}

function fromParams(tab: Tab | null, p: URLSearchParams): NavState {
  return {
    tab,
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

/** An old-style #tab=... link, if the URL has one. */
const legacyHash = (): URLSearchParams | null => {
  const p = new URLSearchParams(location.hash.slice(1));
  return p.has("tab") ? p : null;
};

/** Where the URL points. "/" is Plan; an unknown path gives tab "unknown", which App turns into Plan. */
export function parseUrl(): NavState {
  const old = legacyHash();
  if (old) return fromParams(old.get("tab") as Tab, old);
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const q = new URLSearchParams(location.search);
  const page = AUTH_PAGES.find((a) => path === "/" + a);
  if (page) return { ...fromParams(null, q), page, next: safeNext(q.get("next")) };
  return fromParams(BY_PATH.get(path) ?? ("unknown" as Tab), q);
}

/** Path plus query for a place in the app, e.g. "/plan?month=6". */
export function toUrl(s: Partial<NavState>): string {
  const p = new URLSearchParams();
  if (s.page) {
    const next = safeNext(s.next);
    if (next && next !== "/") p.set("next", next);
    const str = p.toString();
    return "/" + s.page + (str ? "?" + str : "");
  }
  if (s.caseId) p.set("case", s.caseId);
  if (s.step != null) p.set("step", String(s.step));
  if (s.park)   p.set("park", s.park);
  if (s.month != null) p.set("month", String(s.month));
  if (s.park2)  p.set("park2", s.park2);
  if (s.v)      p.set("v", s.v);
  if (s.per)    p.set("per", s.per);
  if (s.q)      p.set("trip", s.q);
  const str = p.toString();
  return (s.tab ? PATHS[s.tab] ?? "/" : "/") + (str ? "?" + str : "");
}

export const here = () => location.pathname + location.search;

export function useNav() {
  const [nav, setNav] = useState<NavState>(parseUrl);

  // Rewrite an old #tab=... link to its path, keeping the same view.
  useEffect(() => {
    if (legacyHash()) history.replaceState(null, "", toUrl(parseUrl()));
  }, []);

  // Stay in sync when the user presses back/forward.
  useEffect(() => {
    // hashchange covers an old-style link typed in the address bar.
    const handler = () => {
      const s = parseUrl();
      if (legacyHash()) history.replaceState(null, "", toUrl(s));
      setNav(s);
    };
    window.addEventListener("popstate", handler);
    window.addEventListener("hashchange", handler);
    return () => {
      window.removeEventListener("popstate", handler);
      window.removeEventListener("hashchange", handler);
    };
  }, []);

  const navigate = useCallback((next: Partial<NavState>) => {
    const url = toUrl(next);
    // Same place again (e.g. clicking the active tab): no extra back stop.
    if (url === here() && !location.hash) return;
    history.pushState(null, "", url);
    setNav(parseUrl());
    window.scrollTo(0, 0);
  }, []);

  const replace = useCallback((next: Partial<NavState>) => {
    history.replaceState(null, "", toUrl(next));
    setNav(parseUrl());
  }, []);

  return { nav, navigate, replace };
}
