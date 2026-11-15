// Guided detective cases for students (a story case first, then interactive games).
// Each case is a sequence of steps: predict → examine → analyze → interpret.

export type StepKind =
  | "intro"       // set the scene
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

import { MORE_CASES } from "./moreCases";
export const CASES: Case[] = MORE_CASES;
