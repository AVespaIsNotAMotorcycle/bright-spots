// Sign-up screen: name (optional) + a toggle for the persona. The choice sets the Home screen.
import { useState } from "react";
import { PERSONAS, type Persona, type Profile } from "./profile";

export type { Persona };

const ORDER: Persona[] = ["visitor", "student", "researcher"];

export default function Landing({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Profile | null;
  onSubmit: (p: Profile) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [persona, setPersona] = useState<Persona>(initial?.persona ?? "visitor");
  const info = PERSONAS[persona];

  return (
    <div style={{ minHeight: "88vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), persona });
        }}
        className="card"
        style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 22, padding: "32px 28px", boxShadow: "var(--shadow-md)" }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>⛰</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--pine)", margin: "4px 0 0", lineHeight: 1.1 }}>
            Park Trend Detective
          </h1>
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            {initial ? "Edit your profile" : "Create your profile"} · 64 US national parks · 45 years of NASA data
          </p>
        </div>

        <label className="field" style={{ fontSize: 12 }}>
          What should we call you? (optional)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={40}
            style={{ width: "100%" }}
          />
        </label>

        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>I am a…</div>
          <div role="radiogroup" aria-label="Persona" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, background: "var(--surface-2)", padding: 5, borderRadius: 14 }}>
            {ORDER.map((p) => {
              const on = persona === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPersona(p)}
                  style={{
                    border: 0,
                    borderRadius: 10,
                    padding: "10px 6px",
                    cursor: "pointer",
                    background: on ? "var(--pine)" : "transparent",
                    color: on ? "var(--on-pine)" : "var(--text)",
                    fontWeight: on ? 700 : 500,
                    fontSize: 14,
                    boxShadow: on ? "var(--shadow-sm)" : "none",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ fontSize: 20 }}>{PERSONAS[p].emoji}</div>
                  {PERSONAS[p].label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: "var(--pine-tint)", borderRadius: 12, padding: "14px 16px" }} aria-live="polite">
          <div style={{ fontWeight: 700, color: "var(--pine)" }}>{info.tagline}</div>
          <p className="small muted" style={{ margin: "4px 0 8px" }}>{info.blurb}</p>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {info.bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" className="btn" style={{ flex: 1 }}>
            {initial ? "Save and go home" : "Create profile"} →
          </button>
          {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
        </div>
        <p className="micro muted" style={{ margin: 0, textAlign: "center" }}>
          Stored only in this browser. You can change it any time.
        </p>
      </form>
    </div>
  );
}
