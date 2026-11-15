// Trend Detective tab: national atlas table + per-park drill-down.
import { useEffect, useMemo, useState } from "react";
import type { Atlas, AtlasCell } from "./model";
import { PERIOD_LABEL, VERDICT_LABEL } from "./model";
import ParkDetective from "./ParkDetective";
import { useInsights } from "../research/lib";

// Park name lookup (we get it from atlas cells' park metadata via per-park fetch,
// but the atlas itself only has park_id). We'll keep a minimal static map for labels.
export const PARK_NAMES: Record<string, string> = {
  acad: "Acadia", arch: "Arches", badl: "Badlands", bibe: "Big Bend",
  bisc: "Biscayne", blca: "Black Canyon", brca: "Bryce Canyon", cany: "Canyonlands",
  care: "Capitol Reef", cave: "Carlsbad Caverns", chis: "Channel Islands",
  chir: "Chiricahua",
  cong: "Congaree", crla: "Crater Lake", cuva: "Cuyahoga Valley",
  dena: "Denali", deva: "Death Valley", drto: "Dry Tortugas", ever: "Everglades",
  gaar: "Gates of the Arctic", jeff: "Gateway Arch", glac: "Glacier",
  glba: "Glacier Bay", grca: "Grand Canyon", grte: "Grand Teton",
  grba: "Great Basin", grsa: "Great Sand Dunes", grsm: "Great Smoky Mtns",
  gumo: "Guadalupe Mtns", hale: "Haleakalā", havo: "Hawaiʻi Volcanoes",
  hosp: "Hot Springs", indu: "Indiana Dunes", isro: "Isle Royale",
  jotr: "Joshua Tree", katm: "Katmai", kefj: "Kenai Fjords",
  kova: "Kobuk Valley", lacl: "Lake Clark", lavo: "Lassen Volcanic",
  maca: "Mammoth Cave", meve: "Mesa Verde", mora: "Mt Rainier",
  neri: "New River Gorge", noca: "North Cascades", npsa: "American Samoa",
  olym: "Olympic", pefo: "Petrified Forest", pinn: "Pinnacles", redw: "Redwood",
  romo: "Rocky Mountain", sagu: "Saguaro", seki: "Sequoia/Kings Canyon",
  shen: "Shenandoah", thro: "Theodore Roosevelt", viis: "Virgin Islands",
  voya: "Voyageurs", whsa: "White Sands", wica: "Wind Cave",
  wrst: "Wrangell–St. Elias", yell: "Yellowstone", yose: "Yosemite", zion: "Zion",
};

export default function Detective({
  initialParkId,
  onParkChange,
  simple = false,
}: {
  initialParkId?: string | null;
  onParkChange?: (parkId: string | null) => void;
  /** Student "Park Explorer": annual trends, plain language, no q-values or download. */
  simple?: boolean;
}) {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selVar, setSelVar] = useState("tmax_c");
  const [selPeriod, setSelPeriod] = useState("annual");
  const periodShown = simple ? "annual" : selPeriod;
  const [selPark, setSelPark] = useState<string | null>(initialParkId ?? null);
  const [useFahrenheit, setUseFahrenheit] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "slope" | "verdict">("verdict");
  const [q, setQ] = useState("");
  const [fVerdict, setFVerdict] = useState("all");
  const [fDir, setFDir] = useState("all");
  const [fFamily, setFFamily] = useState("all");
  const [fState, setFState] = useState("all");
  const { data: insights } = useInsights();

  // The URL is the source of truth: back/forward changes initialParkId.
  useEffect(() => {
    setSelPark(initialParkId ?? null);
  }, [initialParkId]);

  // Sync selPark changes back to the URL via onParkChange.
  function selectPark(id: string | null) {
    setSelPark(id);
    onParkChange?.(id);
  }

  useEffect(() => {
    fetch("/api/trends/atlas")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<Atlas>;
      })
      .then((d) => {
        setAtlas(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const cells: AtlasCell[] = useMemo(() => {
    if (!atlas) return [];
    return atlas.atlas[selVar]?.[periodShown] ?? [];
  }, [atlas, selVar, periodShown]);

  const isTemp = atlas?.variables[selVar]?.unit.includes("°");

  const stateOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of insights?.parks ?? []) m.set(p.id, p.state ?? "");
    return m;
  }, [insights]);
  const states = useMemo(
    () => Array.from(new Set((insights?.parks ?? []).flatMap((p) => (p.state ?? "").split(/,\s*/)).filter(Boolean))).sort(),
    [insights],
  );

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const c = cells.filter((x) => {
      if (needle && !(PARK_NAMES[x.park_id] ?? x.park_id).toLowerCase().includes(needle)) return false;
      if (fVerdict === "sig" ? !(x.verdict === "real" || x.verdict === "possible") : fVerdict !== "all" && x.verdict !== fVerdict) return false;
      if (fDir === "up" && !(x.sen != null && x.sen > 0)) return false;
      if (fDir === "down" && !(x.sen != null && x.sen < 0)) return false;
      if (fFamily !== "all" && String(insights?.families.parks[x.park_id]?.family) !== fFamily) return false;
      if (fState !== "all" && !(stateOf.get(x.park_id) ?? "").includes(fState)) return false;
      return true;
    });
    if (sortBy === "name")
      return c.sort((a, b) =>
        (PARK_NAMES[a.park_id] ?? a.park_id).localeCompare(
          PARK_NAMES[b.park_id] ?? b.park_id,
        ),
      );
    if (sortBy === "slope")
      return c.sort((a, b) => (b.sen ?? 0) - (a.sen ?? 0));
    // verdict order: real > possible > none > short > flat
    const order: Record<string, number> = {
      real: 0, possible: 1, none: 2, short: 3, flat: 4,
    };
    return c.sort(
      (a, b) =>
        (order[a.verdict] ?? 9) - (order[b.verdict] ?? 9) ||
        Math.abs(b.sen ?? 0) - Math.abs(a.sen ?? 0),
    );
  }, [cells, sortBy, q, fVerdict, fDir, fFamily, fState, insights, stateOf]);

  if (loading)
    return (
      <div style={{ padding: 32, color: "var(--text-muted)" }}>
        Loading trend atlas…
      </div>
    );
  if (error || !atlas)
    return (
      <div style={{ padding: 32, color: "var(--error)" }}>
        Error: {error}. Is the backend running?
      </div>
    );

  const vars = Object.keys(atlas.variables);

  if (selPark) {
    return (
      <ParkDetective
        parkId={selPark}
        parkName={PARK_NAMES[selPark] ?? selPark}
        atlas={atlas}
        onBack={() => selectPark(null)}
        useFahrenheit={useFahrenheit}
        simple={simple}
      />
    );
  }

  const unit = atlas.variables[selVar]?.unit;
  const displayUnit = isTemp && useFahrenheit ? "°F" : unit;

  // Real-trend count for the selected map
  const realCount = cells.filter((c) => c.verdict === "real").length;
  const possibleCount = cells.filter((c) => c.verdict === "possible").length;

  function verdictDot(verdict: string) {
    const colors: Record<string, string> = {
      real: "#2a7d4f",
      possible: "#b8860b",
      none: "#aaa",
      short: "#ccc",
      flat: "#ccc",
    };
    return (
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: colors[verdict] ?? "#ccc",
          marginRight: 6,
          flexShrink: 0,
        }}
      />
    );
  }

  function slopeDisplay(cell: AtlasCell) {
    if (cell.sen == null) return "—";
    const v = isTemp && useFahrenheit ? cell.sen * 1.8 : cell.sen;
    return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Atlas header */}
      <div style={{ borderBottom: "2px solid var(--pine)", paddingBottom: 12 }}>
        <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)", fontSize: 22, fontWeight: 700, color: "var(--pine)" }}>
          {simple ? "Park Explorer" : "National Trend Atlas"}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          {simple
            ? "Pick something to look at, then tap a park to see how it has changed since 1981 and whether the change is real."
            : "6,324 Mann-Kendall significance tests · 63 parks · NASA POWER 1981–2026 · click any park to drill down"}
        </p>
      </div>
      {/* Controls row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Variable
          </span>
          <select
            value={selVar}
            onChange={(e) => setSelVar(e.target.value)}
            style={{
              border: "1.5px solid var(--border)",
              borderRadius: 10,
              padding: "7px 12px",
              background: "var(--surface)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {vars.map((v) => (
              <option key={v} value={v}>
                {atlas.variables[v]?.label}
              </option>
            ))}
          </select>
        </label>

        {!simple && (
          <>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Period
          </span>
          <select
            value={selPeriod}
            onChange={(e) => setSelPeriod(e.target.value)}
            style={{
              border: "1.5px solid var(--border)",
              borderRadius: 10,
              padding: "7px 12px",
              background: "var(--surface)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {atlas.periods.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p] ?? p}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Sort
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              border: "1.5px solid var(--border)",
              borderRadius: 10,
              padding: "7px 12px",
              background: "var(--surface)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            <option value="verdict">By verdict</option>
            <option value="slope">By slope (largest first)</option>
            <option value="name">By name</option>
          </select>
        </label>

          </>
        )}

        {isTemp && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              cursor: "pointer",
              padding: "6px 0",
            }}
          >
            <input
              type="checkbox"
              checked={useFahrenheit}
              onChange={(e) => setUseFahrenheit(e.target.checked)}
            />
            Show °F
          </label>
        )}

        <div
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "var(--text-muted)",
            alignSelf: "center",
          }}
        >
          <strong style={{ color: "#155724" }}>{realCount} real</strong>
          {" · "}
          <strong style={{ color: "#856404" }}>{possibleCount} possible</strong>
          {" · "}
          {cells.length} parks
        </div>
      </div>

      {!simple && (
        <div className="row gap-8" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="field"><span className="small muted">Search</span>
            <input className="text-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Park name" /></label>
          <label className="field"><span className="small muted">Verdict</span>
            <select className="text-input" value={fVerdict} onChange={(e) => setFVerdict(e.target.value)}>
              <option value="all">All</option><option value="sig">Real or possible</option>
              <option value="real">Real</option><option value="possible">Possible</option>
              <option value="none">No trend</option></select></label>
          <label className="field"><span className="small muted">Direction</span>
            <select className="text-input" value={fDir} onChange={(e) => setFDir(e.target.value)}>
              <option value="all">Any</option><option value="up">Rising</option><option value="down">Falling</option></select></label>
          <label className="field"><span className="small muted">Family</span>
            <select className="text-input" value={fFamily} onChange={(e) => setFFamily(e.target.value)}>
              <option value="all">Any</option>
              {(insights?.families.families ?? []).map((f) => <option key={f.id} value={String(f.id)}>Family {f.id} ({f.size})</option>)}</select></label>
          <label className="field"><span className="small muted">State</span>
            <select className="text-input" value={fState} onChange={(e) => setFState(e.target.value)}>
              <option value="all">Any</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <a className="btn-ghost" style={{ textDecoration: "none" }}
            href={`/api/trends/export.csv?variable=${selVar}&period=${periodShown}&parks=${sorted.map((c) => c.park_id).join(",")}`}
            download="park-trends.csv">
            ⬇ CSV ({sorted.length} parks, full statistics)
          </a>
        </div>
      )}

      {/* Notable highlights */}
      {(() => {
        const notable = [...cells]
          .filter((c) => c.verdict === "real" && c.sen != null)
          .sort((a, b) => Math.abs(b.sen!) - Math.abs(a.sen!))
          .slice(0, 3);
        if (!notable.length) return null;
        return (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", fontSize: 13 }}>
            <strong>Notable: </strong>
            {notable.map((c, i) => {
              const v = isTemp && useFahrenheit ? (c.sen! * 1.8) : c.sen!;
              return (
                <span key={c.park_id}>
                  {i > 0 && " · "}
                  <button onClick={() => selectPark(c.park_id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontWeight: 600, fontSize: 13, padding: 0, textDecoration: "underline" }}>
                    {PARK_NAMES[c.park_id] ?? c.park_id}
                  </button>
                  {" "}{v > 0 ? "+" : ""}{v.toFixed(2)} {displayUnit}/dec
                </span>
              );
            })}
          </div>
        );
      })()}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <strong>
          {atlas.variables[selVar]?.label} · {PERIOD_LABEL[periodShown] ?? periodShown}
        </strong>
        {" — "}
        {simple
          ? `${realCount} of ${cells.length} parks have a change that is very unlikely to be luck. Tap a park to see it.`
          : realCount > 0
          ? `${realCount} of ${cells.length} parks show a statistically real trend (q < 0.05 after FDR correction). `
          : `No parks show a statistically confirmed trend for this variable and period. `}
        {!simple && possibleCount > 0
          ? `${possibleCount} more show a possible trend (p < 0.05 but not confirmed after multiple-testing correction). `
          : ""}
        {simple
          ? `Numbers show change per 10 years (${displayUnit}).`
          : `Slope values are ${displayUnit} per decade · click any park to see its full chart and time series.`}
      </div>

      {/* Park list */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
        }}
      >
        {sorted.map((cell) => {
          const slope = slopeDisplay(cell);
          const isRising =
            cell.sen != null && cell.sen > 0;
          return (
            <button
              key={cell.park_id}
              onClick={() => selectPark(cell.park_id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            >
              {verdictDot(cell.verdict)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {PARK_NAMES[cell.park_id] ?? cell.park_id}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    display: "flex",
                    gap: 8,
                    marginTop: 2,
                  }}
                >
                  <span
                    style={{
                      color:
                        cell.verdict === "real"
                          ? "#155724"
                          : cell.verdict === "possible"
                            ? "#856404"
                            : "var(--text-muted)",
                      fontWeight: cell.verdict === "real" ? 600 : 400,
                    }}
                  >
                    {VERDICT_LABEL[cell.verdict] ?? cell.verdict}
                  </span>
                  {cell.sen != null && (
                    <span
                      style={{
                        color: isRising ? "#9c3b1b" : "#2f5d3a",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {slope} {displayUnit}/dec
                    </span>
                  )}
                  {!simple && cell.q != null && (
                    <span>q={cell.q.toFixed(3)}</span>
                  )}
                </div>
              </div>
              <span
                style={{ fontSize: 16, color: "var(--text-muted)", flexShrink: 0 }}
              >
                →
              </span>
            </button>
          );
        })}
      </div>

      {!simple && (
        <>
      {/* Footer */}
      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
        <span>
          Data: NASA POWER / MERRA-2 1981–2026 · Statistics: Sen's slope + Mann-Kendall test ·
          p-values corrected for autocorrelation (Hamed-Rao) where present ·
          False discovery rate corrected across parks (Benjamini-Hochberg) ·
          6,324 tests across 63 US national parks
        </span>
        <a
          href="/api/trends/atlas"
          download="park-trends-atlas.json"
          style={{
            display: "inline-block",
            padding: "6px 14px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 12,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          ⬇ Download atlas.json
        </a>
      </div>
        </>
      )}
    </div>
  );
}
