import { describe, expect, it } from "vitest";
import {
  cToF,
  distanceKm,
  fToC,
  inToMm,
  mmToIn,
  nearestParks,
  planQuery,
  popularParks,
  rangeFromCity,
  rankParks,
  CITY_BAND_C,
  type Horizon,
  type ParkPlan,
  type Prefs,
} from "./model";

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
    expect(planQuery({ ...base, dewMax: 15.5556 })).toMatchObject({ dew_max: "15.56" });
    expect(planQuery(base)).not.toHaveProperty("dew_max");
  });
});

describe("rankParks", () => {
  const parks = [plan("Zion", 50, 80, null), plan("Acadia", 90, 60, 70), plan("Badlands", 70, 80, 75)];
  it("ranks by the chosen horizon, ties by the mean over all horizons, then name", () => {
    expect(rankParks(parks, "this_year").map((p) => p.park.short)).toEqual(["Acadia", "Badlands", "Zion"]);
    // Badlands and Zion tie at 80 next year; Badlands' mean (75) beats Zion's (65).
    expect(rankParks(parks, "next_year").map((p) => p.park.short)).toEqual(["Badlands", "Zion", "Acadia"]);
    const tied = [plan("B", 50, 80, 50), plan("A", 50, 80, 50), plan("C", 90, 80, 90)];
    expect(rankParks(tied, "next_year").map((p) => p.park.short)).toEqual(["C", "A", "B"]);
  });
  it("puts parks without a score last", () => {
    expect(rankParks(parks, "y2050").map((p) => p.park.short)).toEqual(["Badlands", "Acadia", "Zion"]);
  });
});

const at = (short: string, lat: number, lon: number, visitors: number | null): ParkPlan => {
  const p = plan(short, 1, 1, 1);
  return { ...p, park: { ...p.park, lat, lon, visitors_2025: visitors } };
};

describe("distanceKm", () => {
  it("is zero for the same point and ~111 km per degree of latitude", () => {
    expect(distanceKm({ lat: 40, lon: -105 }, { lat: 40, lon: -105 })).toBe(0);
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe("nearestParks and popularParks", () => {
  const parks = [
    at("Rocky", 40.4, -105.58, 4_000_000),
    at("Arches", 38.68, -109.57, 1_400_000),
    at("Acadia", 44.35, -68.21, 4_100_000),
    at("Smokies", 35.68, -83.53, 12_000_000),
    at("Samoa", -14.25, -170.68, null),
  ];
  it("orders by distance from the place", () => {
    const denver = { name: "Denver", lat: 39.74, lon: -104.98 };
    expect(nearestParks(parks, denver, 2).map((p) => p.park.short)).toEqual(["Rocky", "Arches"]);
  });
  it("orders by 2025 visitors, skipping given ids and unknown counts", () => {
    expect(popularParks(parks, 3).map((p) => p.park.short)).toEqual(["Smokies", "Acadia", "Rocky"]);
    expect(popularParks(parks, 2, new Set(["smokies"])).map((p) => p.park.short)).toEqual(["Acadia", "Rocky"]);
  });
});

describe("rangeFromCity", () => {
  const normals = {
    lat: 0,
    lon: 0,
    period: "1991-2020",
    months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, tmax: i === 6 ? 30 : null, rh: null, precip: null })),
  };
  it("centres the range on the city's normal high for the month", () => {
    expect(rangeFromCity(normals, 7)).toEqual([30 - CITY_BAND_C, 30 + CITY_BAND_C]);
    expect(rangeFromCity(normals, 1)).toBeNull();
  });
});
