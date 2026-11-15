import { describe, expect, it } from "vitest";
import type { BestDays } from "../model";
import { DEFAULT_STATE } from "./tripModel";
import { daysPrefs, fmtWindow, rankStretches } from "./bestDates";

const bd = (month: number, start: number, end: number, mean: number) =>
  ({ month, window: { start, end, mean }, days: [], best_days: [], horizon: "next_year", measured_days: null, note: "" }) as BestDays;

describe("best dates", () => {
  it("formats a stretch with the month", () => {
    expect(fmtWindow(bd(2, 3, 9, 88))).toBe("Feb 3–9");
    expect(fmtWindow(undefined)).toBeNull();
  });

  it("ranks a park's months by the best stretch", () => {
    const dates = { 1: { zion: bd(1, 10, 16, 70) }, 2: { zion: bd(2, 3, 9, 88) }, 3: { zion: bd(3, 20, 26, 88) } };
    expect(rankStretches(dates, "zion").map((b) => b.month)).toEqual([2, 3, 1]);
  });

  it("uses the trip's warmth and chips for the day scores", () => {
    const p = daysPrefs({ ...DEFAULT_STATE, want: { stars: "nice" }, avoid: { muggy: "must" } }, 7);
    expect(p).toMatchObject({ month: 7, tLo: 15, tHi: 30, stars: true, dewMax: 16, avoidBugs: false });
  });
});
