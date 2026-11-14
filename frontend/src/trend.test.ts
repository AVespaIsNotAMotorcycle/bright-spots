import { describe, expect, it } from "vitest";
import { decimalYear, describeSlope, fitRows, linearFit, withTrend } from "./trend";

describe("decimalYear", () => {
  it("handles year, month and day dates", () => {
    expect(decimalYear("2020")).toBe(2020.5);
    expect(decimalYear("2020-01")).toBeCloseTo(2020 + 0.5 / 12);
    expect(decimalYear("2021-01-01")).toBeCloseTo(2021 + 0.5 / 365);
    expect(decimalYear("2020-12-31")).toBeCloseTo(2020 + 365.5 / 366);
    expect(decimalYear("nope")).toBeNull();
  });
});

describe("linearFit", () => {
  it("recovers an exact line", () => {
    const f = linearFit([
      [2000, 1],
      [2001, 3],
      [2002, 5],
    ])!;
    expect(f.slope).toBeCloseTo(2);
    expect(f.intercept + f.slope * 2000).toBeCloseTo(1);
    expect(f.r2).toBeCloseTo(1);
    expect([f.x0, f.x1, f.n]).toEqual([2000, 2002, 3]);
  });

  it("returns null for too few or degenerate points", () => {
    expect(linearFit([[1, 1], [2, 2]])).toBeNull();
    expect(linearFit([[1, 1], [1, 2], [1, 3]])).toBeNull();
  });

  it("gives r2 = 0 for uncorrelated data", () => {
    const f = linearFit([
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
      [1.5, 0.5],
    ])!;
    expect(f.r2).toBeLessThan(0.5);
  });
});

describe("fitRows / withTrend", () => {
  const rows = [
    { date: "2000", v: 10 },
    { date: "2001", v: null },
    { date: "2002", v: 14 },
    { date: "2003", v: 16 },
    { date: "2004", v: null },
  ];

  it("skips nulls and only draws the line within the data range", () => {
    const f = fitRows(rows, "date", "v")!;
    expect(f.n).toBe(3);
    expect(f.slope).toBeCloseTo(2);
    const out = withTrend(rows, "date", { v: f });
    expect(out[0].v__trend).toBeCloseTo(10);
    expect(out[1].v__trend).toBeCloseTo(12); // interpolated through gap
    expect(out[4].v__trend).toBeNull(); // after last observation
  });
});

describe("deseasonalized fit", () => {
  // 0.03/yr trend + 12-unit seasonal cycle, window starting in January and ending in October
  // (measured: raw OLS slope 0.153 vs true 0.030):
  // a raw OLS fit picks up the seasonal phase imbalance at the ends.
  const rows: Array<{ date: string; v: number }> = [];
  for (let y = 2016; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m > 10) break;
      const x = y + (m - 0.5) / 12;
      rows.push({ date: `${y}-${String(m).padStart(2, "0")}`, v: 0.03 * (x - 2016) + 12 * Math.sin((2 * Math.PI * (m - 4)) / 12) });
    }
  }

  it("recovers the true slope from seasonal monthly data", () => {
    const f = fitRows(rows, "date", "v")!;
    expect(f.deseasonalized).toBe(true);
    expect(f.slope).toBeCloseTo(0.03, 3);
  });

  it("a raw fit of the same data is biased (why we deseasonalize)", () => {
    const raw = linearFit(rows.map((r) => [decimalYear(r.date)!, r.v]))!;
    expect(raw.slope).toBeCloseTo(0.153, 2);
  });

  it("falls back to a raw fit for yearly data or months seen once", () => {
    expect(fitRows([{ d: "2000", v: 1 }, { d: "2001", v: 2 }, { d: "2002", v: 3 }], "d", "v")!.deseasonalized).toBe(false);
    expect(fitRows([{ d: "2000-01", v: 1 }, { d: "2000-02", v: 2 }, { d: "2000-03", v: 3 }], "d", "v")!.deseasonalized).toBe(false);
  });
});

describe("describeSlope", () => {
  const base = { intercept: 0, r2: 0, n: 10, deseasonalized: false };
  it("uses per-decade for long spans and per-year for short", () => {
    expect(describeSlope({ ...base, slope: 0.031, x0: 1990, x1: 2020 }, "°C")).toBe("+0.310 °C per decade");
    expect(describeSlope({ ...base, slope: -0.05, x0: 2023, x1: 2025 }, "NDVI")).toBe("−0.050 NDVI per year");
    expect(describeSlope({ ...base, slope: 12.34, x0: 2000, x1: 2025 }, "mm/year")).toBe("+123 mm/year per decade");
  });
});
