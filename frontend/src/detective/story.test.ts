import { describe, expect, it } from "vitest";
import type { AtlasCell, TrendRow } from "./model";
import { buildStory } from "./story";

const years = Array.from({ length: 45 }, (_, i) => 1981 + i);
const rising = years.map((y, i) => 60 + i * 0.085 + (i % 3) * 0.4 + (y === 2012 ? 3 : 0));

function row(variable: string, extra: Partial<TrendRow> = {}): TrendRow {
  return {
    variable, period: "annual", n_years: 45, first_year: 1981, last_year: 2025, mean: 62, sen_per_decade: 0.85,
    sen_per_decade_f: null, ols_per_decade: null, ols_ci_low: null, ols_ci_high: null, ols_p: null, mk_p: null,
    p: 0.001, p_method: null, q: 0.001, signal_to_noise: null, lag1_autocorr: null, tests_agree: null,
    verdict: "real", power_sen_per_decade: null, sources_same_direction: null, ...extra,
  };
}

const cells: AtlasCell[] = Array.from({ length: 20 }, (_, i) => ({ park_id: `p${i}`, sen: i / 10, q: 0.01, verdict: "real" }));

describe("buildStory", () => {
  it("uses this chart's own numbers", () => {
    const s = buildStory({ park: "Arches", parkId: "p19", label: "Average daily high", unit: "°F", variable: "tmax_c", series: { years, values: rising }, trend: row("tmax_c"), cells });
    expect(s.text).toContain("0.85°F");
    expect(s.facts.some((f) => f.includes("2012"))).toBe(true); // record year
    expect(s.facts.some((f) => f.includes("#1"))).toBe(true); // rank among parks
  });

  it("reads differently for different variables at the same park", () => {
    const a = buildStory({ park: "Arches", label: "Average daily high", unit: "°F", variable: "tmax_c", series: { years, values: rising }, trend: row("tmax_c") });
    const b = buildStory({ park: "Arches", label: "Average daily low", unit: "°F", variable: "tmin_c", series: { years, values: rising }, trend: row("tmin_c") });
    const c = buildStory({ park: "Arches", label: "Average temperature", unit: "°F", variable: "tmean_c", series: { years, values: rising }, trend: row("tmean_c") });
    const last = (t: string) => t.split(". ").slice(-1)[0];
    expect(new Set([a.text, b.text, c.text]).size).toBe(3);
    expect(new Set([last(a.text), last(b.text), last(c.text)]).size).toBeGreaterThan(1);
  });

  it("never claims a direction when there is no trend", () => {
    const s = buildStory({ park: "Olympic", label: "Rain", unit: "mm", variable: "prcp_mm", series: { years, values: rising }, trend: row("prcp_mm", { verdict: "none" }) });
    expect(s.text).not.toMatch(/crept up|climbed|rises/);
  });
});
