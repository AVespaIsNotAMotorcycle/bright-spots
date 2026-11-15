// Interactive detective cases. Every number in a reveal is read from the live atlas.
import type { Atlas } from "./model";
import type { Case, Side } from "./cases";
import { cellOf, fmtRate, parkName, shown } from "./games";

const S = (parkId: string, variable: string, period: string): Side => ({ parkId, variable, period });

/** "+0.52 °F per decade" for one park/variable/period. */
const R = (a: Atlas, p: string, v: string, per: string) =>
  fmtRate(a, v, shown(a, v, cellOf(a, S(p, v, per))?.sen ?? null));

const countReal = (a: Atlas, v: string, per: string) => {
  const cells = a.atlas[v]?.[per] ?? [];
  const tested = cells.filter((c) => c.verdict !== "short" && c.verdict !== "flat");
  return { real: tested.filter((c) => c.verdict === "real").length, total: tested.length };
};

export const MORE_CASES: Case[] = [
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "crater-lake-warming",
    title: "Is Crater Lake warming?",
    subtitle: "The challenge author filmed his intro here. Does the data agree with the vibe?",
    emoji: "🌋",
    difficulty: "easy",
    badge: "🌋 Rim Detective",
    steps: [
      {
        kind: "intro",
        heading: "The deepest lake in America",
        body: "Crater Lake sits inside a volcano that blew up 7,700 years ago. The water is so blue it looks fake. Your first case: is the air around it warming, or is it all in our heads?",
      },
      {
        kind: "verdict",
        heading: "Eyeball it",
        body: "Here are 45 years of annual high temperatures at Crater Lake. No line yet. What do you see?",
        verdictQ: S("crla", "tmax_c", "annual"),
        fact: "The dots tilt upward. A tilt that small is hard to spot by eye, which is why we use a statistical test.",
      },
      {
        kind: "guess",
        heading: "Put a number on it",
        body: "How fast is the annual high rising, in °F per decade?",
        guess: { parkId: "crla", variable: "tmax_c", period: "annual", min: 0, max: 2.5, step: 0.05 },
        fact: "Small per decade, but it adds up over a lifetime.",
      },
      {
        kind: "duel",
        heading: "Lake vs the Pacific",
        body: "Crater Lake or Channel Islands: whose annual high is rising faster?",
        duel: { a: S("crla", "tmax_c", "annual"), b: S("chis", "tmax_c", "annual") },
        fact: (a) => `Crater Lake ${R(a, "crla", "tmax_c", "annual")}. Channel Islands ${R(a, "chis", "tmax_c", "annual")}.`,
      },
      {
        kind: "hunt",
        heading: "Which July is the hottest mover?",
        body: "Look at July highs only. Which park is climbing fastest?",
        hunt: { parks: ["crla", "lavo", "grba", "grte"], variable: "tmax_c", period: "7", pick: "max" },
        fact: (a) => `Crater Lake: ${R(a, "crla", "tmax_c", "7")}. July is where the signal shouts.`,
      },
      {
        kind: "myth",
        heading: "Myth or fact?",
        body: "Crater Lake's warming is just random noise.",
        myth: { isTrue: false },
        fact: (a) => {
          const q = cellOf(a, S("crla", "tmax_c", "annual"))?.q;
          return `The false-alarm-corrected q is ${q != null ? q.toFixed(3) : "small"}, under the 0.05 bar. Not luck.`;
        },
      },
      {
        kind: "interpret",
        heading: "So should I pack different?",
        body: "A hotter July means earlier snowmelt and a shorter snow season. Peek at what a July visit looks like now.",
        parkId: "crla",
        variable: "tmax_c",
        period: "7",
        plannerLink: { month: 7, label: "Plan a July visit to Crater Lake" },
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "opposite-rain",
    title: "Same planet, opposite answers",
    subtitle: "One park is getting wetter while another dries out. Same warming, two stories.",
    emoji: "🌧️",
    difficulty: "medium",
    badge: "🌦️ Weather Whisperer",
    steps: [
      {
        kind: "intro",
        heading: "Mission: catch two parks doing opposite things",
        body: "You are an intern at NASA's rain desk. Your boss slides two folders across the table: one park getting wetter, one getting drier. Same planet, same warming. Prove it with five quick questions.",
      },
      {
        kind: "duel",
        heading: "Duel: who is getting wetter?",
        body: "Yearly rain, 1981 to now. Which park is gaining rain faster?",
        duel: { a: S("olym", "prcp_mm", "annual"), b: S("maca", "prcp_mm", "annual") },
        fact: (a) =>
          `Mammoth Cave: ${R(a, "maca", "prcp_mm", "annual")}. Olympic: ${R(a, "olym", "prcp_mm", "annual")}. ` +
          "One wetter, one drier, both only “possible”. Rainfall is noisy, so it needs a long record.",
      },
      {
        kind: "hunt",
        heading: "Find the driest drift",
        body: "Which of these four is losing yearly rain the fastest?",
        hunt: { parks: ["olym", "viis", "npsa", "drto"], variable: "prcp_mm", period: "annual", pick: "min" },
        fact: (a) =>
          `Virgin Islands ${R(a, "viis", "prcp_mm", "annual")}, American Samoa ${R(a, "npsa", "prcp_mm", "annual")}. ` +
          "Tropical islands are drying fast.",
      },
      {
        kind: "myth",
        heading: "Myth or fact?",
        body: "Warming means every park gets more rain.",
        myth: { isTrue: false },
        fact: (a) => {
          const c = a.atlas.prcp_mm.annual;
          const up = c.filter((x) => (x.sen ?? 0) > 0).length;
          const down = c.filter((x) => (x.sen ?? 0) < 0).length;
          return `${up} parks lean wetter and ${down} lean drier. Most of those shifts are not strong enough to call real.`;
        },
      },
      {
        kind: "verdict",
        heading: "Olympic rain: real, maybe, or noise?",
        body: "Judge the dots. No trend line yet.",
        verdictQ: S("olym", "prcp_mm", "annual"),
        fact: "A big drop that is still only “possible”. Rain swings a lot from year to year.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "hottest-park",
    title: "Which park adds hot days fastest?",
    subtitle: "Days above 90°F are piling up. Find the hot spot.",
    emoji: "🌡️",
    difficulty: "hard",
    badge: "🔥 Heat Hunter",
    steps: [
      {
        kind: "intro",
        heading: "Mission: find the park that is cooking",
        body: "A ranger radio crackles: “Hot days are piling up and nobody can say where first.” Count the days above 90°F, park by park, and find the hot spot.",
      },
      {
        kind: "hunt",
        heading: "Pick the fastest hot-day climber",
        body: "Which park is adding 90°F days the fastest?",
        hunt: { parks: ["deva", "zion", "grca", "cave"], variable: "hot90_days", period: "annual", pick: "max" },
        fact: (a) =>
          `Carlsbad Caverns adds ${R(a, "cave", "hot90_days", "annual")}. ` +
          `Death Valley is next at ${R(a, "deva", "hot90_days", "annual")}.`,
      },
      {
        kind: "guess",
        heading: "Zion: how fast?",
        body: "Slide to your guess for hot days added per decade in Zion.",
        guess: { parkId: "zion", variable: "hot90_days", period: "annual", min: 0, max: 12, step: 0.1 },
        fact: "Hot days add up. Over 45 years that is about four and a half decades of growth.",
      },
      {
        kind: "verdict",
        heading: "Yosemite: cooler, so no change?",
        body: "Yosemite's valley floor feels hot in summer. Judge its yearly count of 90°F days.",
        verdictQ: S("yose", "hot90_days", "annual"),
        fact: "A trend that is flat: the count did not drift up or down over the record.",
      },
      {
        kind: "interpret",
        heading: "What this means for a visit",
        body:
          "In hot-climbing parks, spring and autumn are replacing midsummer as the safest hiking windows. " +
          "Check the planner for a cooler month.",
        parkId: "zion",
        variable: "hot90_days",
        period: "annual",
        plannerLink: { month: 10, label: "Plan an October visit to Zion" },
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "desert-fever",
    title: "Desert Fever Showdown",
    subtitle: "Triple-digit days. Which desert is cooking the fastest?",
    emoji: "🏜️",
    difficulty: "easy",
    badge: "🏜️ Desert Whisperer",
    steps: [
      {
        kind: "intro",
        heading: "Welcome to the heat dome",
        body: "Four deserts walk into a bar. The bartender asks: who has been adding 100°F days the fastest? You have 5 seconds an answer. Do not sweat it. (You will.)",
      },
      {
        kind: "duel",
        heading: "Round 1: two giants",
        body: "Death Valley or Big Bend: who is adding 100°F days faster?",
        duel: { a: S("deva", "hot100_days", "annual"), b: S("bibe", "hot100_days", "annual") },
        fact: (a) => `Death Valley ${R(a, "deva", "hot100_days", "annual")}, Big Bend ${R(a, "bibe", "hot100_days", "annual")}.`,
      },
      {
        kind: "hunt",
        heading: "Round 2: the line-up",
        body: "Now four parks. Who tops the list?",
        hunt: { parks: ["deva", "jotr", "bibe", "cave"], variable: "hot100_days", period: "annual", pick: "max" },
        fact: (a) => `${parkName("deva")} wins at ${R(a, "deva", "hot100_days", "annual")}.`,
      },
      {
        kind: "guess",
        heading: "Round 3: the number",
        body: "How many extra 100°F days does Death Valley add each decade?",
        guess: { parkId: "deva", variable: "hot100_days", period: "annual", min: 0, max: 16, step: 0.1 },
        fact: "That is roughly one more triple-digit week every decade.",
      },
      {
        kind: "verdict",
        heading: "Final round: believe it?",
        body: "Death Valley's 100°F day counts. Real, maybe, or noise?",
        verdictQ: S("deva", "hot100_days", "annual"),
        fact: "Steady climb, strong signal.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "night-shift",
    title: "The Night Shift",
    subtitle: "Do the nights warm faster than the days? Catch the sneaky one.",
    emoji: "🌙",
    difficulty: "medium",
    badge: "🌙 Night Owl",
    steps: [
      {
        kind: "intro",
        heading: "Clock in for the night shift",
        body: "Everyone tracks the hot afternoons. Almost nobody checks the cool-down at midnight. Today you are the one who does.",
      },
      {
        kind: "duel",
        heading: "Joshua Tree: days or nights?",
        body: "Which one is warming faster: the daytime high or the night-time low?",
        duel: { a: S("jotr", "tmax_c", "annual"), b: S("jotr", "tmin_c", "annual") },
        fact: (a) => `Highs ${R(a, "jotr", "tmax_c", "annual")}. Lows ${R(a, "jotr", "tmin_c", "annual")}.`,
      },
      {
        kind: "duel",
        heading: "Same question, new desert",
        body: "Death Valley: daytime highs or night-time lows?",
        duel: { a: S("deva", "tmax_c", "annual"), b: S("deva", "tmin_c", "annual") },
        fact: (a) => `Highs ${R(a, "deva", "tmax_c", "annual")}. Lows ${R(a, "deva", "tmin_c", "annual")}.`,
      },
      {
        kind: "hunt",
        heading: "Hottest nights of summer",
        body: "Which park's summer lows are rising fastest?",
        hunt: { parks: ["yose", "jotr", "deva", "pefo"], variable: "tmin_c", period: "JJA", pick: "max" },
        fact: (a) => `Yosemite: ${R(a, "yose", "tmin_c", "JJA")}.`,
      },
      {
        kind: "myth",
        heading: "Myth or fact?",
        body: "Night-time lows are warming at fewer parks than daytime highs.",
        myth: { isTrue: false },
        fact: (a) => {
          const lo = countReal(a, "tmin_c", "annual");
          const hi = countReal(a, "tmax_c", "annual");
          return `Real warming in lows: ${lo.real} of ${lo.total} parks. In highs: ${hi.real} of ${hi.total}. Nights are the broader signal.`;
        },
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "cold-spot",
    title: "The Cold Spot Mystery",
    subtitle: "One island refuses to heat up. Why? Find the odd one out.",
    emoji: "🏝️",
    difficulty: "medium",
    badge: "🕵️ Odd One Out",
    steps: [
      {
        kind: "intro",
        heading: "The case of the stubborn island",
        body: "Almost every park on the map is warming. A few refuse. Somebody has to find out which, and why the ocean might be covering for them.",
      },
      {
        kind: "hunt",
        heading: "Who is warming the least?",
        body: "Which of these parks has the slowest annual high temperature trend?",
        hunt: { parks: ["chis", "olym", "havo", "glba"], variable: "tmax_c", period: "annual", pick: "min" },
        fact: (a) =>
          `Channel Islands is ${R(a, "chis", "tmax_c", "annual")}. ` +
          "The cold Pacific acts like a giant thermostat and soaks up the heat.",
      },
      {
        kind: "verdict",
        heading: "Is the cooling real?",
        body: "Channel Islands' yearly high temperatures. What do you see?",
        verdictQ: S("chis", "tmax_c", "annual"),
        fact: "No real trend either way. “Not changing” is a finding too.",
      },
      {
        kind: "myth",
        heading: "Myth or fact?",
        body: "Every national park shows real warming.",
        myth: { isTrue: false },
        fact: (a) => {
          const c = countReal(a, "tmean_c", "annual");
          return `${c.real} of ${c.total} parks show real warming in average temperature. The rest are too noisy or too ocean-cooled to call.`;
        },
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "big-number-trap",
    title: "The Big Number Trap",
    subtitle: "A huge trend that means nothing, and a smaller one that matters.",
    emoji: "🎭",
    difficulty: "hard",
    badge: "🧠 Skeptic Supreme",
    steps: [
      {
        kind: "intro",
        heading: "Don't trust a big number",
        body: "A headline screams: “RAIN UP 107 MM A DECADE!” Your job is to be the person in the room who says “wait, show me the dots.” Size is not proof.",
      },
      {
        kind: "duel",
        heading: "Who gained the most rain?",
        body: "Glacier Bay (Alaska) or American Samoa: which has the bigger rain trend, up or down?",
        duel: { a: S("glba", "prcp_mm", "annual"), b: S("npsa", "prcp_mm", "annual") },
        fact: (a) => `Glacier Bay ${R(a, "glba", "prcp_mm", "annual")}. American Samoa ${R(a, "npsa", "prcp_mm", "annual")}.`,
      },
      {
        kind: "verdict",
        heading: "Glacier Bay: the big one",
        body: "The slope is huge. Do you trust it?",
        verdictQ: S("glba", "prcp_mm", "annual"),
        fact: "Huge slope, wild years. The test says it could easily be luck.",
      },
      {
        kind: "verdict",
        heading: "American Samoa: the sneaky one",
        body: "The drying slope here is just as big. Do you trust this one?",
        verdictQ: S("npsa", "prcp_mm", "annual"),
        fact: "Same size slope. This time the years line up, so it earns the label.",
      },
      {
        kind: "myth",
        heading: "Myth or fact?",
        body: "A bigger slope always means a more certain trend.",
        myth: { isTrue: false },
        fact: "Certainty depends on how noisy the years are, not on the slope size.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "winter-shrink",
    title: "Winter Is Shrinking",
    subtitle: "Which park has lost the most winter chill?",
    emoji: "❄️",
    difficulty: "medium",
    badge: "⛄ Snow Sentinel",
    steps: [
      {
        kind: "intro",
        heading: "Where did winter go?",
        body: "Ski lodges, snow fleas and tree-killing beetles all depend on one thing: a proper cold winter. Follow the missing chill across the parks.",
      },
      {
        kind: "hunt",
        heading: "Where did the cold go?",
        body: "Which park's winter (Dec–Feb) average temperature is rising fastest?",
        hunt: { parks: ["cong", "olym", "romo", "dena"], variable: "tmean_c", period: "DJF", pick: "max" },
        fact: (a) => `Congaree ${R(a, "cong", "tmean_c", "DJF")}.`,
      },
      {
        kind: "rank",
        heading: "Line them up",
        body: "Rank these four from fastest-warming winter to slowest.",
        rank: { parks: ["acad", "cong", "romo", "olym"], variable: "tmean_c", period: "DJF" },
        fact: "Warm winters are not limited to the south. Even Maine's coast is on the list.",
      },
      {
        kind: "guess",
        heading: "How much?",
        body: "How many °F per decade is Acadia's winter warming?",
        guess: { parkId: "acad", variable: "tmean_c", period: "DJF", min: 0, max: 3, step: 0.05 },
        fact: "Over 45 years that adds up to several degrees.",
      },
      {
        kind: "verdict",
        heading: "Denali's winter",
        body: "Alaska is famous for fast warming. Judge Denali's winters.",
        verdictQ: S("dena", "tmean_c", "DJF"),
        fact: "Alaskan winters swing wildly, so even a clear rise can hide in the noise.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "july-crater",
    title: "July at Crater Lake",
    subtitle: "The challenge author's park, one hot month at a time.",
    emoji: "🌋",
    difficulty: "easy",
    badge: "🏔️ Rim Walker",
    steps: [
      {
        kind: "intro",
        heading: "One month. One lake.",
        body: "Crater Lake is the park where the NASA challenge author filmed his intro. We will zoom in on a single month and see if the warming is louder there.",
      },
      {
        kind: "duel",
        heading: "Rim vs Tetons",
        body: "Crater Lake or Grand Teton: whose July highs are warming faster?",
        duel: { a: S("crla", "tmax_c", "7"), b: S("grte", "tmax_c", "7") },
        fact: (a) => `Crater Lake ${R(a, "crla", "tmax_c", "7")}. Grand Teton ${R(a, "grte", "tmax_c", "7")}.`,
      },
      {
        kind: "guess",
        heading: "How hot?",
        body: "Guess Crater Lake's July warming, in °F per decade.",
        guess: { parkId: "crla", variable: "tmax_c", period: "7", min: 0, max: 3, step: 0.05 },
        fact: (a) => `Compare with the annual average at the same park: ${R(a, "crla", "tmax_c", "annual")}. July runs hotter.`,
      },
      {
        kind: "verdict",
        heading: "Lake Clark in July",
        body: "Now a park in Alaska. Real, maybe, or noise?",
        verdictQ: S("lacl", "tmax_c", "7"),
        fact: "Not every park's summer is on the rise.",
      },
      {
        kind: "interpret",
        heading: "Plan around it",
        body: "July at Crater Lake is hotter than it was. See what a July visit looks like now.",
        parkId: "crla",
        variable: "tmax_c",
        period: "7",
        plannerLink: { month: 7, label: "Plan a July visit to Crater Lake" },
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "yosemite-nights",
    title: "Yosemite After Dark",
    subtitle: "Summer nights in the valley are changing. How much?",
    emoji: "🌲",
    difficulty: "easy",
    badge: "🌲 Valley Watcher",
    steps: [
      {
        kind: "intro",
        heading: "What happens after sunset in Yosemite?",
        body: "Wildfire crews say the danger is the night that does not cool. See how fast Yosemite's summer nights are warming.",
      },
      {
        kind: "guess",
        heading: "Guess the climb",
        body: "How fast are Yosemite's summer night lows rising, in °F per decade?",
        guess: { parkId: "yose", variable: "tmin_c", period: "JJA", min: 0, max: 3, step: 0.05 },
        fact: "The fastest summer-night rise in the whole dataset.",
      },
      {
        kind: "duel",
        heading: "Day vs night in Yosemite",
        body: "Summer: which rises faster, the daytime high or the night-time low?",
        duel: { a: S("yose", "tmax_c", "JJA"), b: S("yose", "tmin_c", "JJA") },
        fact: (a) => `Highs ${R(a, "yose", "tmax_c", "JJA")}. Lows ${R(a, "yose", "tmin_c", "JJA")}.`,
      },
      {
        kind: "verdict",
        heading: "Kobuk Valley's summer nights",
        body: "A far-north park. Real, maybe, or noise?",
        verdictQ: S("kova", "tmin_c", "JJA"),
        fact: "Lows near the Arctic Circle barely moved in summer.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "arctic-sprint",
    title: "Arctic Sprint",
    subtitle: "Alaska is said to warm the fastest. Does the data agree?",
    emoji: "🐻‍❄️",
    difficulty: "hard",
    badge: "🧊 Polar Pro",
    steps: [
      {
        kind: "intro",
        heading: "Race to the top of the world",
        body: "Scientists say the Arctic warms faster than anywhere. Alaska's parks line up at the start. Let's see who is actually fastest, and who is just loud.",
      },
      {
        kind: "hunt",
        heading: "Who tops the annual chart?",
        body: "Across all seasons, which park has the fastest average-temperature rise?",
        hunt: { parks: ["kova", "dena", "glac", "yell"], variable: "tmean_c", period: "annual", pick: "max" },
        fact: (a) => `Kobuk Valley: ${R(a, "kova", "tmean_c", "annual")}. Far north, fast warming.`,
      },
      {
        kind: "duel",
        heading: "Kobuk vs Denali, winter only",
        body: "Whose winter average is rising faster?",
        duel: { a: S("kova", "tmean_c", "DJF"), b: S("dena", "tmean_c", "DJF") },
        fact: (a) => `Kobuk ${R(a, "kova", "tmean_c", "DJF")}. Denali ${R(a, "dena", "tmean_c", "DJF")}.`,
      },
      {
        kind: "verdict",
        heading: "Kobuk's winter: trust it?",
        body: "A large winter slope. Real, maybe, or noise?",
        verdictQ: S("kova", "tmean_c", "DJF"),
        fact: "Big slope, but Arctic winters swing so much that the test holds back. Be a skeptic.",
      },
      {
        kind: "myth",
        heading: "Myth or fact?",
        body: "If a slope is large, the trend is real.",
        myth: { isTrue: false },
        fact: "Large and noisy is a trap. Check the test, not just the number.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "spring-sprint",
    title: "Spring Is Early",
    subtitle: "Cherry blossoms, snowmelt, wildflowers. Spring is on the move.",
    emoji: "🌱",
    difficulty: "medium",
    badge: "🌷 Bloom Tracker",
    steps: [
      {
        kind: "intro",
        heading: "Spring is showing up early",
        body: "Cherry blossoms, snowmelt and wildflowers all run on one clock: spring warming. Race the parks to see where the clock is ticking fastest.",
      },
      {
        kind: "hunt",
        heading: "Fastest spring warmer",
        body: "Which park's spring average temperature climbs fastest?",
        hunt: { parks: ["whsa", "shen", "cave", "gumo"], variable: "tmean_c", period: "MAM", pick: "max" },
        fact: (a) => `Guadalupe Mountains: ${R(a, "gumo", "tmean_c", "MAM")}.`,
      },
      {
        kind: "rank",
        heading: "Rank the spring",
        body: "Order these four from fastest spring warming to slowest.",
        rank: { parks: ["shen", "katm", "thro", "voya"], variable: "tmean_c", period: "MAM" },
        fact: "Northern parks barely changed in spring, while the mountains of the south warmed.",
      },
      {
        kind: "verdict",
        heading: "Voyageurs' spring",
        body: "A northern lake park. Real, maybe, or noise?",
        verdictQ: S("voya", "tmean_c", "MAM"),
        fact: "Spring here is not on a clear path, while the south and west are.",
      },
      {
        kind: "interpret",
        heading: "Plan a bloom visit",
        body: "Earlier spring means earlier blooms. Peek at April in the planner.",
        parkId: "shen",
        variable: "tmean_c",
        period: "MAM",
        plannerLink: { month: 4, label: "Plan an April visit" },
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "climate-olympics",
    title: "The Climate Olympics",
    subtitle: "Five events. Five gold medals. Which park wins each?",
    emoji: "🥇",
    difficulty: "medium",
    badge: "🏆 Gold Medalist",
    steps: [
      {
        kind: "intro",
        heading: "Opening ceremony",
        body: "Welcome to the Games. Parks compete in five events, from night-time heat to disappearing rain. Pick the winner of each. Gold means the biggest change, which is not always good news.",
      },
      {
        kind: "hunt",
        heading: "🌙 Night marathon",
        body: "Who is warming up fastest after dark? (annual night-time low)",
        hunt: { parks: ["indu", "deva", "kova", "jotr"], variable: "tmin_c", period: "annual", pick: "max" },
        fact: (a) => `Joshua Tree takes gold at ${R(a, "jotr", "tmin_c", "annual")}.`,
      },
      {
        kind: "hunt",
        heading: "☀️ Summer high jump",
        body: "Whose summer daytime highs jumped the most?",
        hunt: { parks: ["cave", "deva", "lavo", "pefo"], variable: "tmax_c", period: "JJA", pick: "max" },
        fact: (a) => `Petrified Forest leaps ${R(a, "pefo", "tmax_c", "JJA")}.`,
      },
      {
        kind: "hunt",
        heading: "🐢 The tortoise award",
        body: "Who barely moved? Pick the park with the SLOWEST summer-high warming.",
        hunt: { parks: ["chis", "maca", "havo", "kefj"], variable: "tmax_c", period: "JJA", pick: "min" },
        fact: (a) => `Channel Islands finishes at ${R(a, "chis", "tmax_c", "JJA")}. The ocean keeps it cool.`,
      },
      {
        kind: "hunt",
        heading: "🏜️ The drought slide",
        body: "Which park is losing the most yearly rain?",
        hunt: { parks: ["viis", "npsa", "olym", "drto"], variable: "prcp_mm", period: "annual", pick: "min" },
        fact: (a) => `Virgin Islands slides ${R(a, "viis", "prcp_mm", "annual")}.`,
      },
      {
        kind: "rank",
        heading: "🏅 Medal ceremony",
        body: "Final event. Podium time: rank these parks by how fast their winters are warming.",
        rank: { parks: ["cong", "acad", "romo", "olym"], variable: "tmean_c", period: "DJF" },
        fact: "Gold goes to the warmest winter. Not every medal is a happy one.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "hawaii-twins",
    title: "Hawaiian Twins",
    subtitle: "Two volcanoes, one island chain, different stories.",
    emoji: "🌺",
    difficulty: "medium",
    badge: "🌋 Lava Legend",
    steps: [
      {
        kind: "intro",
        heading: "Two volcanoes, one island chain",
        body: "Haleakalā and Hawaiʻi Volcanoes share an ocean and a state. You would expect twins. The data may disagree.",
      },
      {
        kind: "duel",
        heading: "High temperatures",
        body: "Which volcano's annual high is rising faster?",
        duel: { a: S("hale", "tmax_c", "annual"), b: S("havo", "tmax_c", "annual") },
        fact: (a) => `Haleakalā ${R(a, "hale", "tmax_c", "annual")}. Hawaiʻi Volcanoes ${R(a, "havo", "tmax_c", "annual")}.`,
      },
      {
        kind: "verdict",
        heading: "Haleakalā",
        body: "Judge its yearly highs.",
        verdictQ: S("hale", "tmax_c", "annual"),
        fact: "A small but steady rise passes the test.",
      },
      {
        kind: "verdict",
        heading: "Hawaiʻi Volcanoes",
        body: "Now the neighbour.",
        verdictQ: S("havo", "tmax_c", "annual"),
        fact: "Almost no drift. Same ocean, different story.",
      },
      {
        kind: "myth",
        heading: "Myth or fact?",
        body: "Parks close together always warm at the same pace.",
        myth: { isTrue: false },
        fact: "Winds, elevation and ocean currents can split neighbours apart.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "lightning-round",
    title: "Lightning Round",
    subtitle: "Six duels. No intro. Trust your gut.",
    emoji: "⚡",
    difficulty: "hard",
    badge: "⚡ Quick Draw",
    steps: [
      {
        kind: "intro",
        heading: "Lightning round! ⚡",
        body: "Six duels. No story. No second chances. Your gut and the data are about to find out if they are friends.",
      },
      {
        kind: "duel",
        heading: "1 of 6",
        body: "Annual high: which is warming faster?",
        duel: { a: S("zion", "tmax_c", "annual"), b: S("grca", "tmax_c", "annual") },
        fact: (a) => `Zion ${R(a, "zion", "tmax_c", "annual")}. Grand Canyon ${R(a, "grca", "tmax_c", "annual")}.`,
      },
      {
        kind: "duel",
        heading: "2 of 6",
        body: "Annual high: which is warming faster?",
        duel: { a: S("acad", "tmax_c", "annual"), b: S("yell", "tmax_c", "annual") },
        fact: (a) => `Acadia ${R(a, "acad", "tmax_c", "annual")}. Yellowstone ${R(a, "yell", "tmax_c", "annual")}.`,
      },
      {
        kind: "duel",
        heading: "3 of 6",
        body: "Annual high: which is warming faster?",
        duel: { a: S("sagu", "tmax_c", "annual"), b: S("crla", "tmax_c", "annual") },
        fact: (a) => `Saguaro ${R(a, "sagu", "tmax_c", "annual")}. Crater Lake ${R(a, "crla", "tmax_c", "annual")}.`,
      },
      {
        kind: "duel",
        heading: "4 of 6",
        body: "Summer highs: which is warming faster?",
        duel: { a: S("pefo", "tmax_c", "JJA"), b: S("chis", "tmax_c", "JJA") },
        fact: (a) => `Petrified Forest ${R(a, "pefo", "tmax_c", "JJA")}. Channel Islands ${R(a, "chis", "tmax_c", "JJA")}.`,
      },
      {
        kind: "duel",
        heading: "5 of 6",
        body: "Summer 100°F days: which is gaining faster?",
        duel: { a: S("deva", "hot100_days", "JJA"), b: S("jotr", "hot100_days", "JJA") },
        fact: (a) => `Death Valley ${R(a, "deva", "hot100_days", "JJA")}. Joshua Tree ${R(a, "jotr", "hot100_days", "JJA")}.`,
      },
      {
        kind: "duel",
        heading: "6 of 6",
        body: "Annual lows: which is warming faster?",
        duel: { a: S("indu", "tmin_c", "annual"), b: S("olym", "tmin_c", "annual") },
        fact: (a) => `Indiana Dunes ${R(a, "indu", "tmin_c", "annual")}. Olympic ${R(a, "olym", "tmin_c", "annual")}.`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "real-maybe-noise",
    title: "Real, Maybe, or Noise?",
    subtitle: "Train your eye. Read the dots, then see what the test says.",
    emoji: "🎲",
    difficulty: "medium",
    badge: "👁️ Eagle Eye",
    steps: [
      {
        kind: "intro",
        heading: "Train your detective eyes",
        body: "Real scientists look at dots first and test second. Five charts are coming. Call each one before the trend line shows up.",
      },
      {
        kind: "verdict",
        heading: "Chart 1",
        body: "Death Valley, days above 100°F.",
        verdictQ: S("deva", "hot100_days", "annual"),
        fact: "Dots drift up and to the right: a clear climb.",
      },
      {
        kind: "verdict",
        heading: "Chart 2",
        body: "Channel Islands, annual high.",
        verdictQ: S("chis", "tmax_c", "annual"),
        fact: "Dots scatter evenly: nothing is happening.",
      },
      {
        kind: "verdict",
        heading: "Chart 3",
        body: "Olympic, yearly rain.",
        verdictQ: S("olym", "prcp_mm", "annual"),
        fact: "Rain bounces around a lot, so even a downward lean stays a “maybe”.",
      },
      {
        kind: "verdict",
        heading: "Chart 4",
        body: "Joshua Tree, annual low temperature.",
        verdictQ: S("jotr", "tmin_c", "annual"),
        fact: "A slow, steady rise with small bounce. Easy to trust.",
      },
      {
        kind: "verdict",
        heading: "Chart 5",
        body: "Glacier Bay, yearly rain.",
        verdictQ: S("glba", "prcp_mm", "annual"),
        fact: "A big slope with huge bounce. Do not fall for it.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "chief-detective",
    title: "Chief Detective Exam",
    subtitle: "Everything you learned, in one final case.",
    emoji: "🏅",
    difficulty: "hard",
    badge: "🏅 Chief Detective",
    steps: [
      {
        kind: "intro",
        heading: "The final exam",
        body: "Every game you have played, one after another. Earn three stars and the Chief Detective badge is yours.",
      },
      {
        kind: "hunt",
        heading: "Hunt",
        body: "Which park's annual high is rising the fastest?",
        hunt: { parks: ["cave", "gumo", "pefo", "indu"], variable: "tmax_c", period: "annual", pick: "max" },
        fact: (a) => `Carlsbad Caverns: ${R(a, "cave", "tmax_c", "annual")}.`,
      },
      {
        kind: "rank",
        heading: "Rank",
        body: "Order these by annual night-time low warming.",
        rank: { parks: ["jotr", "deva", "acad", "hale"], variable: "tmin_c", period: "annual" },
        fact: "Desert nights run hot. Islands lag behind.",
      },
      {
        kind: "guess",
        heading: "Guess",
        body: "Joshua Tree's annual night-time low: how fast per decade?",
        guess: { parkId: "jotr", variable: "tmin_c", period: "annual", min: 0, max: 2.5, step: 0.05 },
        fact: "Slow and steady wins the evidence.",
      },
      {
        kind: "verdict",
        heading: "Verdict",
        body: "Virgin Islands, yearly rain.",
        verdictQ: S("viis", "prcp_mm", "annual"),
        fact: "A strong lean, not quite proof.",
      },
      {
        kind: "myth",
        heading: "Myth",
        body: "A trend with a large slope is always real.",
        myth: { isTrue: false },
        fact: "Size is not certainty. You just proved you can tell the difference.",
      },
    ],
  },
];
