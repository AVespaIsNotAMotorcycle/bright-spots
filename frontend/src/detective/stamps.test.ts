import { describe, expect, it } from "vitest";
import photos from "./parkPhotos.json";
import { CASES } from "./cases";
import { PARK_NAMES } from "./parkNames";
import { caseForPark, caseParks, casesByPark, mainPark, stamps } from "./stamps";

const ON_DISK = Object.keys(import.meta.glob("/public/parks/*.jpg"));

describe("park passport", () => {
  it("every case studies at least one real park", () => {
    for (const c of CASES) {
      const parks = caseParks(c);
      expect(parks.length, c.id).toBeGreaterThan(0);
      for (const p of parks) expect(PARK_NAMES[p], `${c.id}: ${p}`).toBeTruthy();
    }
  });

  it("crater lake is the main park of its own case", () => {
    expect(mainPark(CASES.find((c) => c.id === "crater-lake-warming")!)).toBe("crla");
  });

  it("solving a case stamps its parks, and a second case adds a star", () => {
    const s = stamps({ "crater-lake-warming": { stars: 3 }, "july-crater": { stars: 1 } });
    expect(s.get("crla")).toEqual(["crater-lake-warming", "july-crater"]);
    expect(stamps({}).size).toBe(0);
  });

  it("every park has a credited, freely licensed photo on disk", () => {
    for (const p of Object.keys(PARK_NAMES)) {
      const ph = (photos as Record<string, { file: string; credit: string; license: string; source: string }>)[p];
      expect(ph, p).toBeTruthy();
      expect(ON_DISK, ph.file).toContain(`/public${ph.file}`);
      expect(ph.license).toMatch(/public domain|cc|fal/i);
      expect(ph.source).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it("points to an unsolved case for a park when one exists", () => {
    const c = caseForPark("crla", { "crater-lake-warming": { stars: 3 } });
    expect(c?.id).not.toBe("crater-lake-warming");
    expect(casesByPark().size).toBeGreaterThan(10);
  });
});
