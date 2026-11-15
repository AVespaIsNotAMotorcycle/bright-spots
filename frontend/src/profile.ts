// User profile (kept in this browser's localStorage; there is no account server).
import type { NavState } from "./useNav";

export type Persona = "explorer" | "researcher";
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
  student: "🔍 Cases",
  passport: "🎫 Passport",
  saved: "♥ Saved",
  explore: "🧭 Park Explorer",
  planner: "🗓 Trip Planner",
  atlas: "📊 Trend Atlas",
  map: "🗺️ Topo Map",
  families: "🧬 Park Families",
  opposites: "🧭 Odd One Out",
  compare: "🥊 Head-to-Head",
  robust: "🧪 Robustness",
  seasons: "🌗 Season Shifts",
  analogs: "🌐 Analog Sites",
  community: "🔥 Campfire",
};

export const PERSONAS: Record<Persona, PersonaInfo> = {
  explorer: {
    label: "Explorer",
    emoji: "🥾",
    tagline: "Solve park mysteries, then plan the trip",
    blurb: "Crack cases with real NASA data. Each case stamps your park passport.",
    bullets: ["17 detective cases, plus daily games", "Collect a passport stamp for every park", "Pick a month, get a score for every park"],
    tabs: ["home", "planner", "saved", "student", "explore", "passport"],
  },
  researcher: {
    label: "Researcher",
    emoji: "🔬",
    tagline: "Full trend atlas with statistics",
    blurb: "You want every test, every period, and the raw results.",
    bullets: ["Sen's slope, Mann-Kendall, FDR q-values", "Analog sites, odd neighbours, season wheel", "Head-to-head, Cite this, and the Campfire board"],
    tabs: ["home", "atlas", "map", "analogs", "families", "opposites", "seasons", "compare", "robust", "community"],
  },
};

const KEY = "profile";

/** Visitor and Student were merged into Explorer. */
function migrate(p: { name?: string; persona?: string }): Profile {
  return { name: p.name ?? "", persona: p.persona === "researcher" ? "researcher" : "explorer" };
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw) as { name?: string; persona?: string });
    // Older builds stored only a persona string.
    const old = localStorage.getItem("persona");
    if (old) {
      const p = JSON.parse(old) as string | null;
      if (p) return migrate({ name: "", persona: p });
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
