// Log in / sign up, plus "continue as guest". With `initial` set it is the edit-profile form.
import { useState } from "react";
import Logo, { TAGLINE } from "./brand/Logo";
import { enterGuest, logIn, signUp } from "./auth";
import type { Profile } from "./profile";

type Mode = "login" | "signup";

function ResearchSwitch({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="switch" onClick={() => set(!on)}>
      <span className="switch-track" aria-hidden="true" />
      <span>
        <b style={{ fontWeight: 500 }}>I want research tools too</b>
        <span className="small muted" style={{ display: "block" }}>
          Adds a Research menu: trend atlas, maps, statistics and the community board.
        </span>
      </span>
    </button>
  );
}

export default function Landing({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Profile | null;
  onSubmit: (p: Profile) => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [research, setResearch] = useState(initial?.research ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const head = (
    <div style={{ textAlign: "center" }}>
      <Logo size={44} />
      <p className="muted" style={{ margin: "10px 0 0" }}>{TAGLINE}</p>
    </div>
  );

  // Edit profile: name and the research switch only.
  if (initial) {
    return (
      <div className="signin">
        <form className="signin-card" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...initial, name: name.trim(), research }); }}>
          {head}
          <label className="field" style={{ fontSize: 13 }}>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} style={{ width: "100%" }} />
          </label>
          <ResearchSwitch on={research} set={setResearch} />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="btn" style={{ flex: 1, background: "var(--clay)" }}>Save</button>
            {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
          </div>
        </form>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = mode === "signup" ? await signUp(name, email, password, research) : await logIn(email, password);
      if (typeof r === "string") setError(r);
      else onSubmit(r);
    } catch {
      setError("Something went wrong in this browser. Try again, or continue as a guest.");
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  return (
    <div className="signin">
      <form className="signin-card" onSubmit={submit} noValidate>
        {head}

        <div className="auth-tabs" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchTo("signup")}>Sign up</button>
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchTo("login")}>Log in</button>
        </div>

        {mode === "signup" && (
          <label className="field" style={{ fontSize: 13 }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} autoComplete="name" style={{ width: "100%" }} />
          </label>
        )}
        <label className="field" style={{ fontSize: 13 }}>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required style={{ width: "100%" }} />
        </label>
        <label className="field" style={{ fontSize: 13 }}>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} required style={{ width: "100%" }} />
        </label>

        {mode === "signup" && <ResearchSwitch on={research} set={setResearch} />}

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="btn" disabled={busy} style={{ background: "var(--clay)" }}>
          {busy ? "One moment…" : mode === "signup" ? "Create account" : "Log in"}
        </button>

        <button type="button" className="link-btn" style={{ alignSelf: "center" }} onClick={() => { enterGuest(); onSubmit({ name: "", research }); }}>
          Continue as a guest
        </button>
        <p className="micro muted" style={{ margin: 0, textAlign: "center" }}>
          Demo accounts live only in this browser. Your password is hashed, never stored as typed.
        </p>
      </form>
    </div>
  );
}
