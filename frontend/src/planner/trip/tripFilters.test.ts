import { describe, expect, it } from "vitest";
import fixture from "../../test/tripFixture.json";
import { ALL_FEELS, DEFAULT_STATE, clearFilters, decodeState, encodeState, filterCount, goldMonth, searchParks, type Trip } from "./tripModel";

const parks = (fixture as unknown as Trip).parks;

describe("trip filters", () => {
  it("counts chips and a narrowed temperature", () => {
    expect(filterCount(DEFAULT_STATE)).toBe(2); // warmth + bugs
    expect(filterCount({ ...DEFAULT_STATE, want: { stars: "must" } })).toBe(3);
    expect(filterCount({ ...DEFAULT_STATE, feels: ALL_FEELS, avoid: {} })).toBe(1);
    expect(filterCount({ ...DEFAULT_STATE, feels: [], avoid: {} })).toBe(0);
  });

  it("clear drops every filter but keeps months and year", () => {
    const s = clearFilters({ ...DEFAULT_STATE, months: [3, 4], horizon: "y2050", want: { stars: "must" }, custom: [10, 20] });
    expect(filterCount(s)).toBe(0);
    expect(s.months).toEqual([3, 4]);
    expect(s.horizon).toBe("y2050");
    expect(s.feels).toEqual([]);
    expect(s.custom).toBeNull();
  });

  it("an empty warmth survives the URL round trip", () => {
    const s = clearFilters(DEFAULT_STATE);
    expect(decodeState(encodeState(s))).toMatchObject({ feels: [], want: {}, avoid: {} });
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

describe("gold month on the strip", () => {
  const park = (scores: number[], best_now: number, best_month: number) =>
    ({ best_now, best_month, month_scores: scores.map((score) => ({ score, ok: true })) }) as unknown as Trip["parks"][number];

  it("on a tie, marks the month the card names", () => {
    expect(goldMonth(park(Array(12).fill(100), 12, 2), [2])).toBe(2);
  });

  it("with a clear winner, marks the best month all year", () => {
    const s = Array(12).fill(60);
    s[6] = 90;
    expect(goldMonth(park(s, 7, 2), [2])).toBe(7);
  });
});
