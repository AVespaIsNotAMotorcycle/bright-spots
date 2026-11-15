import { describe, expect, it } from "vitest";
import real from "../../../backend/data/trends/atlas.json";
import type { Atlas } from "./model";
import { twinRound } from "./TwinGame";

// The real NASA POWER atlas, so the game is checked on the data players will see.
const atlas = real as unknown as Atlas;

describe("guess the twin", () => {
  it("has a clear answer and two very different decoys, the same all day", () => {
    for (const day of [20000, 20001, 20002, 20003]) {
      const r = twinRound(atlas, day)!;
      expect(r).not.toBeNull();
      expect(r.options).toHaveLength(3);
      expect(new Set(r.options).size).toBe(3);
      expect(r.options).toContain(r.answer);
      expect(r.options).not.toContain(r.park);
      expect(r.score).toBeGreaterThanOrEqual(0.7);
      expect(twinRound(atlas, day)).toEqual(r);
    }
  });
});
