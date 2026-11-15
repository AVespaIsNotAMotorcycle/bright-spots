// Guided detective cases for students (a story case first, then interactive games).
// Each case is a sequence of steps: predict → examine → analyze → interpret.

export type StepKind =
  | "intro"       // set the scene
  | "predict"     // student makes a prediction before seeing data
  | "examine"     // show the time-series chart
  | "analyze"     // show the MK verdict + numbers
  | "interpret"   // so what? link to planner
  // Interactive games. Answers are computed from the live atlas.
  | "duel"        // two parks/variables head to head: which moves faster?
  | "hunt"        // pick the winner from a line-up
  | "guess"       // slide to estimate a number
  | "verdict"     // look at the dots: real, maybe, or noise?
  | "rank"        // tap parks in order
  | "myth";       // true or false

export interface Side { parkId: string; variable: string; period: string }

export interface Step {
  kind: StepKind;
  heading: string;
  body: string;             // plain English, no jargon
  /** Game config (one per game kind) */
  duel?: { a: Side; b: Side; pick?: "faster" | "slower" };
  hunt?: { parks: string[]; variable: string; period: string; pick: "max" | "min" };
  guess?: { parkId: string; variable: string; period: string; min: number; max: number; step: number };
  verdictQ?: Side & { parkId: string };
  rank?: { parks: string[]; variable: string; period: string };
  myth?: { isTrue: boolean };
  /** Text shown after the answer. May read live atlas numbers. */
  fact?: string | ((a: import("./model").Atlas) => string);
  /** For predict steps: the choices the student picks from */
  choices?: { label: string; correct: boolean; explanation: string }[];
  /** For examine/analyze: which park + variable + period to show */
  parkId?: string;
  variable?: string;
  period?: string;
  /** For interpret: a link to the planner with a pre-set month */
  plannerLink?: { month: number; label: string };
}

export interface Case {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  difficulty: "easy" | "medium" | "hard";
  /** Badge name awarded at the end */
  badge?: string;
  steps: Step[];
}

const CORE_CASES: Case[] = [
  {
    id: "crater-lake-warming",
    title: "Is Crater Lake warming?",
    subtitle: "The challenge author stood here. Let's find out what the data says.",
    emoji: "🌋",
    difficulty: "easy",
    steps: [
      {
        kind: "intro",
        heading: "Welcome to Crater Lake, Oregon",
        body:
          "Crater Lake sits in the caldera of a volcano that exploded 7,700 years ago. " +
          "Its water is so clear it looks like the Pacific Ocean — the NASA Space Apps " +
          "challenge author literally filmed his intro video here. " +
          "Your job: figure out whether the temperature around the park is trending up, down, or not at all.",
      },
      {
        kind: "predict",
        heading: "Before you look at the data — make a guess",
        body: "Annual average high temperature at Crater Lake from 1981 to 2026 is…",
        choices: [
          {
            label: "Trending up (warming)",
            correct: true,
            explanation:
              "Correct. The data shows Crater Lake's annual high is rising at +0.69°F per decade " +
              "(q = 0.041, real after FDR correction). Over 45 years that is about +3°F total.",
          },
          {
            label: "Trending down (cooling)",
            correct: false,
            explanation:
              "Not quite. The data shows a warming signal, not a cooling one. " +
              "Western parks have warmed more than the global average.",
          },
          {
            label: "No clear trend",
            correct: false,
            explanation:
              "Close — the trend is real but modest. The statistical test says " +
              "it clears the significance bar after correcting for multiple tests (q < 0.05).",
          },
        ],
      },
      {
        kind: "examine",
        heading: "Now look at 45 years of data",
        body:
          "Each dot is one year's average daily high temperature at Crater Lake. " +
          "The dashed line is the Sen's slope — a trend line that is not fooled by outlier years. " +
          "The dashed horizontal line is the long-run average.",
        parkId: "crla",
        variable: "tmax_c",
        period: "annual",
      },
      {
        kind: "analyze",
        heading: "What does the statistical test say?",
        body:
          "The Mann-Kendall test asks: does the data consistently rank later years higher than earlier ones? " +
          "A p-value under 0.05 means the pattern is unlikely to be random. " +
          "Because we ran this test on 63 parks at once, we also apply a false-discovery-rate correction " +
          "(Benjamini-Hochberg) — that is what the q-value is. " +
          "Only trends with q < 0.05 earn the 'Real, not luck' verdict.",
        parkId: "crla",
        variable: "tmax_c",
        period: "annual",
      },
      {
        kind: "interpret",
        heading: "So what does this mean for a visit?",
        body:
          "Crater Lake's snow season is shifting. Peak snowmelt — when waterfalls run fullest — " +
          "has moved about two weeks earlier over the last 30 years. " +
          "The best wildflower weeks are moving earlier too. " +
          "If you plan a June visit expecting 2000-era conditions, you may be two weeks late.",
        parkId: "crla",
        variable: "tmax_c",
        period: "annual",
        plannerLink: { month: 6, label: "Plan a June visit to Crater Lake" },
      },
    ],
  },
];

import { MORE_CASES } from "./moreCases";
export const CASES: Case[] = [...CORE_CASES, ...MORE_CASES];
