// "Explain it to me": a plain-words story of one chart.
// The story is built from this chart's own numbers (record years, last 10 vs first 10 years,
// rank among parks...), so each chart reads differently. When the server has an AI key,
// the AI rewrites those same facts in friendlier words; otherwise the built story is shown.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Atlas, TrendRow, YearlySeries } from "./model";
import { buildStory } from "./story";

interface Props {
  park: string;
  parkId?: string;
  label: string;
  period: string;
  unit: string;
  series: YearlySeries;
  trend: TrendRow;
}

interface Reply { text: string; source: "ai" | "template" }

const cache = new Map<string, Reply>();

const XP_CSS = `
@keyframes xp-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes xp-pop { from { opacity: 0; transform: translateY(14px) scale(.96) } to { opacity: 1; transform: none } }
.xp-overlay { animation: xp-fade .2s ease-out both }
.xp-card { animation: xp-pop .28s cubic-bezier(.2,1.2,.4,1) both }
@media (prefers-reduced-motion: reduce) { .xp-overlay, .xp-card { animation: none } }
`;

let atlasPromise: Promise<Atlas | null> | null = null;
function loadAtlas(): Promise<Atlas | null> {
  atlasPromise ??= fetch("/api/trends/atlas")
    .then((r) => (r.ok ? (r.json() as Promise<Atlas>) : null))
    .catch(() => null);
  return atlasPromise;
}

export default function ExplainButton(p: Props) {
  const [state, setState] = useState<"idle" | "loading" | "open">("idle");
  const [reply, setReply] = useState<Reply | null>(null);
  const [atlas, setAtlas] = useState<Atlas | null>(null);

  const key = `${p.parkId ?? p.park}|${p.trend.variable}|${p.trend.period}|${p.unit}`;

  // Esc closes the pop-up.
  useEffect(() => {
    if (state !== "open") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState("idle");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  async function ask() {
    if (state === "open") return setState("idle");
    const hit = cache.get(key);
    if (hit) {
      setReply(hit);
      return setState("open");
    }
    setState("loading");
    const a = atlas ?? (await loadAtlas());
    if (a && !atlas) setAtlas(a);
    const story = buildStory({
      park: p.park || "this park",
      parkId: p.parkId,
      label: p.label,
      unit: p.unit,
      variable: p.trend.variable,
      series: p.series,
      trend: p.trend,
      cells: a?.atlas[p.trend.variable]?.[p.trend.period],
    });
    const local: Reply = { text: story.text, source: "template" };
    let out = local;
    try {
      const r = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          park: p.park,
          label: p.label,
          unit: p.unit,
          period: p.period,
          sen_per_decade: p.trend.sen_per_decade == null ? null : Number(p.trend.sen_per_decade.toFixed(3)),
          mean: p.trend.mean == null ? null : Number(p.trend.mean.toFixed(2)),
          first_year: p.series.years[0] ?? null,
          last_year: p.series.years[p.series.years.length - 1] ?? null,
          verdict: p.trend.verdict,
          q: p.trend.q,
          notes: story.facts.slice(0, 8).map((f) => f.slice(0, 200)),
        }),
      });
      if (r.ok) {
        const j = (await r.json()) as Reply;
        // Only the AI version is better than the local story; the server's own template is plainer.
        if (j.source === "ai" && j.text) out = j;
      }
    } catch {
      /* offline: the local story is fine */
    }
    cache.set(key, out);
    setReply(out);
    setState("open");
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={ask}
        disabled={state === "loading"}
        style={{
          background: "var(--accent-tint)", color: "var(--text)", border: "1px solid var(--border)",
          borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700,
        }}
      >
        {state === "loading" ? "Reading the chart…" : "💬 Explain it to me"}
      </button>
      {state === "open" && reply &&
        createPortal(
          <div
            className="xp-overlay"
            onClick={() => setState("idle")}
            style={{
              position: "fixed", inset: 0, zIndex: 1000, background: "rgba(38,30,20,.38)",
              backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            }}
          >
            <style>{XP_CSS}</style>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${p.label} at ${p.park}`}
              className="xp-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(460px, 100%)", background: "var(--surface)", color: "var(--text)",
                border: "1px solid var(--border)", borderTop: "5px solid var(--pine)", borderRadius: 18,
                boxShadow: "0 24px 48px rgba(38,30,20,.28)", padding: "20px 22px 18px", position: "relative",
              }}
            >
              <button
                onClick={() => setState("idle")}
                aria-label="Close"
                style={{
                  position: "absolute", top: 10, right: 12, background: "none", border: "none",
                  fontSize: 20, color: "var(--text-muted)", cursor: "pointer", lineHeight: 1,
                }}
              >
                ×
              </button>
              <div className="section-title">🔎 What this chart says</div>
              <h3 style={{ margin: "4px 0 12px", fontFamily: "var(--font-display)", fontSize: 22, color: "var(--pine)", paddingRight: 24 }}>
                {p.label}{p.park ? ` at ${p.park}` : ""}
              </h3>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65 }}>{reply.text}</p>
              <div
                style={{
                  marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {reply.source === "ai" ? "✨ Written by AI from this chart's numbers" : "Built from this chart's numbers"}
                </span>
                <button className="btn" onClick={() => setState("idle")} style={{ padding: "7px 16px" }}>Got it</button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
