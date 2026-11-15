// Sign-in: name and one switch. There is a single persona; the switch adds the Research menu.
import { useState } from "react";
import Logo, { TAGLINE } from "./brand/Logo";
import type { Profile } from "./profile";

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
  const [research, setResearch] = useState(initial?.research ?? false);

  return (
    <div className="signin">
      <form
        className="signin-card"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), research });
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Logo size={44} />
          <p className="muted" style={{ margin: "10px 0 0" }}>{TAGLINE}</p>
        </div>

        <label className="field" style={{ fontSize: 13 }}>
          What should we call you? (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} style={{ width: "100%" }} />
        </label>

        <button type="button" role="switch" aria-checked={research} className="switch" onClick={() => setResearch((r) => !r)}>
          <span className="switch-track" aria-hidden="true" />
          <span>
            <b style={{ fontWeight: 500 }}>I want research tools too</b>
            <span className="small muted" style={{ display: "block" }}>
              Adds a Research menu: trend atlas, maps, statistics and the community board.
            </span>
          </span>
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" className="btn" style={{ flex: 1, background: "var(--clay)" }}>
            {initial ? "Save" : "Get started"}
          </button>
          {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
        </div>
        <p className="micro muted" style={{ margin: 0, textAlign: "center" }}>Stored only in this browser. You can change it any time from the profile menu.</p>
      </form>
    </div>
  );
}
