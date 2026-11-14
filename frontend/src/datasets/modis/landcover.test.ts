import { describe, expect, it } from "vitest";
import type { LandCover } from "../../api";
import type { Async } from "../../hooks";
import { pickLandcover } from "./landcover";

const year = (y: number, code: number) => ({ year: y, code, name: `c${code}`, group: "g" });
const CCI: LandCover = { first: year(1992, 10), latest: year(2025, 190), changed: true, source: "ESA CCI / C3S" };
const ORNL: LandCover = { first: year(2001, 12), latest: year(2024, 13), changed: true, source: "MCD12Q1" };
const ORNL_EMPTY: LandCover = { first: null, latest: null, changed: null, source: "MCD12Q1" };

const ok = (data: LandCover): Async<LandCover> => ({ status: "ok", data });
const loading: Async<LandCover> = { status: "loading" };
const idle: Async<LandCover> = { status: "idle" };
const err = (error: string): Async<LandCover> => ({ status: "error", error });

describe("pickLandcover", () => {
  it("shows CCI while ORNL is still loading", () => {
    const r = pickLandcover(ok(CCI), loading);
    expect(r.status === "ok" && r.data.lc).toBe(CCI);
    expect(r.status === "ok" && r.data.note).toMatch(/Checking ORNL/);
  });

  it("swaps in ORNL once it answers with both years", () => {
    expect(pickLandcover(ok(CCI), ok(ORNL))).toEqual({ status: "ok", data: { lc: ORNL, note: null } });
    expect(pickLandcover(loading, ok(ORNL))).toEqual({ status: "ok", data: { lc: ORNL, note: null } });
  });

  it("keeps CCI when ORNL fails or has no data", () => {
    const failed = pickLandcover(ok(CCI), err("ORNL DAAC request failed"));
    expect(failed.status === "ok" && failed.data.note).toMatch(/did not answer/);
    const empty = pickLandcover(ok(CCI), ok(ORNL_EMPTY));
    expect(empty.status === "ok" && empty.data.lc).toBe(CCI);
    expect(empty.status === "ok" && empty.data.note).toMatch(/no MCD12Q1 data/);
  });

  it("waits for CCI when ORNL answered without data", () => {
    expect(pickLandcover(loading, ok(ORNL_EMPTY))).toEqual({ status: "loading" });
  });

  it("falls back to ORNL, then to an error, when CCI is missing", () => {
    expect(pickLandcover(err("503"), loading)).toEqual({ status: "loading" });
    expect(pickLandcover(err("503"), ok(ORNL_EMPTY))).toEqual({ status: "ok", data: { lc: ORNL_EMPTY, note: null } });
    expect(pickLandcover(err("503"), err("502"))).toEqual({ status: "error", error: "502; CCI fallback: 503" });
  });

  it("stays idle with no place", () => {
    expect(pickLandcover(idle, idle)).toEqual({ status: "idle" });
  });
});
