import { fmtNum, fmtP, perDecade, type Atlas } from "../atlas/model";
import { MONTHS } from "./model";

const MONTH_IDS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * "What changed?" for a trip card: the travel month's daytime high, as the total
 * change over the record (Sen's slope per decade x decades), from the NASA POWER atlas.
 */
export function whatChanged(atlas: Atlas | null, parkId: string, month: number, fahrenheit: boolean, science = false): string | null {
  const meta = atlas?.variables.tmax;
  const i = atlas ? atlas.parks.findIndex((x) => x.id === parkId) : -1;
  const cell = atlas && i >= 0 ? atlas.cells.tmax?.[MONTH_IDS[month - 1]]?.[i] : undefined;
  if (!meta || !cell || cell.first_year == null || cell.last_year == null) return null;
  if (cell.verdict === "too_little_data" || cell.sen_per_decade == null) return null;
  const mon = MONTHS[month - 1];
  const since = `since ${cell.first_year}`;
  const stats = science ? ` (Sen's slope, p = ${fmtP(cell.p)}, q = ${fmtP(cell.q)})` : "";
  if (cell.verdict !== "real" && cell.verdict !== "possible") return `${mon} days here show no clear change ${since}${stats}.`;
  const total = perDecade(Math.abs(cell.sen_per_decade) * ((cell.last_year - cell.first_year) / 10), "tmax", meta, fahrenheit);
  const dir = cell.direction === "up" ? "warmer" : "cooler";
  const sure = cell.verdict === "real" ? "" : " This may still be luck.";
  return `${mon} days here got about ${fmtNum(total.value)} ${total.unit} ${dir} ${since}.${sure}${stats}`;
}

export interface TrendTag {
  /** Short text for a card, e.g. "Jul days +2.1 °F since 1981". */
  text: string;
  /** real = passed the significance test, maybe = possible, flat = no clear change. */
  kind: "real" | "maybe" | "flat";
  /** ↗ warmer, ↘ cooler, → flat. */
  arrow: string;
  /** Longer sentence for a tooltip. */
  title: string;
}

/** The travel month's daytime-high trend in a few words, for planner cards. */
export function trendTag(atlas: Atlas | null, parkId: string, month: number, fahrenheit: boolean): TrendTag | null {
  const meta = atlas?.variables.tmax;
  const i = atlas ? atlas.parks.findIndex((x) => x.id === parkId) : -1;
  const cell = atlas && i >= 0 ? atlas.cells.tmax?.[MONTH_IDS[month - 1]]?.[i] : undefined;
  if (!meta || !cell || cell.first_year == null || cell.last_year == null) return null;
  if (cell.verdict === "too_little_data" || cell.sen_per_decade == null) return null;
  const mon = MONTHS[month - 1];
  const title = `${whatChanged(atlas, parkId, month, fahrenheit) ?? ""} NASA POWER daily highs, Mann-Kendall test.`.trim();
  if (cell.verdict !== "real" && cell.verdict !== "possible") {
    return { text: `${mon} days: no clear change since ${cell.first_year}`, kind: "flat", arrow: "→", title };
  }
  const total = perDecade(Math.abs(cell.sen_per_decade) * ((cell.last_year - cell.first_year) / 10), "tmax", meta, fahrenheit);
  const sign = cell.direction === "up" ? "+" : "−";
  const maybe = cell.verdict === "real" ? "" : " (maybe)";
  return { text: `${mon} days ${sign}${fmtNum(total.value)} ${total.unit} since ${cell.first_year}${maybe}`, kind: cell.verdict === "real" ? "real" : "maybe", arrow: cell.direction === "up" ? "↗" : "↘", title };
}
