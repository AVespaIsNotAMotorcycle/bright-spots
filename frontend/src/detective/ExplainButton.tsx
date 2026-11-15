// "Explain it to me": a plain-words explanation of one chart.
// The server writes it from the chart's numbers only (AI when a key is set, built-in sentence otherwise).
import { useState } from "react";

export interface ExplainFacts {
  park: string;
  label: string;
  unit: string;
  period: string;
  sen_per_decade: number | null;
  mean: number | null;
  first_year: number | null;
  last_year: number | null;
  verdict: string;
  q: number | null;
}

interface Reply { text: string; source: "ai" | "template" }

const cache = new Map<string, Reply>();

export default function ExplainButton({ facts }: { facts: ExplainFacts }) {
  const [state, setState] = useState<"idle" | "loading" | "open" | "error">("idle");
  const [reply, setReply] = useState<Reply | null>(null);
  const key = JSON.stringify(facts);

  async function ask() {
    if (state === "open") return setState("idle");
    const hit = cache.get(key);
    if (hit) {
      setReply(hit);
      return setState("open");
    }
    setState("loading");
    try {
      const r = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facts),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as Reply;
      cache.set(key, j);
      setReply(j);
      setState("open");
    } catch {
      setState("error");
    }
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
        {state === "loading" ? "Thinking…" : state === "open" ? "Hide explanation" : "💬 Explain it to me"}
      </button>
      {state === "error" && (
        <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-muted)" }}>Could not explain this one. Try again.</span>
      )}
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
            {reply.source === "ai" ? "✨ Written by AI from this chart's numbers" : "Made from this chart's numbers"}
          </div>
        </div>
      )}
    </div>
  );
}
