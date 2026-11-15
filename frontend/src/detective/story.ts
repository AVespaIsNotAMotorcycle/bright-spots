// Builds a plain-words story for one chart from its own numbers.
// Each chart gets different facts (record year, last 10 vs first 10 years, rank among parks,
// biggest jump...) and different wording, picked by a seed from park + variable + period.
// Nothing here is invented: every number comes from the series, the trend row or the atlas.
import type { AtlasCell, TrendRow, YearlySeries } from "./model";

export interface StoryInput {
  park: string;
  /** Park id, used to find this park's rank in `cells`. */
  parkId?: string;
  label: string;
  unit: string;          // display unit, e.g. "°F", "days", "mm"
  variable: string;      // atlas key, e.g. "tmax_c"
  series: YearlySeries;  // in display units
  trend: TrendRow;       // sen_per_decade and mean in display units
  cells?: AtlasCell[];   // every park, same variable and period (for rank)
}

export interface Story { text: string; facts: string[] }

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** "Arches" -> "Arches'", "Zion" -> "Zion's". */
const poss = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);

const pickOf = <T,>(arr: T[], seed: number, salt = 0) => arr[(seed + salt * 7919) % arr.length];

export function buildStory(inp: StoryInput): Story {
  const { park, unit, variable, series, trend } = inp;
  const seed = hash(`${park}|${variable}|${trend.period}`);
  const label = inp.label.charAt(0).toLowerCase() + inp.label.slice(1);
  const isTemp = unit.includes("°");
  const isDays = unit === "days";
  const isRain = variable.startsWith("prcp");

  const num = (x: number) => {
    const a = Math.abs(x);
    return a >= 10 ? a.toFixed(0) : a >= 1 ? a.toFixed(1) : a.toFixed(2);
  };
  const amt = (x: number) => (isTemp ? `${num(x)}°F` : isDays ? `${num(x)} days` : `${num(x)} ${unit}`);
  const more = (x: number) =>
    isTemp ? (x >= 0 ? "warmer" : "cooler") : isRain ? (x >= 0 ? "wetter" : "drier") : x >= 0 ? "higher" : "lower";

  const pts = series.years
    .map((y, i) => ({ y, v: series.values[i] }))
    .filter((p) => p.v != null && Number.isFinite(p.v));
  const s = trend.sen_per_decade;
  const v = trend.verdict;
  const y0 = pts[0]?.y ?? trend.first_year ?? 1981;
  const y1 = pts[pts.length - 1]?.y ?? trend.last_year ?? 2025;
  const facts: string[] = [];

  // ── Lead sentence ──
  let lead: string;
  if (s == null || v === "short" || v === "flat") {
    lead = `There is not enough change in ${label} at ${park} to tell a story yet.`;
  } else if (v === "none") {
    lead = pickOf(
      [
        `${label[0].toUpperCase() + label.slice(1)} at ${park} bounces up and down, with no lasting direction since ${y0}.`,
        `At ${park}, ${label} has good years and bad years, but no steady climb or drop.`,
        `${poss(park)} ${label} wiggles around the same level it had in ${y0}.`,
      ],
      seed,
    );
  } else {
    const up = s > 0;
    const leads = isDays
      ? Math.abs(s) < 0.1
        ? [`${park} has almost the same number of ${label} as in ${y0}.`]
        : [
            `${park} gets about ${num(s)} ${up ? "more" : "fewer"} ${label} every 10 years.`,
            `Every decade, ${park} ${up ? "adds" : "loses"} roughly ${num(s)} ${label}.`,
            `Since ${y0}, ${park} has ${up ? "gained" : "lost"} about ${num(s)} ${label} each decade.`,
          ]
      : [
          `${poss(park)} ${label} has ${up ? "crept up" : "slipped down"} about ${amt(s)} every 10 years since ${y0}.`,
          `Every decade, ${label} at ${park} gets about ${amt(s)} ${more(s)}.`,
          `Since ${y0}, ${park} has ${up ? "climbed" : "dropped"} roughly ${amt(s)} per decade in ${label}.`,
          `Follow the dashed line: ${label} at ${park} ${up ? "rises" : "falls"} about ${amt(s)} each decade.`,
        ];
    lead = pickOf(leads, seed);
    const span = y1 - y0;
    if (span >= 10) facts.push(`Over ${span} years, that adds up to about ${amt((s * span) / 10)}.`);
  }

  // ── Last 10 years vs first 10 years ──
  if (pts.length >= 20) {
    const avg = (a: typeof pts) => a.reduce((n, p) => n + p.v, 0) / a.length;
    const d = avg(pts.slice(-10)) - avg(pts.slice(0, 10));
    if (Math.abs(d) > 0) {
      facts.push(
        isDays
          ? `The last 10 years averaged ${amt(d)} ${d >= 0 ? "more" : "fewer"} than the first 10.`
          : `The last 10 years averaged ${amt(d)} ${more(d)} than ${y0}–${y0 + 9}.`,
      );
    }
  }

  // ── Record years ──
  if (pts.length >= 5) {
    const hi = pts.reduce((a, b) => (b.v > a.v ? b : a));
    const lo = pts.reduce((a, b) => (b.v < a.v ? b : a));
    const hiWord = isTemp ? "warmest" : isRain ? "wettest" : isDays ? "biggest" : "highest";
    const loWord = isTemp ? "coolest" : isRain ? "driest" : isDays ? "smallest" : "lowest";
    const val = (x: number) => (isTemp ? `${x.toFixed(1)}°F` : isDays ? `${x.toFixed(0)} days` : `${x.toFixed(0)} ${unit}`);
    facts.push(
      pickOf(
        [
          `The ${hiWord} year on the chart was ${hi.y} (${val(hi.v)}). The ${loWord} was ${lo.y}.`,
          `Spot the peak: ${hi.y} was the ${hiWord} year, at ${val(hi.v)}.`,
          `${lo.y} was the ${loWord} year, and ${hi.y} the ${hiWord}.`,
        ],
        seed,
        1,
      ),
    );
  }

  // ── Recent years above or below the long-run line ──
  if (trend.mean != null && pts.length >= 10) {
    const k = pts.slice(-10).filter((p) => p.v > trend.mean!).length;
    if (k >= 7) facts.push(`${k} of the last 10 years sat above the long-run average line.`);
    else if (k <= 3) facts.push(`Only ${k} of the last 10 years made it above the long-run average line.`);
  }

  // ── Biggest one-year jump ──
  if (pts.length >= 5) {
    let best = { d: 0, y: 0 };
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].v - pts[i - 1].v;
      if (pts[i].y - pts[i - 1].y === 1 && Math.abs(d) > Math.abs(best.d)) best = { d, y: pts[i].y };
    }
    if (best.y) {
      facts.push(`The biggest one-year swing was ${amt(best.d)} ${best.d >= 0 ? "up" : "down"}, from ${best.y - 1} to ${best.y}.`);
    }
  }

  // ── Rank among parks ──
  const cells = (inp.cells ?? []).filter((c) => c.sen != null);
  const rankFact = rankLine(inp, cells);
  if (rankFact) facts.push(rankFact);

  // ── Verdict, worded differently each time ──
  const verdict =
    v === "real"
      ? pickOf(
          [
            "The trend test confirms it: this is a steady change.",
            "Our test checked: the pattern holds up, so it is a confirmed trend.",
            "Statistically, this one is confirmed.",
            "This change passed the test across all parks, so it is confirmed.",
          ],
          seed,
          2,
        )
      : v === "possible"
        ? pickOf(
            [
              "It might be real, but a few more years of data will tell.",
              "The test leans yes, but it is not sure yet.",
              "A possible trend: promising, not proven.",
            ],
            seed,
            2,
          )
        : v === "none"
          ? pickOf(
              [
                "The test finds no clear trend here.",
                "These ups and downs look like normal weather.",
                "No steady change shows up in the test.",
              ],
              seed,
              2,
            )
          : "";

  // Rotate which facts this chart shows, so neighbouring charts read differently.
  const start = seed % Math.max(1, facts.length);
  const rotated = [...facts.slice(start), ...facts.slice(0, start)];
  const chosen = rotated.slice(0, 2);
  const text = [lead, ...chosen, verdict].filter(Boolean).join(" ");
  return { text, facts: [lead, ...facts, verdict].filter(Boolean) };
}

function rankLine(inp: StoryInput, cells: AtlasCell[]): string | null {
  const s = inp.trend.sen_per_decade;
  if (cells.length <= 5 || s == null || inp.trend.verdict === "none") return null;
  const me = inp.parkId ? cells.find((c) => c.park_id === inp.parkId) : undefined;
  if (!me) return null;
  const up = s > 0;
  const sorted = [...cells].sort((a, b) => (up ? b.sen! - a.sen! : a.sen! - b.sen!));
  const r = sorted.indexOf(me) + 1;
  const n = sorted.length;
  const where = r <= Math.ceil(n * 0.15) ? `one of the fastest` : r >= Math.floor(n * 0.85) ? `one of the slowest` : r <= n / 2 ? "faster than most" : "slower than most";
  return `Among ${n} national parks, that is #${r} for ${up ? "rising" : "falling"}: ${where}.`;
}

