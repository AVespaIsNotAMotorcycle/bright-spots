// "Explain it to me": a plain-words story of one chart.
// The story is built from this chart's own numbers (record years, last 10 vs first 10 years,
// rank among parks...), so each chart reads differently. When the server has an AI key,
// the AI rewrites those same facts in friendlier words; otherwise the built story is shown.
import { useState } from "react";
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
        {state === "loading" ? "Reading the chart…" : state === "open" ? "Hide explanation" : "💬 Explain it to me"}
      </button>
      {state === "open" && reply && (
        <div
          role="status"
          style={{
            marginTop: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12,
            padding: "10px 14px", fontSize: 14, lineHeight: 1.55,
          }}
        >
          {reply.text}
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
            {reply.source === "ai" ? "✨ Written by AI from this chart's numbers" : "Built from this chart's numbers"}
          </div>
        </div>
      )}
    </div>
  );
}
