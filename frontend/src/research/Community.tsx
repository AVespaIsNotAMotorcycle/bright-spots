// The Campfire: researchers post notes, questions and hunches, tagged to a park and chart.
// No accounts: a random id in this browser counts votes and lets you delete your own notes.
import { useCallback, useEffect, useState } from "react";
import type { Atlas } from "../detective/model";
import { PERIOD_LABEL } from "../detective/model";
import { useInsights, varLabel } from "./lib";
import { E, StationStyle, Tag } from "./station";
import { exampleNotes } from "./ResearcherWidgets";

export type Kind = "insight" | "question" | "hypothesis" | "method";

export interface Post {
  id: number;
  parent_id: number | null;
  author: string;
  kind: Kind;
  text: string;
  park_id: string | null;
  variable: string | null;
  period: string | null;
  created: number;
  votes: number;
  voted: boolean;
  mine: boolean;
  replies: Post[];
}

export const KIND: Record<Kind, { icon: string; label: string; color: string }> = {
  insight: { icon: "💡", label: "Insight", color: E.moss },
  question: { icon: "❓", label: "Question", color: E.dusk },
  hypothesis: { icon: "🧪", label: "Hypothesis", color: E.clay },
  method: { icon: "📐", label: "Method", color: E.bark },
};

export function browserId(): string {
  try {
    let id = localStorage.getItem("campfire.id");
    if (!id) {
      id = "b" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9]/g, "");
      localStorage.setItem("campfire.id", id);
    }
    return id;
  } catch {
    return "anonymous-browser";
  }
}

export function ago(t: number): string {
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export async function fetchPosts(q: { park?: string | null; kind?: Kind | null; sort?: "new" | "top"; limit?: number }): Promise<Post[]> {
  const p = new URLSearchParams({ me: browserId(), sort: q.sort ?? "new", limit: String(q.limit ?? 50) });
  if (q.park) p.set("park", q.park);
  if (q.kind) p.set("kind", q.kind);
  const r = await fetch(`/api/community/posts?${p}`);
  if (!r.ok) throw new Error(`community ${r.status}`);
  return r.json();
}

async function send(path: string, method: string, body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    const msg = typeof j?.detail === "string" ? j.detail : "Could not save. Check the note and try again.";
    throw new Error(msg);
  }
  return r.status === 204 ? null : r.json();
}

interface Draft {
  kind: Kind;
  text: string;
  park: string;
  variable: string;
  period: string;
}

function Composer({
  atlas, parks, author, setAuthor, initial, parentId, onDone, compact,
}: {
  atlas: Atlas | null;
  parks: { id: string; name: string }[];
  author: string;
  setAuthor: (s: string) => void;
  initial?: Partial<Draft>;
  parentId?: number;
  onDone: () => void;
  compact?: boolean;
}) {
  const [d, setD] = useState<Draft>({ kind: "insight", text: "", park: "", variable: "", period: "", ...initial });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: Partial<Draft>) => setD((x) => ({ ...x, ...k }));

  const submit = async () => {
    setErr(null);
    if (!author.trim()) return setErr("Add your name first.");
    if (d.text.trim().length < 3) return setErr("Write a little more.");
    setBusy(true);
    try {
      await send("/api/community/posts", "POST", {
        author: author.trim(), owner: browserId(), kind: d.kind, text: d.text,
        park_id: d.park || null, variable: d.variable || null, period: d.period || null,
        parent_id: parentId ?? null,
      });
      setD((x) => ({ ...x, text: "" }));
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = { padding: "7px 10px", borderRadius: 8, border: `1px solid ${E.sage}`, background: "#fffdf7", color: E.bark, fontSize: 13 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!compact && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(Object.keys(KIND) as Kind[]).map((k) => (
            <button key={k} className={`st-btn${d.kind === k ? "" : " ghost"}`} onClick={() => set({ kind: k })}>
              {KIND[k].icon} {KIND[k].label}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={d.text}
        maxLength={1000}
        onChange={(e) => set({ text: e.target.value })}
        placeholder={parentId ? "Write a reply…" : "What did you notice? Name the park, the measure and the numbers."}
        rows={compact ? 2 : 3}
        style={{ ...field, resize: "vertical", fontFamily: "var(--font-body)" }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={author} maxLength={40} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" style={{ ...field, width: 140 }} />
        {!compact && (
          <>
            <select value={d.park} onChange={(e) => set({ park: e.target.value })} style={field}>
              <option value="">Any park</option>
              {parks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={d.variable} onChange={(e) => set({ variable: e.target.value })} style={field}>
              <option value="">Any measure</option>
              {Object.entries(atlas?.variables ?? {}).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
            <select value={d.period} onChange={(e) => set({ period: e.target.value })} style={field}>
              <option value="">Any period</option>
              {(atlas?.periods ?? []).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p] ?? p}</option>)}
            </select>
          </>
        )}
        <button className="st-btn" disabled={busy} onClick={submit}>{busy ? "Posting…" : parentId ? "Reply" : "🔥 Share"}</button>
        <span className="micro" style={{ color: E.moss }}>{d.text.length}/1000</span>
      </div>
      {err && <p className="small" style={{ color: "var(--error)", margin: 0 }}>{err}</p>}
    </div>
  );
}

function Note({
  p, atlas, parkName, onChanged, onOpenPark, replyProps,
}: {
  p: Post;
  atlas: Atlas | null;
  parkName: (id: string) => string;
  onChanged: () => void;
  onOpenPark: (park: string, v: string | null, per: string | null) => void;
  replyProps?: Omit<React.ComponentProps<typeof Composer>, "onDone" | "parentId" | "compact">;
}) {
  const [votes, setVotes] = useState({ n: p.votes, on: p.voted });
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState<"pick" | "done" | null>(null);
  const report = (reason: string) =>
    send(`/api/community/posts/${p.id}/report`, "POST", { reporter: browserId(), reason })
      .then((r: { hidden: boolean }) => { setReporting("done"); if (r.hidden) onChanged(); })
      .catch(() => setReporting(null));
  useEffect(() => setVotes({ n: p.votes, on: p.voted }), [p.votes, p.voted]);
  const k = KIND[p.kind];
  const vote = () =>
    send(`/api/community/posts/${p.id}/vote`, "POST", { voter: browserId() })
      .then((r: { votes: number; voted: boolean }) => setVotes({ n: r.votes, on: r.voted }))
      .catch(() => {});
  const del = () => {
    if (!confirm("Delete this note? Replies go too.")) return;
    send(`/api/community/posts/${p.id}?owner=${encodeURIComponent(browserId())}`, "DELETE").then(onChanged).catch(() => {});
  };
  const chart = [
    p.variable ? varLabel(atlas, p.variable) : null,
    p.period ? PERIOD_LABEL[p.period] ?? p.period : null,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: `1px solid ${E.sage}` }}>
      <button onClick={vote} title="Useful" aria-pressed={votes.on}
        style={{ alignSelf: "flex-start", border: `1px solid ${votes.on ? E.clay : E.sage}`, background: votes.on ? E.sand : "transparent",
          borderRadius: 10, padding: "4px 8px", cursor: "pointer", color: E.bark, minWidth: 42, fontWeight: 700 }}>
        ▲<br />{votes.n}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="micro" style={{ color: E.bark, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ background: k.color, color: E.cream, borderRadius: 10, padding: "1px 8px", fontWeight: 600 }}>{k.icon} {k.label}</span>
          <b>{p.author}</b>
          <span style={{ color: E.moss }}>{ago(p.created)}</span>
          {p.park_id && (
            <button className="link-btn" onClick={() => onOpenPark(p.park_id!, p.variable, p.period)} style={{ fontSize: 11 }}>
              📍 {parkName(p.park_id)}{chart ? ` · ${chart}` : ""}
            </button>
          )}
          {!p.park_id && chart && <span>📈 {chart}</span>}
        </div>
        <p style={{ margin: "4px 0", whiteSpace: "pre-wrap", wordBreak: "break-word", color: E.bark }}>{p.text}</p>
        <div className="micro" style={{ display: "flex", gap: 10 }}>
          {replyProps && <button className="link-btn" onClick={() => setReplying((r) => !r)}>💬 Reply{p.replies.length ? ` (${p.replies.length})` : ""}</button>}
          {p.mine && <button className="link-btn" onClick={del}>Delete</button>}
          {!p.mine && reporting === null && <button className="link-btn" onClick={() => setReporting("pick")}>⚑ Report</button>}
          {reporting === "pick" && (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              Why?
              {(["spam", "rude", "wrong", "other"] as const).map((r) => (
                <button key={r} className="link-btn" onClick={() => report(r)}>
                  {r === "wrong" ? "misleading" : r}
                </button>
              ))}
              <button className="link-btn" onClick={() => setReporting(null)}>cancel</button>
            </span>
          )}
          {reporting === "done" && <span style={{ color: E.moss }}>Reported. 3 reports hide a note.</span>}
        </div>
        {p.replies.length > 0 && (
          <div style={{ marginLeft: 6, paddingLeft: 12, borderLeft: `3px solid ${E.sand}` }}>
            {p.replies.map((r) => (
              <Note key={r.id} p={r} atlas={atlas} parkName={parkName} onChanged={onChanged} onOpenPark={onOpenPark} />
            ))}
          </div>
        )}
        {replying && replyProps && (
          <div style={{ marginTop: 8 }}>
            <Composer {...replyProps} compact parentId={p.id} onDone={() => { setReplying(false); onChanged(); }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Community({
  atlas, name, park, v, per, onOpenPark,
}: {
  atlas: Atlas | null;
  name: string;
  park?: string | null;
  v?: string | null;
  per?: string | null;
  onOpenPark: (park: string, v: string | null, per: string | null) => void;
}) {
  const { data: ins } = useInsights();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sort, setSort] = useState<"new" | "top">("new");
  const [kind, setKind] = useState<Kind | null>(null);
  const [filterPark, setFilterPark] = useState<string>(park ?? "");
  const [author, setAuthorState] = useState(() => {
    try { return localStorage.getItem("campfire.name") ?? name; } catch { return name; }
  });
  const setAuthor = (s: string) => {
    setAuthorState(s);
    try { localStorage.setItem("campfire.name", s); } catch { /* storage unavailable */ }
  };

  const parks = [...(ins?.parks ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const parkName = (id: string) => ins?.parks.find((p) => p.id === id)?.name ?? id;

  const load = useCallback(() => {
    fetchPosts({ park: filterPark || null, kind, sort })
      .then((x) => { setPosts(x); setErr(null); })
      .catch(() => setErr("Could not reach the Campfire. Is the backend running?"));
  }, [filterPark, kind, sort]);
  useEffect(load, [load]);

  const composer = { atlas, parks, author, setAuthor };

  return (
    <div className="panel-stack">
      <StationStyle />
      <section className="st-card" style={{ padding: 18, background: `linear-gradient(160deg, #3b2d20, ${E.bark})`, color: E.cream, borderColor: E.bark }}>
        <b style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>🔥 The Campfire</b>
        <p className="small" style={{ margin: "4px 0 0", color: E.sand }}>
          Share what you found in the data. Tag a park and a chart so others can check it.
          Notes are people's opinions, not NASA data.
        </p>
      </section>

      <section className="st-card" style={{ padding: 16 }}>
        <Tag>New field note</Tag>
        <div style={{ marginTop: 10 }}>
          <Composer {...composer} initial={{ park: park ?? "", variable: v ?? "", period: per ?? "" }} onDone={load} />
        </div>
      </section>

      <section className="st-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {(["new", "top"] as const).map((s) => (
            <button key={s} className={`st-btn${sort === s ? "" : " ghost"}`} onClick={() => setSort(s)}>{s === "new" ? "🕑 Newest" : "▲ Top"}</button>
          ))}
          <span style={{ width: 1, height: 22, background: E.sage }} />
          <button className={`st-btn${kind === null ? "" : " ghost"}`} onClick={() => setKind(null)}>All</button>
          {(Object.keys(KIND) as Kind[]).map((k) => (
            <button key={k} className={`st-btn${kind === k ? "" : " ghost"}`} onClick={() => setKind(k)}>{KIND[k].icon}</button>
          ))}
          <select value={filterPark} onChange={(e) => setFilterPark(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${E.sage}`, background: "#fffdf7", color: E.bark }}>
            <option value="">All parks</option>
            {parks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {err && <p className="error">{err}</p>}
        {posts === null && !err && <p className="muted">Lighting the fire…</p>}
        {posts?.length === 0 && (
          <>
            <p style={{ color: E.bark }}>No notes here yet. Start the conversation above. Here are some ideas to start from:</p>
            {atlas && !filterPark && !kind && exampleNotes(atlas).map((x, i) => (
              <div key={i} style={{ padding: "10px 0", borderTop: `1px dashed ${E.sage}`, color: E.bark }}>
                <div className="micro">
                  <span style={{ background: KIND[x.kind].color, color: E.cream, borderRadius: 10, padding: "1px 8px", fontWeight: 600 }}>
                    {KIND[x.kind].icon} {KIND[x.kind].label}
                  </span>{" "}
                  <i style={{ color: E.moss }}>Example, written by the app from the data. Not a real post.</i>
                </div>
                <p style={{ margin: "4px 0 0" }}>{x.text}</p>
              </div>
            ))}
          </>
        )}
        <div style={{ marginTop: 8 }}>
          {posts?.map((p) => (
            <Note key={p.id} p={p} atlas={atlas} parkName={parkName} onChanged={load} onOpenPark={onOpenPark} replyProps={composer} />
          ))}
        </div>
      </section>
    </div>
  );
}
