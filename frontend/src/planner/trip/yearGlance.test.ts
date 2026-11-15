import { describe, expect, it } from "vitest";
import { nextTwelve } from "./TripSettings";
import { monthSpans } from "./YearGlance";

describe("monthSpans", () => {
  it("joins runs and wraps past December", () => {
    expect(monthSpans([12, 1, 2, 5])).toBe("Dec–Feb, May");
    expect(monthSpans([4, 5, 6, 9, 10])).toBe("Apr–Jun, Sep–Oct");
    expect(monthSpans([7])).toBe("Jul");
    expect(monthSpans([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe("all year");
    expect(monthSpans([])).toBe("");
  });
});

describe("month picker years", () => {
  it("starts this month and puts next year's months after December", () => {
    const t = nextTwelve(new Date(2026, 10, 15)); // 15 Nov 2026
    expect(t[0]).toEqual({ m: 11, y: 2026, now: true });
    expect(t[1]).toEqual({ m: 12, y: 2026, now: false });
    expect(t[2]).toEqual({ m: 1, y: 2027, now: false });
    expect(t[11]).toEqual({ m: 10, y: 2027, now: false });
  });
});
