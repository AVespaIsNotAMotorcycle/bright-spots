// @vitest-environment jsdom
// Navigation: hash round-trip and which tabs exist for each profile.
import { beforeEach, describe, expect, it } from "vitest";
import { EXPLORER_TABS, RESEARCH_TABS, TAB_LABEL, allowedTabs, migrate } from "../profile";
import { parseHash, toHash, type NavState } from "../useNav";

beforeEach(() => history.replaceState(null, "", "/"));

describe("tabs", () => {
  it("Explorer sees four tabs, Plan first and no Home, with Park Explorer routable but not a tab", () => {
    expect(EXPLORER_TABS.map((t) => TAB_LABEL[t])).toEqual(["Plan", "Mysteries", "Saved", "Passport"]);
    expect(allowedTabs(false)).toContain("explore");
    for (const t of RESEARCH_TABS) expect(allowedTabs(false)).not.toContain(t);
  });
  it("research adds exactly the nine research tools", () => {
    expect(RESEARCH_TABS).toEqual(["atlas", "map", "analogs", "families", "opposites", "seasons", "compare", "robust", "community"]);
    for (const t of RESEARCH_TABS) expect(allowedTabs(true)).toContain(t);
  });
  it("no label carries an emoji", () => {
    for (const l of Object.values(TAB_LABEL)) expect(l).toMatch(/^[A-Za-z -]+$/);
  });
});

describe("profile migration", () => {
  it("maps the old persona to research", () => {
    expect(migrate({ name: "A", persona: "researcher" })).toEqual({ name: "A", research: true });
    for (const persona of ["explorer", "student", "visitor", undefined]) expect(migrate({ name: "A", persona })).toEqual({ name: "A", research: false });
  });
  it("keeps a new-style profile as is", () => {
    expect(migrate({ name: "B", research: true })).toEqual({ name: "B", research: true });
  });
});

describe("hash round-trip", () => {
  const full: NavState = { tab: "planner", caseId: "c1", step: 0, park: "crla", month: 6, park2: "zion", v: "tmax", per: "annual", q: "abc" };
  it("keeps every parameter, including step 0", () => {
    history.replaceState(null, "", toHash(full));
    expect(parseHash()).toEqual(full);
  });
  it("reads a deep link", () => {
    history.replaceState(null, "", "#tab=planner&park=crla");
    expect(parseHash()).toMatchObject({ tab: "planner", park: "crla", month: null });
  });
  it("drops a bad step or month instead of crashing", () => {
    for (const bad of ["abc", "-1", "2.5", ""]) {
      history.replaceState(null, "", `#tab=student&case=c1&step=${bad}&month=${bad}`);
      expect(parseHash()).toMatchObject({ step: null, month: null });
    }
    history.replaceState(null, "", "#month=13");
    expect(parseHash().month).toBeNull();
  });
  it("an empty hash is all null", () => {
    expect(toHash({})).toBe("#");
    expect(parseHash().tab).toBeNull();
  });
});
