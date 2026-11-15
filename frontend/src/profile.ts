// User profile (kept in this browser's localStorage; there is no account server).
import type { NavState } from "./useNav";

export type Tab = NonNullable<NavState["tab"]>;

/** One persona (Explorer). `research` adds the Research menu. */
export interface Profile {
  name: string;
  research: boolean;
  /** Set when signed in to an account; missing for guests. */
  email?: string;
}

export const TAB_LABEL: Record<Tab, string> = {
  planner: "Plan",
  student: "Mysteries",
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
export const EXPLORER_TABS: Tab[] = ["planner", "student", "saved", "passport"];
/** Tabs in the Research menu (only when research is on). */
export const RESEARCH_TABS: Tab[] = ["atlas", "map", "analogs", "families", "opposites", "seasons", "compare", "robust", "community"];

export function allowedTabs(research: boolean): Tab[] {
  return research ? [...EXPLORER_TABS, "explore", ...RESEARCH_TABS] : [...EXPLORER_TABS, "explore"];
}

const KEY = "profile";

/** Old profiles had a persona: "researcher" turns research on, anything else is off. */
export function migrate(p: { name?: unknown; persona?: unknown; research?: unknown; email?: unknown }): Profile {
  const name = typeof p.name === "string" ? p.name : "";
  const research = typeof p.research === "boolean" ? p.research : p.persona === "researcher";
  return typeof p.email === "string" && p.email ? { name, research, email: p.email } : { name, research };
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
