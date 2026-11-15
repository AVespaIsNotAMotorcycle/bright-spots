import { describe, expect, it } from "vitest";
import {
  AVOIDS,
  DEFAULT_STATE,
  MOODS,
  WANTS,
  applyMood,
  bandsOf,
  decodeState,
  encodeState,
  nextLevel,
  reasonText,
  seasonOf,
  tripQuery,
  whySentence,
  type TripPark,
} from "./tripModel";

describe("trip model", () => {
  it("seasons cover every month once", () => {
    const seen = new Set<string>();
    for (let m = 1; m <= 12; m++) seen.add(`${m}:${seasonOf(m).id}`);
    expect(seen.size).toBe(12);
    expect(seasonOf(12).id).toBe("winter");
    expect(seasonOf(10).id).toBe("autumn");
  });

  it("chip taps go off, nice, must, off", () => {
    expect(nextLevel(undefined)).toBe("nice");
    expect(nextLevel("nice")).toBe("must");
    expect(nextLevel("must")).toBeUndefined();
  });

  it("state survives the URL round trip", () => {
    const s = { ...DEFAULT_STATE, months: [9, 10, 11], feels: ["cool", "mild"], want: { stars: "must" as const, fall: "nice" as const }, avoid: { bugs: "must" as const }, horizon: "y2050" as const };
    expect(decodeState(encodeState(s))).toEqual(s);
    const c = { ...s, custom: [-5, 4.5] as [number, number] };
    expect(decodeState(encodeState(c))?.custom).toEqual([-5, 4.5]);
    expect(decodeState("m=13")).toBeNull();
  });

  it("builds the API query with must marks and bands", () => {
    const q = tripQuery({ ...DEFAULT_STATE, months: [7], feels: ["warm", "hot"], want: { camping: "must" }, avoid: { fire: "nice" } });
    expect(q.get("months")).toBe("7");
    expect(q.get("bands")).toBe("24:30,30:40");
    expect(q.get("want")).toBe("camping!");
    expect(q.get("avoid")).toBe("fire");
    expect(bandsOf({ ...DEFAULT_STATE, feels: [] })).toEqual([[15, 24], [24, 30]]);
  });

  it("every mood only uses real chips", () => {
    const keys = new Set([...WANTS, ...AVOIDS].map((c) => c.key));
    for (const m of MOODS) {
      const s = applyMood(DEFAULT_STATE, m);
      for (const k of [...Object.keys(s.want), ...Object.keys(s.avoid)]) expect(keys.has(k), `${m.id}: ${k}`).toBe(true);
    }
  });

  it("writes plain reasons and a why sentence", () => {
    expect(reasonText({ key: "temperature", kind: "feel", level: "nice", score: 1, value: 20 }, "F")).toBe("68°F highs");
    expect(reasonText({ key: "fire", kind: "avoid", level: "nice", score: null, value: null }, "C")).toBe("no data here");
    const p = {
      park: { short: "Zion" }, best_month: 10,
      reasons: [
        { key: "temperature", kind: "feel", level: "nice", score: 1, value: 24 },
        { key: "stars", kind: "want", level: "must", score: 0.9, value: 20 },
        { key: "bugs", kind: "avoid", level: "nice", score: 0.2, value: 0.8 },
      ],
    } as unknown as TripPark;
    expect(whySentence(p, "C")).toBe("Zion wins in October: 80% clear skies and 24°C highs.");
  });
});
