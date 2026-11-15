// Researcher "field station" look: topo-line cards, specimen tags, and the Cite this pop-up.
// Same earth palette as Student mode, calmer motion.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { E, RIDGE, TOPO } from "../detective/StudentWidgets";
import { PERIOD_LABEL } from "../detective/model";
import type { Atlas } from "../detective/model";
import { BIB } from "./Robust";

export { E, RIDGE, TOPO };

export const STATION_CSS = `
@keyframes st-ring { 0% { transform: scale(.6); opacity: .7 } 100% { transform: scale(1.9); opacity: 0 } }
@keyframes st-in { from { transform: translateY(6px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes st-pop { from { transform: scale(.94); opacity: 0 } to { transform: scale(1); opacity: 1 } }
.st-card { position: relative; overflow: hidden; border-radius: 14px; border: 1px solid ${E.sage};
  background: ${TOPO}, linear-gradient(180deg, ${E.cream}, #f3ead6); background-size: 220px, auto; color: ${E.bark};
  box-shadow: 0 2px 10px rgba(74,55,38,.10); animation: st-in .35s ease both }
.st-hero { padding: 22px 22px 54px; background: ${RIDGE} bottom/100% 70px no-repeat, ${TOPO}, linear-gradient(160deg, #eef0dc, ${E.sand});
  background-size: 100% 70px, 220px, auto }
.st-tag { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 8px; border-radius: 4px 12px 12px 4px;
  background: ${E.sand}; border: 1px dashed ${E.clay}; font: 600 11px/1.4 var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: ${E.bark} }
.st-tag::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: ${E.cream}; border: 1.5px solid ${E.clay} }
.st-tile { text-align: left; cursor: pointer; padding: 14px; border-radius: 12px; border: 1px solid ${E.sage};
  background: ${E.cream}; color: ${E.bark}; transition: transform .15s, box-shadow .15s, border-color .15s; position: relative; overflow: hidden }
.st-tile:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(74,55,38,.18); border-color: ${E.moss} }
.st-tile .st-ico { font-size: 26px; display: block; margin-bottom: 6px }
.st-tile::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 4px; background: var(--tile, ${E.moss}) }
.st-num { font: 700 26px/1.1 var(--font-display); color: ${E.pine} }
.st-btn { padding: 8px 14px; border-radius: 20px; border: 1px solid ${E.pine}; background: ${E.pine}; color: ${E.cream};
  font-weight: 600; cursor: pointer; font-size: 13px }
.st-btn.ghost { background: transparent; color: ${E.pine} }
.st-btn:hover { filter: brightness(1.1) }
.st-ring { transform-box: fill-box; transform-origin: center; animation: st-ring 2.8s ease-out infinite }
.st-pop { animation: st-pop .25s cubic-bezier(.2,1.2,.4,1) both }
@media (prefers-reduced-motion: reduce) { .st-card, .st-ring, .st-pop { animation: none } .st-ring { opacity: .35 } }
`;

export function StationStyle() {
  return <style>{STATION_CSS}</style>;
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="st-tag">{children}</span>;
}

// ---------- Cite this ----------

const REPO = "https://github.com/AVespaIsNotAMotorcycle/bright-spots";
const POWER_ACK =
  "These data were obtained from the NASA Langley Research Center (LaRC) POWER Project " +
  "funded through the NASA Earth Science/Applied Science Program.";

/** One honest line under every research widget: where the numbers come from. */
export function Source({ extra }: { extra?: string }) {
  return (
    <p className="micro" style={{ margin: "8px 0 0", color: E.moss }}>
      Data: NASA POWER daily, one grid point (about 50 km wide) per park, 1981–2025.
      {extra ? ` ${extra}` : ""}
    </p>
  );
}

export interface CiteContext {
  park?: string | null;
  parkName?: string | null;
  variable?: string | null;
  period?: string | null;
  tool?: string;
}

function citations(ctx: CiteContext, atlas: Atlas | null) {
  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();
  const view = [
    ctx.tool,
    ctx.parkName ?? ctx.park,
    ctx.variable ? atlas?.variables[ctx.variable]?.label ?? ctx.variable : null,
    ctx.period ? PERIOD_LABEL[ctx.period] ?? ctx.period : null,
  ].filter(Boolean).join(", ");
  const url = typeof location !== "undefined" ? location.href : REPO;
  const apa =
    `Park Trend Detective. (${year}). ${view ? `${view} ` : ""}[Data set and web app]. NASA Space Apps Challenge. ` +
    `Retrieved ${today}, from ${url}\n\n` +
    `NASA Langley Research Center. (n.d.). NASA Prediction Of Worldwide Energy Resources (POWER), daily data. ` +
    `Retrieved ${today}, from https://power.larc.nasa.gov/\n\n` +
    `Acknowledgement (requested by NASA POWER): ${POWER_ACK}`;
  const bib =
    `@misc{parktrenddetective${year},\n  title  = {Park Trend Detective${view ? `: ${view}` : ""}},\n` +
    `  author = {{Park Trend Detective team}},\n  year   = {${year}},\n  note   = {NASA Space Apps Challenge. Accessed ${today}},\n` +
    `  url    = {${REPO}}\n}\n` + BIB;
  return { apa, bib, view };
}

export function CiteThis({ ctx, atlas, label = "❝ Cite this" }: { ctx: CiteContext; atlas: Atlas | null; label?: string }) {
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState<"apa" | "bib">("apa");
  const [copied, setCopied] = useState(false);
  const c = citations(ctx, atlas);
  const text = fmt === "apa" ? c.apa : c.bib;

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <>
      <button className="st-btn ghost" onClick={() => setOpen(true)}>{label}</button>
      {open &&
        createPortal(
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(38,30,20,.45)", backdropFilter: "blur(3px)",
              display: "grid", placeItems: "center", padding: 16 }}
          >
            <StationStyle />
            <div className="st-card st-pop" role="dialog" aria-label="Cite this" onClick={(e) => e.stopPropagation()}
              style={{ width: "min(640px, 100%)", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <Tag>Specimen label</Tag>
                <button onClick={() => setOpen(false)} aria-label="Close"
                  style={{ border: 0, background: "none", fontSize: 22, cursor: "pointer", color: E.bark }}>×</button>
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", color: E.pine, margin: "10px 0 2px" }}>Cite this</h3>
              <p className="small" style={{ margin: "0 0 12px", color: E.bark }}>{c.view || "Park Trend Detective atlas"}</p>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {(["apa", "bib"] as const).map((f) => (
                  <button key={f} className={`st-btn${fmt === f ? "" : " ghost"}`} onClick={() => setFmt(f)}>
                    {f === "apa" ? "APA" : "BibTeX"}
                  </button>
                ))}
              </div>
              <pre style={{ whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto", background: "#fffdf7", border: `1px solid ${E.sage}`,
                borderRadius: 8, padding: 12, fontSize: 12, color: E.bark, margin: 0 }}>{text}</pre>
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                <button className="st-btn" onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
                <span className="micro" style={{ color: E.moss }}>The link opens this exact view.</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Thin bar above each research tool: where you are, plus Cite this. */
export function StationStrip({ title, ctx, atlas }: { title: string; ctx: CiteContext; atlas: Atlas | null }) {
  return (
    <div className="st-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      padding: "10px 14px", marginBottom: 14, flexWrap: "wrap" }}>
      <StationStyle />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Tag>Field station</Tag>
        <b style={{ fontFamily: "var(--font-display)", color: E.pine, fontSize: 17 }}>{title}</b>
      </div>
      <CiteThis ctx={{ ...ctx, tool: title }} atlas={atlas} />
    </div>
  );
}
