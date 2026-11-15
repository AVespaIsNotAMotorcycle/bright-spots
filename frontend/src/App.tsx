import { useEffect, useState } from "react";
import Home from "./Home";
import Landing from "./Landing";
import Detective from "./detective/Detective";
import StudentDetective from "./detective/StudentDetective";
import type { Atlas } from "./detective/model";
import Planner from "./planner/Planner";
import Compare from "./research/Compare";
import Families from "./research/Families";
import MapView from "./research/MapView";
import Opposites from "./research/Opposites";
import Robust from "./research/Robust";
import { PERSONAS, TAB_LABEL, loadProfile, saveProfile, type Profile, type Tab } from "./profile";
import { useNav, type NavState } from "./useNav";

export default function App() {
  const { nav, navigate, replace } = useNav();
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [editing, setEditing] = useState(false);
  const [atlas, setAtlas] = useState<Atlas | null>(null);

  // Each persona only gets its own tabs; a URL for another persona's tab
  // falls back to Home.
  const allowedTabs: Tab[] = profile ? PERSONAS[profile.persona].tabs : ["home"];
  const tab: Tab = nav.tab && allowedTabs.includes(nav.tab) ? nav.tab : "home";

  useEffect(() => {
    if (!nav.tab) replace({ tab: "home" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          {allowedTabs.map((t) => (
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
            ⚙ Profile
          </button>
        </nav>
      </header>
      <main>
        {tab === "home" && (
          <Home persona={profile.persona} name={profile.name} atlas={atlas} onGo={go} />
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
          <Planner
            onViewTrend={(code) => go(exploreTab, { park: code })}
            initialMonth={nav.month ?? undefined}
          />
        )}
      </main>
    </div>
  );
}
