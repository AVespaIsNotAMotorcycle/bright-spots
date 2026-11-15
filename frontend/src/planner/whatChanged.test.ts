import { describe, expect, it } from "vitest";
import real from "../../public/data/atlas.json";
import type { Atlas } from "../atlas/model";
import { trendTag, whatChanged } from "./whatChanged";

const atlas = real as unknown as Atlas;

describe("what changed?", () => {
  it("turns the real July Acadia trend into a total change since 1981", () => {
    const cell = atlas.cells.tmax.jul[atlas.parks.findIndex((p) => p.id === "acadia")];
    const text = whatChanged(atlas, "acadia", 7, true)!;
    expect(text).toMatch(/^Jul days here/);
    if (cell.verdict === "real") {
      const total = (cell.sen_per_decade! * 1.8 * (cell.last_year! - cell.first_year!)) / 10;
      expect(text).toContain(`about ${total.toFixed(1)} °F warmer since ${cell.first_year}`);
    }
    expect(text).not.toContain("q =");
    expect(whatChanged(atlas, "acadia", 7, true, true)).toContain("q =");
  });

  it("says nothing without data", () => {
    expect(whatChanged(null, "acadia", 7, true)).toBeNull();
    expect(whatChanged(atlas, "nowhere", 7, true)).toBeNull();
  });
});

describe("trend tag for planner cards", () => {
  it("matches the atlas verdict and direction", () => {
    for (const id of ["acadia", "north-cascades", "zion"]) {
      const i = atlas.parks.findIndex((p) => p.id === id);
      if (i < 0) continue;
      const cell = atlas.cells.tmax.jul[i];
      const t = trendTag(atlas, id, 7, true)!;
      expect(t.text).toMatch(/^Jul days/);
      if (cell.verdict === "real") expect(t.kind).toBe("real");
      else if (cell.verdict === "possible") expect(t.kind).toBe("maybe");
      else expect(t.kind).toBe("flat");
      if (t.kind !== "flat") expect(t.arrow).toBe(cell.direction === "up" ? "↗" : "↘");
      expect(t.title).toContain("Mann-Kendall");
    }
  });

  it("is null without data", () => {
    expect(trendTag(null, "acadia", 7, true)).toBeNull();
  });
});
