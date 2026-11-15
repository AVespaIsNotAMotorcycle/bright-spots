import { describe, expect, it } from "vitest";
import fixture from "../../test/tripFixture.json";
import { ALL_FEELS, DEFAULT_STATE, clearFilters, filterCount, searchParks, type Trip } from "./tripModel";

const parks = (fixture as unknown as Trip).parks;

describe("trip filters", () => {
  it("counts chips and a narrowed temperature", () => {
    expect(filterCount(DEFAULT_STATE)).toBe(2); // bugs + mild/warm only
    expect(filterCount({ ...DEFAULT_STATE, want: { stars: "must" } })).toBe(3);
  });

  it("clear drops every filter but keeps months and year", () => {
    const s = clearFilters({ ...DEFAULT_STATE, months: [3, 4], horizon: "y2050", want: { stars: "must" }, custom: [10, 20] });
    expect(filterCount(s)).toBe(0);
    expect(s.months).toEqual([3, 4]);
    expect(s.horizon).toBe("y2050");
    expect(s.feels).toEqual(ALL_FEELS);
  });
});

describe("park search", () => {
  it("finds a park by name, ignoring case", () => {
    expect(searchParks(parks, "ZION")[0].park.short).toBe("Zion");
  });

  it("finds parks by state", () => {
    const utah = searchParks(parks, "utah").map((p) => p.park.short);
    expect(utah).toEqual(["Zion", "Bryce Canyon", "Capitol Reef"]);
  });

  it("puts names that start with the text first", () => {
    expect(searchParks(parks, "ca")[0].park.short).toBe("Capitol Reef");
  });

  it("returns nothing for empty text", () => {
    expect(searchParks(parks, "  ")).toEqual([]);
  });
});
