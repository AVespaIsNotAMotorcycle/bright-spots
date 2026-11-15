// Park passport: solving a case stamps every park that case studies.
import type { Case } from "./cases";
import { CASES } from "./cases";

/** Parks a case studies, most-used first. */
export function caseParks(c: Case): string[] {
  const count = new Map<string, number>();
  const add = (id: string | undefined) => id && count.set(id, (count.get(id) ?? 0) + 1);
  for (const s of c.steps) {
    add(s.parkId);
    add(s.guess?.parkId);
    add(s.verdictQ?.parkId);
    add(s.duel?.a.parkId);
    add(s.duel?.b.parkId);
    s.hunt?.parks.forEach(add);
    s.rank?.parks.forEach(add);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** The park a case is mostly about (used for "Plan a trip here"). */
export const mainPark = (c: Case): string | undefined => caseParks(c)[0];

/** Park id -> ids of solved cases that stamp it. */
export function stamps(solved: Record<string, unknown>, cases: Case[] = CASES): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of cases) {
    if (!solved[c.id]) continue;
    for (const p of caseParks(c)) out.set(p, [...(out.get(p) ?? []), c.id]);
  }
  return out;
}

/** Park id -> every case that would stamp it (solved or not). */
export function casesByPark(cases: Case[] = CASES): Map<string, Case[]> {
  const out = new Map<string, Case[]>();
  for (const c of cases) for (const p of caseParks(c)) out.set(p, [...(out.get(p) ?? []), c]);
  return out;
}

/** An unsolved case that stamps this park, or else a solved one. */
export function caseForPark(park: string, solved: Record<string, unknown>, cases: Case[] = CASES): Case | undefined {
  const list = casesByPark(cases).get(park) ?? [];
  return list.find((c) => !solved[c.id]) ?? list[0];
}
