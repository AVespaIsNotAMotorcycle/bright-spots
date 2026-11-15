// Test helper: a fake backend that answers from the real bundled NASA data files.
import atlas from "../../../backend/data/trends/atlas.json";
import grace from "../../../backend/data/trends/grace.json";
import insights from "../../../backend/data/trends/insights.json";
import zion from "../../../backend/data/trends/parks/zion.json";
import { vi } from "vitest";
import publicAtlas from "../../public/data/atlas.json";
import tripFixture from "./tripFixture.json";

export interface FakeOptions {
  posts?: unknown[];
}

/** Plain in-memory localStorage (newer Node versions ship a half-working global one). */
export function installStorage() {
  const m = new Map<string, string>();
  const store: Storage = {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
  vi.stubGlobal("localStorage", store);
  Object.defineProperty(window, "localStorage", { value: store, configurable: true });
}

export function installFakeApi(opts: FakeOptions = {}) {
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    if (path.startsWith("/api/trends/atlas"))
      return json({ ...atlas, coverage: { first_year: 1981, last_full_year: 2025, last_year: 2026, last_month: 10 } });
    if (path.startsWith("/api/trends/insights")) return json(insights);
    if (path.startsWith("/api/trends/parks/")) return json(zion);
    if (path.startsWith("/api/trends/grace/")) {
      const id = path.split("/").pop()!.split("?")[0];
      const row = (grace.parks as Record<string, unknown>)[id];
      return row ? json({ meta: grace.meta, park_id: id, ...(row as object) }) : json({ detail: "nope" }, 404);
    }
    if (path.startsWith("/api/parks/trip")) return json(tripFixture);
    if (path.startsWith("/api/parks/best-days")) return json({ parks: {} });
    if (path.startsWith("/data/atlas.json")) return json(publicAtlas);
    if (path.startsWith("/api/community/posts")) return json(opts.posts ?? []);
    if (path.startsWith("/api/datasets/koppen")) return json({ now: { code: "BSk", name: "Arid, steppe, cold" }, future: null });
    if (path.startsWith("/us-states.json")) return json({ features: [] });
    if (path.startsWith("/park-shapes.json")) return json({});
    return json({ detail: `not faked: ${path}` }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  // jsdom lacks these browser features.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  return fetchMock;
}
