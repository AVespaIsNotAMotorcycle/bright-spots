import { Suspense, lazy, useEffect, useRef, useState } from "react";
import ErrorBoundary from "./ErrorBoundary";
import Landing from "./Landing";
import type { Atlas } from "./detective/model";
import type { Unit } from "./planner/PrefsPanel";
import { StationStrip, StationStyle } from "./research/station";

// Each tab is its own chunk, loaded the first time it is opened.
const Home = lazy(() => import("./Home"));
const Detective = lazy(() => import("./detective/Detective"));
const StudentDetective = lazy(() => import("./detective/StudentDetective"));
const TripPlanner = lazy(() => import("./planner/trip/TripPlanner"));
const Compare = lazy(() => import("./research/Compare"));
const Families = lazy(() => import("./research/Families"));
const MapView = lazy(() => import("./research/MapView"));
const Opposites = lazy(() => import("./research/Opposites"));
const Robust = lazy(() => import("./research/Robust"));
const Seasons = lazy(() => import("./research/Seasons"));
const Community = lazy(() => import("./research/Community"));
const Analogs = lazy(() => import("./research/Analogs"));
const Passport = lazy(() => import("./detective/PassportPage"));
import { PARK_NAMES } from "./detective/parkNames";
import { PERSONAS, TAB_LABEL, loadProfile, saveProfile, type Profile, type Tab } from "./profile";
import { useNav, type NavState } from "./useNav";

const HOME_ONLY: Tab[] = ["home"];

// Researcher nav: a few top buttons, with the many tools folded into two menus.
const NAV_GROUPS: (Tab | { label: string; tabs: Tab[] })[] = [
  "home",
  { label: "🧭 Explore", tabs: ["atlas", "map", "analogs", "families", "seasons"] },
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

function loadScience(): boolean {
  try {
    return localStorage.getItem("explorer.science") === "true";
  } catch {
    return false;
  }
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
  // Explorer "science" switch: off shows plain words, on adds the statistics.
  const [science, setScience] = useState<boolean>(loadScience);
  const [sciNote, setSciNote] = useState(false);
  useEffect(() => {
    if (!sciNote) return;
    const t = setTimeout(() => setSciNote(false), 4500);
    return () => clearTimeout(t);
  }, [sciNote, science]);
  useEffect(() => {
    try {
      localStorage.setItem("explorer.science", String(science));
    } catch {
      /* storage unavailable */
    }
  }, [science]);
  useEffect(() => {
    try {
      localStorage.setItem("planner.unit", JSON.stringify(unit));
    } catch {
      /* storage unavailable */
    }
  }, [unit]);

  // Each persona only gets its own tabs; a URL for another persona's tab
  // falls back to Home.
  const allowedTabs: Tab[] = profile ? PERSONAS[profile.persona].tabs : HOME_ONLY;
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
      const el = e.target instanceof Element ? e.target : null; // can be window or document
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
          {profile.persona === "explorer" && (
            <button
              role="switch"
              aria-checked={science}
              onClick={() => {
                setScience((x) => !x);
                setSciNote(true);
              }}
              className={`nav-tab${science ? " active" : ""}`}
              title="Show the statistics behind each trend (p, q, every season)"
            >
              🔬 Science {science ? "on" : "off"}
            </button>
          )}
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
      {sciNote && profile.persona === "explorer" && (
        <div role="status" className="sci-toast">
          {science
            ? "🔬 Science on: factor scores and weights in the Trip Planner, q-values on Home, and the full atlas in Park Explorer."
            : "🔬 Science off: plain words everywhere."}
        </div>
      )}
      <main>
        <ErrorBoundary key={tab} what="This page">
        <Suspense fallback={<p className="muted">Loading…</p>}>
        {profile.persona === "researcher" && tab !== "home" && (
          <StationStrip
            title={TAB_LABEL[tab].replace(/^\S+\s/, "")}
            atlas={atlas}
            ctx={{ park: nav.park, parkName: nav.park ? PARK_NAMES[nav.park] : null, variable: nav.v, period: nav.per }}
            cite={tab !== "community"}
            onShare={tab === "community" ? undefined : () =>
              go("community", { park: nav.park ?? undefined, v: nav.v ?? undefined, per: nav.per ?? undefined })}
          />
        )}
        {tab === "home" && (
          <Home persona={profile.persona} name={profile.name} atlas={atlas} onGo={go} science={science} />
        )}
        {tab === "analogs" && (
          <Analogs
            atlas={atlas}
            park={nav.park}
            onPark={(id) => navigate({ tab: "analogs", park: id })}
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
            onGoPlanner={(month, park) => go("planner", { month: month ?? undefined, park })}
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
            simple={tab === "explore" && !science}
            initialParkId={nav.park ?? null}
            onParkChange={(parkId) =>
              parkId ? navigate({ tab, park: parkId }) : navigate({ tab })
            }
          />
        )}
        {tab === "passport" && (
          <Passport
            onCase={(c) => go("student", { caseId: c.id, step: 0 })}
            onExplore={(park) => go("explore", { park })}
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
          <TripPlanner
            unit={unit}
            setUnit={setUnit}
            month={nav.month}
            park={nav.park}
            q={nav.q}
            science={science}
            onState={(q) => replace({ tab: "planner", q })}
            onCase={profile.persona === "explorer" ? (caseId) => go("student", { caseId, step: 0 }) : undefined}
          />
        )}
        </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
