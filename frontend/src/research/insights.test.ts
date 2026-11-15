import { describe, expect, it } from "vitest";
import type { Atlas, AtlasCell, TrendRow } from "../detective/model";
import { analogSites, anomalyOfWeek, featureRows, findTwins, headToHead, km, oddNeighbours, similarity } from "./insights";

const cell = (park_id: string, sen: number, verdict: AtlasCell["verdict"] = "real"): AtlasCell => ({ park_id, sen, q: 0.01, verdict });

// a and b move alike, c moves the other way.
const atlas: Atlas = {
  variables: { tmax_c: { label: "Daytime high", unit: "°C" }, prcp: { label: "Rain", unit: "mm" } },
  periods: ["annual", "JJA"],
  atlas: {
    tmax_c: {
      annual: [cell("a", 0.5), cell("b", 0.45), cell("c", -0.4), cell("d", 0.1, "none")],
      JJA: [cell("a", 0.6), cell("b", 0.55), cell("c", -0.5), cell("d", 0.05, "none")],
    },
    prcp: {
      annual: [cell("a", 10), cell("b", 9), cell("c", -8), cell("d", 1, "none")],
      JJA: [cell("a", 4), cell("b", 5), cell("c", -6), cell("d", 0, "none")],
    },
  },
};

describe("twin finder", () => {
  it("similarity is 1 for the same vector and -1 for the opposite", () => {
    expect(similarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(similarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1);
    expect(similarity([1, null, 3], [1, 2, null])).toBeNull();
  });
  it("analog sites can be limited to the same ecoregion", () => {
    const eco = {
      a: { l1: "DESERTS", l2: null, l3: null },
      b: { l1: "FORESTS", l2: null, l3: null },
      c: { l1: "DESERTS", l2: null, l3: null },
      d: { l1: "DESERTS", l2: null, l3: null },
    };
    expect(analogSites(atlas, "a", eco, "any")[0].park).toBe("b");
    expect(analogSites(atlas, "a", eco, "l1").map((t) => t.park)).not.toContain("b");
    expect(analogSites(atlas, "a", eco, "l2")).toEqual([]); // no ecoregion at that level
  });
  it("feature rows put the closest match first", () => {
    const rows = featureRows(atlas, "a", "b");
    expect(rows.length).toBe(4);
    expect(rows[0].gap!).toBeLessThanOrEqual(rows[3].gap!);
  });
  it("finds b as a's twin and c as its opposite", () => {
    const { twins, opposite } = findTwins(atlas, "a");
    expect(twins[0].park).toBe("b");
    expect(twins[0].score).toBeGreaterThan(0.9);
    expect(opposite?.park).toBe("c");
  });
});

describe("odd neighbours", () => {
  const parks = [
    { id: "a", lat: 37, lon: -112 },
    { id: "b", lat: 45, lon: -70 },
    { id: "c", lat: 37.5, lon: -112.5 },
    { id: "d", lat: 30, lon: -100 },
  ];
  it("pairs close parks with opposite confirmed trends, once per pair", () => {
    const out = oddNeighbours(atlas, parks);
    expect(out.length).toBe(1);
    expect(out[0].up).toBe("a");
    expect(out[0].down).toBe("c");
    expect(out[0].km).toBeLessThan(100);
  });
  it("km is about right", () => {
    expect(km({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.2, 0);
  });
});

describe("anomaly of the week", () => {
  const crowd: Atlas = {
    ...atlas,
    atlas: { tmax_c: { annual: [cell("a", 0.5), cell("b", 0.4), cell("e", 0.3), cell("f", 0.35), cell("c", -0.4)] } },
  };
  it("puts the against-the-crowd trend first and is stable within a week", () => {
    const x = anomalyOfWeek(crowd, 0);
    expect(x?.cell.park_id).toBe("c");
    expect(x?.against).toBe(true);
    expect(x?.crowd).toBe(4);
    expect(anomalyOfWeek(crowd, 0)).toEqual(x);
  });
  it("changes pick from week to week", () => {
    expect(anomalyOfWeek(crowd, 1)?.cell.park_id).toBe("a");
  });
});

describe("head to head", () => {
  const row = (sen: number, q: number, sn: number, n: number) => ({ sen_per_decade: sen, q, signal_to_noise: sn, n_years: n }) as TrendRow;
  it("scores each round and counts wins", () => {
    const r = headToHead(row(-0.6, 0.01, 1.2, 45), row(0.3, 0.2, 0.5, 45), (x) => x.toFixed(1));
    expect(r.rounds.map((x) => x.winner)).toEqual(["a", "a", "a", "tie"]);
    expect([r.a, r.b]).toEqual([3, 0]);
  });
});
