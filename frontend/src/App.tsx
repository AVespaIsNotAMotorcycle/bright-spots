import { useEffect, useRef, useState } from "react";
import Home from "./Home";
import Landing from "./Landing";
import Detective from "./detective/Detective";
import StudentDetective from "./detective/StudentDetective";
import type { Atlas } from "./detective/model";
import Planner from "./planner/Planner";
import PlannerShadow from "./planner/PlannerShadow";
import type { Unit } from "./planner/PrefsPanel";
import Compare from "./research/Compare";
import Families from "./research/Families";
import MapView from "./research/MapView";
import Opposites from "./research/Opposites";
import Robust from "./research/Robust";
import Seasons from "./research/Seasons";
import Community from "./research/Community";
import Twins from "./research/Twins";
import { StationStrip, StationStyle } from "./research/station";
import { PARK_NAMES } from "./detective/Detective";
import { PERSONAS, TAB_LABEL, loadProfile, saveProfile, type Profile, type Tab } from "./profile";
import { useNav, type NavState } from "./useNav";

// Researcher nav: a few top buttons, with the many tools folded into two menus.
const NAV_GROUPS: (Tab | { label: string; tabs: Tab[] })[] = [
  "home",
  { label: "🧭 Explore", tabs: ["atlas", "map", "twins", "families", "seasons"] },
  { label: "🥊 Compare", tabs: ["opposites", "compare", "robust"] },
  "community",
];

function NavMenu({ label, tabs, current, onGo }: { label: string; tabs: Tab[]; current: Tab; onGo: (t: Tab) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const active = tabs.includes(current);
  return (
    <div className="st-menu" ref={ref}>
      <StationStyle />
      <button className={`nav-tab${active ? " active" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        {label}{active ? `: ${TAB_LABEL[current].replace(/^\S+\s/, "")}` : ""} ▾
      </button>
      {open && (
        <div className="st-menu-list" role="menu">
          {tabs.map((t) => (
            <button key={t} role="menuitem" className={t === current ? "on" : undefined} onClick={() => { setOpen(false); onGo(t); }}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function loadUnit(): Unit {
  try {
    return localStorage.getItem("planner.unit") === '"C"' ? "C" : "F";
  } catch {
    return "F";
  }
}

export default function App() {
  const { nav, navigate, replace } = useNav();
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [editing, setEditing] = useState(false);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [unit, setUnit] = useState<Unit>(loadUnit);
  useEffect(() => {
    try {
      localStorage.setItem("planner.unit", JSON.stringify(unit));
    } catch {
      /* storage unavailable */
    }
  }, [unit]);

  // Each persona only gets its own tabs; a URL for another persona's tab
  // falls back to Home.
  const allowedTabs: Tab[] = profile ? PERSONAS[profile.persona].tabs : ["home"];
  const tab: Tab = nav.tab && allowedTabs.includes(nav.tab) ? nav.tab : "home";

  useEffect(() => {
    if (!nav.tab) replace({ tab: "home" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Researchers: ← and → move between tools, unless typing or using a control.
  useEffect(() => {
    if (profile?.persona !== "researcher" || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true], [role=menu], [role=dialog]")) return;
      const i = allowedTabs.indexOf(tab);
      const next = allowedTabs[(i + (e.key === "ArrowRight" ? 1 : -1) + allowedTabs.length) % allowedTabs.length];
      navigate({ tab: next });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile, editing, tab, allowedTabs, navigate]);

  // Back/forward while the profile form is open closes the form and shows that page.
  useEffect(() => {
    setEditing(false);
  }, [nav]);

  useEffect(() => {
    if (atlas) return;
    fetch("/api/trends/atlas")
      .then((r) => r.json() as Promise<Atlas>)
      .then(setAtlas)
      .catch(() => {});
  }, [atlas]);

  function submitProfile(p: Profile) {
    setProfile(p);
    saveProfile(p);
    setEditing(false);
    navigate({ tab: "home" }); // the Home screen changes with the persona
  }

  const go = (t: Tab, extra: Partial<NavState> = {}) => navigate({ tab: t, ...extra });

  if (!profile || editing) {
    return (
      <div className="app">
        <Landing
          initial={profile}
          onSubmit={submitProfile}
          onCancel={profile ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  const info = PERSONAS[profile.persona];
  const exploreTab: Tab = profile.persona === "researcher" ? "atlas" : "explore";

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1 className="title">Park Trend Detective</h1>
          <p className="small muted">
            {info.emoji} {profile.name ? `${profile.name} · ` : ""}{info.label} mode
          </p>
        </div>
        <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {profile.persona === "researcher"
            ? NAV_GROUPS.map((g) =>
                typeof g === "string" ? (
                  <button key={g} onClick={() => go(g)} className={`nav-tab${tab === g ? " active" : ""}`}>
                    {TAB_LABEL[g]}
                  </button>
                ) : (
                  <NavMenu key={g.label} label={g.label} tabs={g.tabs} current={tab} onGo={go} />
                ),
              )
            : allowedTabs.map((t) => (
                <button
                  key={t}
                  onClick={() => go(t)}
                  className={`nav-tab${tab === t ? " active" : ""}`}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
          <button
            onClick={() => setEditing(true)}
            style={{
              marginLeft: 8,
              padding: "7px 12px",
              borderRadius: 20,
              border: "1px solid var(--border)",
              background: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 12,
            }}
            title="Edit profile"
          >
            ⚙️ Profile
          </button>
        </nav>
      </header>
      <main>
        {profile.persona === "researcher" && tab !== "home" && (
          <StationStrip
            title={TAB_LABEL[tab].replace(/^\S+\s/, "")}
            atlas={atlas}
            ctx={{ park: nav.park, parkName: nav.park ? PARK_NAMES[nav.park] : null, variable: nav.v, period: nav.per }}
            onShare={tab === "community" ? undefined : () =>
              go("community", { park: nav.park ?? undefined, v: nav.v ?? undefined, per: nav.per ?? undefined })}
          />
        )}
        {tab === "home" && (
          <Home persona={profile.persona} name={profile.name} atlas={atlas} onGo={go} />
        )}
        {tab === "twins" && (
          <Twins
            atlas={atlas}
            park={nav.park}
            onPark={(id) => navigate({ tab: "twins", park: id })}
            onCompare={(a, b) => go("compare", { park: a, park2: b })}
            onOpenPark={(id) => go("atlas", { park: id })}
          />
        )}
        {tab === "community" && (
          <Community
            atlas={atlas}
            name={profile.name}
            park={nav.park}
            v={nav.v}
            per={nav.per}
            onOpenPark={(park, v, per) => go("robust", { park, v: v ?? undefined, per: per ?? undefined })}
          />
        )}
        {tab === "student" && (
          <StudentDetective
            atlas={atlas ?? { variables: {}, periods: [], atlas: {} }}
            onGoPlanner={(month) => go("planner", { month })}
            navCaseId={nav.caseId}
            navStep={nav.step}
            onNavChange={(caseId, step) =>
              navigate({ tab: "student", ...(caseId ? { caseId, step: step ?? 0 } : {}) })
            }
          />
        )}
        {(tab === "atlas" || tab === "explore") && (
          <Detective
            key={tab}
            simple={tab === "explore"}
            initialParkId={nav.park ?? null}
            onParkChange={(parkId) =>
              parkId ? navigate({ tab, park: parkId }) : navigate({ tab })
            }
          />
        )}
        {tab === "map" && (
          <MapView
            atlas={atlas}
            initialVar={nav.v}
            initialPeriod={nav.per}
            onOpenPark={(id) => go("atlas", { park: id })}
          />
        )}
        {tab === "families" && <Families atlas={atlas} onOpenPark={(id) => go("atlas", { park: id })} />}
        {tab === "opposites" && (
          <Opposites
            atlas={atlas}
            onCompare={(a, b, v, per) => go("compare", { park: a, park2: b, v, per })}
          />
        )}
        {tab === "seasons" && <Seasons atlas={atlas} onOpenPark={(id) => go("atlas", { park: id })} />}
        {tab === "compare" && (
          <Compare
            atlas={atlas}
            a={nav.park}
            b={nav.park2}
            v={nav.v}
            per={nav.per}
            onChange={(a, b, v, per) => navigate({ tab: "compare", park: a, park2: b, v, per })}
          />
        )}
        {tab === "robust" && (
          <Robust
            atlas={atlas}
            park={nav.park}
            v={nav.v}
            per={nav.per}
            onChange={(park, v, per) => navigate({ tab: "robust", park, v, per })}
          />
        )}
        {tab === "planner" && (
          <PlannerShadow>
            <Planner unit={unit} setUnit={setUnit} month={nav.month} />
          </PlannerShadow>
        )}
      </main>
    </div>
  );
}
