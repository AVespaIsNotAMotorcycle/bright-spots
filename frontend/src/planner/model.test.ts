import { describe, expect, it } from "vitest";
import { cToF, fToC, inToMm, mmToIn, planQuery, rankParks, type Horizon, type ParkPlan, type Prefs } from "./model";

const h = (score: number | null): Horizon => ({ score, low: score, high: score, factors: {}, values: {}, notes: [] });
const plan = (short: string, now: number | null, next: number | null, y2050: number | null): ParkPlan => ({
  park: { id: short.toLowerCase(), code: null, name: `${short} National Park`, short, states: [], lat: 0, lon: 0, visitors_2025: null },
  this_year: h(now),
  next_year: h(next),
  y2050: h(y2050),
});

describe("unit conversions", () => {
  it("round-trips temperature and rain", () => {
    expect(cToF(0)).toBe(32);
    expect(cToF(100)).toBe(212);
    expect(fToC(cToF(23.5))).toBeCloseTo(23.5);
    expect(mmToIn(inToMm(3))).toBeCloseTo(3);
  });
});

describe("planQuery", () => {
  const base: Prefs = {
    month: 7,
    tLo: 20,
    tHi: 26.6667,
    rhMax: null,
    rainMax: null,
    avoidBugs: true,
    stars: false,
    snowmelt: true,
    scenario: "ssp245",
  };
  it("omits limits the user did not set", () => {
    const q = planQuery(base);
    expect(q).toMatchObject({ month: "7", t_lo: "20.00", t_hi: "26.67", avoid_bugs: "true", snowmelt: "true" });
    expect(q).not.toHaveProperty("rh_max");
    expect(q).not.toHaveProperty("rain_max");
  });
  it("includes humidity and rain limits when set", () => {
    expect(planQuery({ ...base, rhMax: 60, rainMax: 76.2 })).toMatchObject({ rh_max: "60", rain_max: "76.2" });
  });
});

describe("rankParks", () => {
  const parks = [plan("Zion", 50, 80, null), plan("Acadia", 90, 60, 70), plan("Badlands", 70, 80, 75)];
  it("ranks by the chosen horizon, ties by name", () => {
    expect(rankParks(parks, "this_year").map((p) => p.park.short)).toEqual(["Acadia", "Badlands", "Zion"]);
    expect(rankParks(parks, "next_year").map((p) => p.park.short)).toEqual(["Badlands", "Zion", "Acadia"]);
  });
  it("puts parks without a score last", () => {
    expect(rankParks(parks, "y2050").map((p) => p.park.short)).toEqual(["Badlands", "Acadia", "Zion"]);
  });
});
