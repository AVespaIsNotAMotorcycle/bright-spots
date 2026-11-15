import { describe, expect, it } from "vitest";
import fixture from "../../test/tripFixture.json";
import { ALL_FEELS, DEFAULT_STATE, bandsOf, clearCount, isBrowse, clearFilters, decodeState, tripQuery, encodeState, filterCount, goldMonth, searchParks, type Trip } from "./tripModel";

const parks = (fixture as unknown as Trip).parks;

describe("trip filters", () => {
  it("counts chips and a narrowed temperature", () => {
    expect(filterCount(DEFAULT_STATE)).toBe(2); // warmth + bugs
    expect(filterCount({ ...DEFAULT_STATE, want: { stars: "must" } })).toBe(3);
    expect(filterCount({ ...DEFAULT_STATE, feels: ALL_FEELS, avoid: {} })).toBe(1);
    expect(filterCount({ ...DEFAULT_STATE, feels: [], avoid: {} })).toBe(0);
  });

  it("clear drops every filter and the months, keeps the year", () => {
    const s = clearFilters({ ...DEFAULT_STATE, months: [3, 4], horizon: "y2050", want: { stars: "must" }, custom: [10, 20] });
    expect(filterCount(s)).toBe(0);
    expect(clearCount(s)).toBe(0);
    expect(s.months).toEqual([]);
    expect(s.horizon).toBe("y2050");
    expect(s.feels).toEqual([]);
    expect(s.custom).toBeNull();
  });

  it("picking only a month ranks; picking nothing lists A to Z", () => {
    const none = clearFilters(DEFAULT_STATE);
    expect(isBrowse(none)).toBe(true);
    const july = { ...none, months: [7] };
    expect(isBrowse(july)).toBe(false);
    expect(clearCount(july)).toBe(1);
    expect(bandsOf(july)).toEqual([[15, 24], [24, 30]]); // comfy highs when no warmth is picked
  });

  it("Any time asks the API for all 12 months", () => {
    expect(tripQuery(clearFilters(DEFAULT_STATE)).get("months")).toBe("1,2,3,4,5,6,7,8,9,10,11,12");
  });

  it("an empty warmth and Any time survive the URL round trip", () => {
    const s = clearFilters(DEFAULT_STATE);
    expect(decodeState(encodeState(s))).toMatchObject({ months: [], feels: [], want: {}, avoid: {} });
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
