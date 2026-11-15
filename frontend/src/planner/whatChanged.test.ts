import { describe, expect, it } from "vitest";
import real from "../../public/data/atlas.json";
import type { Atlas } from "../atlas/model";
import { whatChanged } from "./whatChanged";

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
