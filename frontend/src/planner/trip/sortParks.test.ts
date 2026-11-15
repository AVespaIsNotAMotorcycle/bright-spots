// Plan step 2's park order: this year's score by default, stackable keys, musts first.
import { describe, expect, it } from "vitest";
import { DEFAULT_SORT, cleanSort, shownHorizon, sortParks } from "./sortParks";
import type { TripPark } from "./tripModel";

function park(id: string, o: { ok?: boolean; now?: number; next?: number; tmax?: number; precip?: number; visitors?: number } = {}): TripPark {
  return {
    park: { id, short: id.toUpperCase(), visitors_2025: o.visitors ?? null },
    ok: o.ok ?? true,
    scores: { this_year: o.now ?? null, next_year: o.next ?? null, y2050: null },
    values: { this_year: { tmax: o.tmax ?? null, precip: o.precip ?? null }, next_year: {}, y2050: {} },
  } as unknown as TripPark;
}
const ids = (ps: TripPark[]) => ps.map((p) => p.park.id);

describe("sortParks", () => {
  const parks = [
    park("a", { now: 70, next: 95, tmax: 20, precip: 40 }),
    park("b", { now: 90, next: 60, tmax: 25, precip: 10 }),
    park("c", { now: 80, next: 80, tmax: 25, precip: 30 }),
    park("d", { now: 99, next: 99, ok: false }),
  ];
  it("defaults to this year's score, not next year's", () => {
    expect(DEFAULT_SORT).toEqual(["this_year"]);
    expect(ids(sortParks(parks, DEFAULT_SORT))).toEqual(["b", "c", "a", "d"]);
    expect(ids(sortParks(parks, ["next_year"]))).toEqual(["a", "c", "b", "d"]);
  });
  it("keeps parks that miss a must last, whatever the sort", () => {
    expect(ids(sortParks(parks, ["cool"])).at(-1)).toBe("d");
  });
  it("a second key breaks ties in the first", () => {
    // b and c are both 25° highs; least rain puts b first.
    expect(ids(sortParks(parks, ["warm", "dry"]))).toEqual(["b", "c", "a", "d"]);
    expect(ids(sortParks(parks, ["warm", "name"]))).toEqual(["b", "c", "a", "d"]);
  });
  it("scores that round to the same whole number count as a tie", () => {
    const tied = [park("x", { now: 90.2, precip: 50 }), park("y", { now: 89.8, precip: 5 })];
    expect(ids(sortParks(tied, ["this_year", "dry"]))).toEqual(["y", "x"]);
  });
  it("missing values sort last in either direction", () => {
    const ps = [park("n"), park("m", { tmax: 10 })];
    expect(ids(sortParks(ps, ["warm"]))).toEqual(["m", "n"]);
    expect(ids(sortParks(ps, ["cool"]))).toEqual(["m", "n"]);
  });
});

describe("sort keys", () => {
  it("cleans stored keys: unknown dropped, no repeats, at most 3, else the default", () => {
    expect(cleanSort(["dry", "bogus", "dry", "warm", "name", "quiet"])).toEqual(["dry", "warm", "name"]);
    expect(cleanSort(null)).toEqual(DEFAULT_SORT);
    expect(cleanSort("this_year")).toEqual(DEFAULT_SORT);
  });
  it("the list shows the first score key's year", () => {
    expect(shownHorizon(["warm", "next_year"])).toBe("next_year");
    expect(shownHorizon(["dry"])).toBe("this_year");
  });
});
