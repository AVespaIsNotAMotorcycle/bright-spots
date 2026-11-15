// User profile (kept in this browser's localStorage; there is no account server).
import type { NavState } from "./useNav";

export type Tab = NonNullable<NavState["tab"]>;

/** One persona (Explorer). `research` adds the Research menu. */
export interface Profile {
  name: string;
  research: boolean;
}

export const TAB_LABEL: Record<Tab, string> = {
  home: "Home",
  planner: "Plan",
  student: "Cases",
  saved: "Saved",
  passport: "Passport",
  explore: "Park Explorer",
  atlas: "Trend Atlas",
  map: "Topo Map",
  families: "Park Families",
  opposites: "Odd One Out",
  compare: "Head-to-Head",
  robust: "Robustness",
  seasons: "Season Shifts",
  analogs: "Analog Sites",
  community: "Campfire",
};

/** Top tabs everyone sees, in order. Park Explorer ("explore") is reached by links only. */
export const EXPLORER_TABS: Tab[] = ["home", "planner", "student", "saved", "passport"];
/** Tabs in the Research menu (only when research is on). */
export const RESEARCH_TABS: Tab[] = ["atlas", "map", "analogs", "families", "opposites", "seasons", "compare", "robust", "community"];

export function allowedTabs(research: boolean): Tab[] {
  return research ? [...EXPLORER_TABS, "explore", ...RESEARCH_TABS] : [...EXPLORER_TABS, "explore"];
}

/** @deprecated Only the pre-merge Home.tsx imports these. Delete once Home is rewritten. */
export type Persona = "explorer" | "researcher";
/** @deprecated See Persona. */
export const PERSONAS: Record<Persona, { label: string; emoji: string; tagline: string; blurb: string; bullets: string[]; tabs: Tab[] }> = {
  explorer: { label: "Explorer", emoji: "", tagline: "Solve park mysteries, then plan the trip", blurb: "", bullets: [], tabs: EXPLORER_TABS },
  researcher: { label: "Explorer", emoji: "", tagline: "Full trend atlas with statistics", blurb: "", bullets: [], tabs: allowedTabs(true) },
};

const KEY = "profile";

/** Old profiles had a persona: "researcher" turns research on, anything else is off. */
export function migrate(p: { name?: unknown; persona?: unknown; research?: unknown }): Profile {
  const name = typeof p.name === "string" ? p.name : "";
  const research = typeof p.research === "boolean" ? p.research : p.persona === "researcher";
  return { name, research };
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw) as object);
    // Older builds stored only a persona string.
    const old = localStorage.getItem("persona");
    if (old) {
      let p: unknown = old;
      try {
        p = JSON.parse(old);
      } catch {
        /* a bare string */
      }
      if (typeof p === "string" && p) return migrate({ name: "", persona: p });
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function saveProfile(p: Profile | null): void {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
