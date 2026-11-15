// Lightweight hook: fetch the annual tmax trend for one park to show as a badge.
import { useEffect, useState } from "react";

export interface TrendBadge {
  slope_f: number;      // Sen's slope °F/decade
  verdict: "real" | "possible" | "none" | "short" | "flat";
}

const cache: Record<string, TrendBadge | null> = {};
const pending: Record<string, Promise<TrendBadge | null>> = {};

async function fetchBadge(parkCode: string): Promise<TrendBadge | null> {
  // planner uses park.code (e.g. "acad"), detective uses park_id (same value)
  try {
    const r = await fetch(`/api/trends/parks/${parkCode}`);
    if (!r.ok) return null;
    const d = await r.json();
    const annual = (d.trends as { variable: string; period: string; sen_per_decade_f: number | null; verdict: string }[])
      .find((t) => t.variable === "tmax_c" && t.period === "annual");
    if (!annual) return null;
    return {
      slope_f: annual.sen_per_decade_f ?? (annual as unknown as Record<string, number>)["sen_per_decade"] * 1.8,
      verdict: annual.verdict as TrendBadge["verdict"],
    };
  } catch {
    return null;
  }
}

export function useParkTrendBadge(parkCode: string | null | undefined): TrendBadge | null {
  const [badge, setBadge] = useState<TrendBadge | null | undefined>(
    parkCode ? cache[parkCode] : undefined,
  );

  useEffect(() => {
    if (!parkCode) return;
    if (parkCode in cache) {
      setBadge(cache[parkCode]);
      return;
    }
    if (!pending[parkCode]) {
      pending[parkCode] = fetchBadge(parkCode).then((b) => {
        cache[parkCode] = b;
        return b;
      });
    }
    let live = true;
    pending[parkCode].then((b) => { if (live) setBadge(b); });
    return () => { live = false; };
  }, [parkCode]);

  return badge ?? null;
}
