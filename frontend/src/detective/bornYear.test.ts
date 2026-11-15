import { describe, expect, it } from "vitest";
import type { Atlas } from "./model";
import { changes, fmtDeg, tally, windowFor } from "./bornYear";

const atlas = {
  variables: {},
  periods: ["annual"],
  coverage: { first_year: 1981, last_full_year: 2025, last_year: 2026, last_month: 1 },
  atlas: {
    tmax_c: {
      annual: [
        { park_id: "zion", sen: 0.5, q: 0.001, verdict: "real" },
        { park_id: "acad", sen: 0.2, q: 0.01, verdict: "real" },
        { park_id: "glac", sen: 0.4, q: 0.07, verdict: "possible" },
        { park_id: "ever", sen: -0.1, q: 0.03, verdict: "real" },
        { park_id: "yose", sen: null, q: null, verdict: "short" },
      ],
    },
  },
} as unknown as Atlas;

describe("since you were born", () => {
  it("counts years from the birth year to the last full year", () => {
    expect(windowFor(atlas, 2005)).toEqual({ from: 2005, to: 2025, years: 20, clipped: false });
  });

  it("starts at the record start for older visitors and says so", () => {
    expect(windowFor(atlas, 1970)).toEqual({ from: 1981, to: 2025, years: 44, clipped: true });
  });

  it("uses only confirmed trends, biggest warming first", () => {
    const out = changes(atlas, windowFor(atlas, 2005));
    expect(out.map((c) => c.park_id)).toEqual(["zion", "acad", "ever"]);
    expect(out[0].c).toBeCloseTo(1.0); // 0.5 °C/decade × 2 decades
  });

  it("tallies warmer and cooler parks", () => {
    expect(tally(atlas)).toEqual({ warmer: 2, cooler: 1, total: 4 });
  });

  it("formats in °F or °C", () => {
    expect(fmtDeg(1, true)).toBe("+1.8°F");
    expect(fmtDeg(-0.25, false)).toBe("−0.3°C");
  });
});
