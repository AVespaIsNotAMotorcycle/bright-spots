import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import ErrorBoundary from "./ErrorBoundary";
import Landing from "./Landing";
import { logOutAccount, updateAccount } from "./auth";
import type { Atlas } from "./detective/model";
import type { Unit } from "./planner/PrefsPanel";
import { StationStrip } from "./research/station";

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
const SavedPage = lazy(() => import("./detective/SavedPage"));
import { PARK_NAMES } from "./detective/parkNames";
import Logo from "./brand/Logo";
import { EXPLORER_TABS, RESEARCH_TABS, TAB_LABEL, allowedTabs, loadProfile, saveProfile, type Profile, type Tab } from "./profile";
import { useNav, type NavState } from "./useNav";

/** A small dropdown: closes on outside click, Escape and Tab; arrows move between items. */
function Menu({
  label,
  active,
  align = "left",
  className = "nav-tab",
  children,
}: {
  label: React.ReactNode;
  active?: boolean;
  align?: "left" | "right";
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      btn.current?.focus();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    ref.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") return setOpen(false);
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };
  return (
    <div className="menu" ref={ref}>
      <button
        ref={btn}
        type="button"
        className={`${className}${active ? " active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label}
      </button>
      {open && (
        <div className={`menu-list ${align}`} role="menu" onKeyDown={onListKey}>
          {children(close)}
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

  // Research tabs only exist when research tools are on; any other tab in the URL falls back to Home.
  const research = profile?.research ?? false;
  const allowed = useMemo(() => (profile ? allowedTabs(research) : ["home" as Tab]), [profile, research]);
  const tab: Tab = nav.tab && allowed.includes(nav.tab) ? nav.tab : "home";
  const hiddenResearchTab = !!nav.tab && !allowed.includes(nav.tab) && RESEARCH_TABS.includes(nav.tab);

  useEffect(() => {
    if (!nav.tab) replace({ tab: "home" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // An unknown path (/foo) or tab (#tab=foo) shows Home, so fix the URL to match.
  useEffect(() => {
    if (nav.tab && !allowedTabs(true).includes(nav.tab)) replace({ tab: "home" });
  }, [nav.tab, replace]);

  // Research tools on: ← and → move between the research tools, unless typing or using a control.
  useEffect(() => {
    if (!research || editing || !RESEARCH_TABS.includes(tab)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target instanceof Element ? e.target : null; // can be window or document
      if (el?.closest("input, textarea, select, button, [contenteditable=true], [role=menu], [role=dialog]")) return;
      const i = RESEARCH_TABS.indexOf(tab);
      const next = RESEARCH_TABS[(i + (e.key === "ArrowRight" ? 1 : -1) + RESEARCH_TABS.length) % RESEARCH_TABS.length];
      navigate({ tab: next });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [research, editing, tab, navigate]);

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
    updateAccount(p);
    // Logging in swaps in that user's saved data; read their unit back into state.
    if (!editing) setUnit(loadUnit());
    setEditing(false);
    // Keep a deep link (e.g. a shared trip) and an edit in place; otherwise go Home.
    if (!editing && !nav.tab) navigate({ tab: "home" });
  }

  function setResearch(on: boolean) {
    if (!profile) return;
    const p = { ...profile, research: on };
    setProfile(p);
    saveProfile(p);
    updateAccount(p);
    // Turning research off while on a research page would leave a blank tab: go Home.
    if (!on && RESEARCH_TABS.includes(tab)) navigate({ tab: "home" });
  }

  function logOut() {
    logOutAccount(profile);
    setUnit(loadUnit()); // the stored unit was just put away with the account
    setProfile(null);
    saveProfile(null);
    navigate({ tab: "home" });
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

  const initial = (profile.name.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go("home")} aria-label="Canopy home">
          <Logo size={28} />
        </button>
        <nav className="nav-tabs" aria-label="Main">
          {EXPLORER_TABS.map((t) => (
            <button key={t} type="button" className={`nav-tab${tab === t ? " active" : ""}`} aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>
        <div className="nav-right">
          {research && (
            <Menu label={<>{RESEARCH_TABS.includes(tab) ? `Research: ${TAB_LABEL[tab]}` : "Research"} ▾</>} active={RESEARCH_TABS.includes(tab)} align="right">
              {(close) =>
                RESEARCH_TABS.map((t) => (
                  <button key={t} type="button" role="menuitem" className={t === tab ? "on" : undefined} onClick={() => { close(); go(t); }}>
                    {TAB_LABEL[t]}
                  </button>
                ))
              }
            </Menu>
          )}
          <Menu label={initial} className="avatar" align="right">
            {(close) => (
              <>
                <div className="menu-head">{profile.name || "Guest"}{profile.email && <span className="micro muted" style={{ display: "block" }}>{profile.email}</span>}</div>
                <button type="button" role="menuitemcheckbox" aria-checked={research} onClick={() => setResearch(!research)}>
                  Research tools: {research ? "on" : "off"}
                </button>
                <button type="button" role="menuitem" onClick={() => { close(); setEditing(true); }}>
                  Edit profile
                </button>
                <button type="button" role="menuitem" onClick={() => { close(); logOut(); }}>
                  {profile.email ? "Log out" : "Sign up or log in"}
                </button>
              </>
            )}
          </Menu>
        </div>
      </header>
      <main>
        <ErrorBoundary key={tab} what="This page">
        <Suspense fallback={<p className="muted">Loading…</p>}>
        {hiddenResearchTab && (
          <p className="notice">
            That page is part of the research tools.{" "}
            <button type="button" className="link-btn" onClick={() => setResearch(true)}>Turn them on</button>
          </p>
        )}
        {research && RESEARCH_TABS.includes(tab) && (
          <StationStrip
            title={TAB_LABEL[tab]}
            atlas={atlas}
            ctx={{ park: nav.park, parkName: nav.park ? PARK_NAMES[nav.park] : null, variable: nav.v, period: nav.per }}
            cite={tab !== "community"}
            onShare={tab === "community" ? undefined : () =>
              go("community", { park: nav.park ?? undefined, v: nav.v ?? undefined, per: nav.per ?? undefined })}
          />
        )}
        {tab === "home" && (
          <Home name={profile.name} research={research} atlas={atlas} onGo={(t, extra) => go(t as Tab, extra as Partial<NavState>)} />
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
            simple={tab === "explore"}
            initialParkId={nav.park ?? null}
            onParkChange={(parkId) =>
              parkId ? navigate({ tab, park: parkId }) : navigate({ tab })
            }
          />
        )}
        {tab === "saved" && (
          <SavedPage
            unit={unit}
            onPlan={(park, month) => go("planner", { park, ...(month ? { month } : {}) })}
            onExplore={(park) => go("explore", { park })}
          />
        )}
        {tab === "passport" && (
          <Passport
            onCase={(c) => go("student", { caseId: c.id, step: 0 })}
            onExplore={(park) => go("explore", { park })}
            onSaved={() => go("saved")}
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
            onState={(q) => replace({ tab: "planner", q, park: nav.park })}
            onCase={(caseId) => go("student", { caseId, step: 0 })}
          />
        )}
        </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
