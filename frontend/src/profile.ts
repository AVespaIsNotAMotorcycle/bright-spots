// User profile (kept in this browser's localStorage; there is no account server).
import type { NavState } from "./useNav";

export type Persona = "student" | "visitor" | "researcher";
export type Tab = NonNullable<NavState["tab"]>;

export interface Profile {
  name: string;
  persona: Persona;
}

export interface PersonaInfo {
  label: string;
  emoji: string;
  tagline: string;
  blurb: string;
  bullets: string[];
  /** Tabs this persona sees, in order. The first is the Home screen. */
  tabs: Tab[];
}

export const TAB_LABEL: Record<Tab, string> = {
  home: "🏠 Home",
  student: "🔍 Detective Cases",
  explore: "🧭 Park Explorer",
  planner: "🗓 Trip Planner",
  atlas: "📊 Trend Atlas",
  map: "🗺 Map",
  families: "🧬 Park Families",
  opposites: "↔ Opposite Trends",
  compare: "⚖ Compare Parks",
  robust: "🧪 Robustness",
  seasons: "🌗 Season Shifts",
};

export const PERSONAS: Record<Persona, PersonaInfo> = {
  visitor: {
    label: "Visitor",
    emoji: "🥾",
    tagline: "Plan a trip around how parks are changing",
    blurb: "You want to know when to go and what to expect.",
    bullets: ["Pick a month, get a score for every park", "See which parks are warming", "Plain language, no statistics"],
    tabs: ["home", "planner", "explore"],
  },
  student: {
    label: "Student",
    emoji: "🧑‍🎓",
    tagline: "Learn to read real NASA data",
    blurb: "You want guided cases that teach how trends and significance work.",
    bullets: ["Predict first, then see the data", "Three guided detective cases", "Explore any park and plan a trip"],
    tabs: ["home", "student", "explore", "planner"],
  },
  researcher: {
    label: "Researcher",
    emoji: "🔬",
    tagline: "Full trend atlas with statistics",
    blurb: "You want every test, every period, and the raw results.",
    bullets: ["Sen's slope, Mann-Kendall, FDR q-values", "Park families and opposite-trend finder", "Start-year test, map, compare, Python/R export"],
    tabs: ["home", "atlas", "map", "families", "opposites", "seasons", "compare", "robust"],
  },
};

const KEY = "profile";

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Profile;
    // Older builds stored only a persona string.
    const old = localStorage.getItem("persona");
    if (old) {
      const p = JSON.parse(old) as string | null;
      if (p === "student" || p === "researcher") return { name: "", persona: p };
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
