// Sign-up screen: a toggle for the persona. The choice sets the Home screen.
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
  const [persona, setPersona] = useState<Persona>(initial?.persona ?? "visitor");
  const info = PERSONAS[persona];

  return (
    <div style={{ minHeight: "88vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ persona });
        }}
        className="card"
        style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: "var(--space-2)", padding: "var(--space-2)", boxShadow: "var(--shadow-md)" }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 className="title" style={{ fontSize: 32, margin: "var(--space-0-25) 0 0" }}>
            Park Trend Detective
          </h1>
          <p className="small muted" style={{ margin: "var(--space-0-5) 0 0" }}>
            {initial ? "Edit your profile" : "Create your profile"} · 64 US national parks · 45 years of NASA data
          </p>
        </div>

        <div>
          <div className="section-title" style={{ marginBottom: "var(--space-0-5)" }}>I am a…</div>
          <div role="radiogroup" aria-label="Persona" className="segmented">
            {ORDER.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={persona === p}
                onClick={() => setPersona(p)}
              >
                {PERSONAS[p].label}
              </button>
            ))}
          </div>
        </div>

        <div className="callout" aria-live="polite">
          <div className="callout-title">{info.tagline}</div>
          <p className="small muted" style={{ margin: "var(--space-0-25) 0 var(--space-0-5)" }}>{info.blurb}</p>
          <ul className="small" style={{ margin: 0, paddingLeft: "var(--space-1)", lineHeight: 1.7 }}>
            {info.bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>

        <div style={{ display: "flex", gap: "var(--space-0-5)" }}>
          <button type="submit" className="btn" style={{ flex: 1 }}>
            {initial ? "Continue" : "Create profile"} →
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
