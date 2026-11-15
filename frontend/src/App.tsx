import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import ErrorBoundary from "./ErrorBoundary";
import Landing from "./Landing";
import { enterGuest, logOutAccount, updateAccount } from "./auth";
import type { Atlas } from "./detective/model";
import type { Unit } from "./planner/PrefsPanel";
import { StationStrip } from "./research/station";

// Each tab is its own chunk, loaded the first time it is opened.
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
import { parseHash, useNav, type NavState } from "./useNav";

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

const GUEST: Profile = { name: "", research: false };

/** The saved profile, or a fresh guest: nobody has to sign in to use the site. */
function startProfile(): Profile {
  const saved = loadProfile();
  if (saved) return saved;
  enterGuest();
  saveProfile(GUEST);
  return GUEST;
}

export default function App() {
  const { nav, navigate, replace } = useNav();
  const [profile, setProfile] = useState<Profile>(startProfile);
  /** The sign-in form (from the profile menu) or the edit-profile form, over the app. */
  const [screen, setScreen] = useState<"signin" | "edit" | null>(null);
  const editing = screen !== null;
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [unit, setUnit] = useState<Unit>(loadUnit);
  useEffect(() => {
    try {
      localStorage.setItem("planner.unit", JSON.stringify(unit));
    } catch {
      /* storage unavailable */
    }
  }, [unit]);

  // Research tabs only exist when research tools are on; any other tab in the URL falls back to Plan.
  const research = profile.research;
  const allowed = useMemo(() => allowedTabs(research), [research]);
  const tab: Tab = nav.tab && allowed.includes(nav.tab) ? nav.tab : "planner";
  const hiddenResearchTab = !!nav.tab && !allowed.includes(nav.tab) && RESEARCH_TABS.includes(nav.tab);

  useEffect(() => {
    // Read the hash again: Plan may already have put its settings there.
    if (!nav.tab) replace({ ...parseHash(), tab: "planner" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // An unknown tab in the URL (#tab=foo, or the old #tab=home) shows Plan, so fix the URL to match.
  useEffect(() => {
    if (nav.tab && !allowedTabs(true).includes(nav.tab)) replace({ tab: "planner" });
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

  // Back/forward while a profile form is open closes the form and shows that page.
  useEffect(() => {
    if (screen === "signin") backToGuest();
    setScreen(null);
  }, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Logging in (or back in as a guest) swaps in that user's saved data; read their unit back into state.
    if (screen === "signin") setUnit(loadUnit());
    setScreen(null);
  }

  /** Become the guest again, with whatever the guest did last time on this device. */
  function backToGuest() {
    enterGuest();
    setProfile(GUEST);
    saveProfile(GUEST);
    setUnit(loadUnit());
  }

  /** Put the current user's data away and show the sign-in form. */
  function openSignIn() {
    logOutAccount(profile);
    saveProfile(null);
    setUnit(loadUnit());
    setScreen("signin");
  }

  function setResearch(on: boolean) {
    const p = { ...profile, research: on };
    setProfile(p);
    saveProfile(p);
    updateAccount(p);
    // Turning research off while on a research page would leave a blank tab: go to Plan.
    if (!on && RESEARCH_TABS.includes(tab)) navigate({ tab: "planner" });
  }

  /** Log out of an account: the site carries on as the guest. */
  function logOut() {
    logOutAccount(profile);
    backToGuest();
    navigate({ tab: "planner" });
  }

  const go = (t: Tab, extra: Partial<NavState> = {}) => navigate({ tab: t, ...extra });

  if (screen) {
    return (
      <div className="app">
        <Landing
          initial={screen === "edit" ? profile : null}
          onSubmit={submitProfile}
          onCancel={screen === "edit" ? () => setScreen(null) : undefined}
        />
      </div>
    );
  }

  const initial = (profile.name.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go("planner")} aria-label="Canopy: plan a visit">
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
            <Menu label={<>{RESEARCH_TABS.includes(tab) ? `Research: ${TAB_LABEL[tab]}` : "Research"} ▾</>} active={RESEARCH_TABS.includes(tab)}>
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
                <button type="button" role="menuitem" onClick={() => { close(); setScreen("edit"); }}>
                  Edit profile
                </button>
                <button type="button" role="menuitem" onClick={() => { close(); if (profile.email) logOut(); else openSignIn(); }}>
                  {profile.email ? "Log out" : "Sign up or log in"}
                </button>
              </>
            )}
          </Menu>
        </div>
      </header>
      <main>
        {hiddenResearchTab && (
          <p className="notice">
            That page is part of the research tools.{" "}
            <button type="button" className="link-btn" onClick={() => setResearch(true)}>Turn them on</button>
          </p>
        )}
        <ErrorBoundary key={tab} what="This page">
        <Suspense fallback={<p className="muted">Loading…</p>}>
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
            stage={nav.step === 1 || nav.park ? "parks" : "prefs"}
            // Only while Plan is the page in the URL: a research link it stands in for must stay as typed.
            onState={(q) => (!nav.tab || nav.tab === "planner") && replace({ tab: "planner", q, park: nav.park, step: nav.step })}
            onStage={(s) => navigate({ tab: "planner", q: nav.q ?? undefined, step: s === "parks" ? 1 : undefined })}
            onCase={(caseId) => go("student", { caseId, step: 0 })}
          />
        )}
        </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
