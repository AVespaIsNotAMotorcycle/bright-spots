import { beforeEach, describe, expect, it } from "vitest";
import { dayStreak, touchToday } from "./games";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
  } as Storage;
});

const day = (n: number) => new Date(2026, 10, 10 + n, 12);

describe("day streak", () => {
  it("counts consecutive days and counts a day once", () => {
    touchToday(day(0));
    touchToday(day(0));
    touchToday(day(1));
    touchToday(day(2));
    expect(dayStreak(day(2))).toBe(3);
  });

  it("is still alive the next morning, gone after a missed day", () => {
    touchToday(day(0));
    expect(dayStreak(day(1))).toBe(1);
    expect(dayStreak(day(2))).toBe(0);
  });

  it("restarts at 1 after a gap", () => {
    touchToday(day(0));
    touchToday(day(3));
    expect(dayStreak(day(3))).toBe(1);
  });
});
