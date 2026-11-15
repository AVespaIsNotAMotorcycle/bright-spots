import { describe, expect, it } from "vitest";
import { explain, opposite, perDecade, periodPhrase, senLine, type AtlasPark, type Cell, type VariableMeta } from "./model";

const park: AtlasPark = { id: "zion", code: "zion", name: "Zion National Park", short: "Zion", states: ["Utah"], lat: 37.3, lon: -113.05 };
const tmax: VariableMeta = { name: "Daytime high", unit: "°C", total: false, source: "NASA POWER", spec_source: null };
const cell = (over: Partial<Cell>): Cell => ({
  n: 45,
  first_year: 1981,
  last_year: 2025,
  sen_per_decade: 0.5,
  ols_per_decade: 0.5,
  ols_ci_low: 0.3,
  ols_ci_high: 0.7,
  p: 0.001,
  p_prewhitened: 0.002,
  autocorr_flag: false,
  sd: 1,
  snr: 0.5,
  q: 0.004,
  verdict: "real",
  direction: "up",
  ...over,
});

describe("explain (templated from the numbers only)", () => {
  it("uses the wording ladder", () => {
    expect(explain(cell({}), park, "tmax", tmax, "Summer (Jun–Aug)", true, 64)).toBe(
      "Zion: daytime high in summer (Jun–Aug) has risen by about 0.90 °F per decade over 1981–2025. Real, not luck: it holds up after testing all 64 parks (q = 0.004).",
    );
    const possible = explain(cell({ verdict: "possible", direction: "down", sen_per_decade: -2, p: 0.03, q: 0.2 }), park, "tmax", tmax, "July", false, 64);
    expect(possible).toContain("may have fallen by about 2.0 °C per decade");
    expect(possible).toContain("Possible, not proven: p = 0.030");
    expect(explain(cell({ verdict: "none", p: 0.4 }), park, "tmax", tmax, "Whole year", false, 64)).toBe(
      "Zion: no clear change in daytime high in the whole year over 1981–2025 (p = 0.400).",
    );
    expect(explain(cell({ verdict: "too_little_data", n: 9, sen_per_decade: null }), park, "tmax", tmax, "July", false, 64)).toContain(
      "too little data",
    );
  });
});

describe("units", () => {
  it("converts temperature differences without the +32 offset", () => {
    expect(perDecade(1, "tmax", tmax, true)).toEqual({ value: 1.8, unit: "°F" });
    expect(perDecade(2, "rh", { ...tmax, unit: "%" }, true)).toEqual({ value: 2, unit: "points" });
    expect(perDecade(3, "precip", { ...tmax, unit: "mm" }, true)).toEqual({ value: 3, unit: "mm" });
  });
  it("phrases periods", () => {
    expect(periodPhrase("Winter (Dec–Feb)")).toBe("winter (Dec–Feb)");
    expect(periodPhrase("March")).toBe("March");
  });
});

describe("senLine and opposite", () => {
  it("draws the Sen slope through the median intercept, skipping gaps", () => {
    const years = [2000, 2001, 2002, 2003];
    const line = senLine(years, [1, null, 3, 4], 10); // slope 1 per year
    expect(line[0][0]).toBe(2000);
    expect(line[1][0]).toBe(2003);
    expect(line[1][1] - line[0][1]).toBeCloseTo(3);
  });
  it("finds significant rises and falls in one map", () => {
    const r = opposite([cell({}), cell({ direction: "down" }), cell({ verdict: "possible", direction: "down" })]);
    expect(r).toEqual({ up: [0], down: [1] });
  });
});
