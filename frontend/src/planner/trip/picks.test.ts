// Which parks start ticked in Plan's step 2.
import { describe, expect, it } from "vitest";
import { DEFAULT_PICKS, defaultPicks } from "./TripPlanner";
import type { TripPark } from "./tripModel";

const park = (id: string, ok = true) => ({ park: { id }, ok }) as unknown as TripPark;
const order = [park("a"), park("b", false), park("c"), park("d"), park("e")];

describe("defaultPicks", () => {
  it("ticks the top matches, skipping parks that miss a must", () => {
    expect(defaultPicks(order, false, null)).toEqual(["a", "c", "d"]);
    expect(DEFAULT_PICKS).toBe(3);
  });
  it("puts a linked park first and keeps three ticks", () => {
    expect(defaultPicks(order, false, "e")).toEqual(["e", "a", "c"]);
    expect(defaultPicks(order, false, "c")).toEqual(["c", "a", "d"]);
  });
  it("ticks nothing when there is no ranking, except a linked park", () => {
    expect(defaultPicks(order, true, null)).toEqual([]);
    expect(defaultPicks(order, true, "b")).toEqual(["b"]);
  });
});
