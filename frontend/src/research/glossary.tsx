// ⓘ hover tips with plain definitions of the statistics and NASA POWER variables.
// No app imports, so any page can use it without import loops.
import { useState } from "react";
import { createPortal } from "react-dom";

// ---------- ⓘ hover tips ----------

export const GLOSSARY: Record<string, string> = {
  sen: "Sen's slope: the typical change per 10 years. It is the middle value of the slopes between every pair of years, so one odd year cannot pull it much.",
  p: "p: the chance of seeing a trend this strong if there were really none. Mann-Kendall test; the Hamed-Rao version is used when one year's value follows the last.",
  q: "q: the p-value after the false discovery rate (FDR) check across all parks for this measure and period. Testing ~63 parks at once makes a few look real by luck; q corrects for that.",
  confirmed: "Confirmed: q < 0.05. The trend passes the test even after correcting for testing many parks.",
  possible: "Possible: p < 0.05 but q ≥ 0.05. It passes for one park alone, but not after the many-parks correction.",
  sn: "Signal-to-noise (S/N): change per 10 years divided by the year-to-year scatter around the trend line (standard deviation of the leftovers). Above 1 means the trend is large next to the wobble.",
  lag1: "Lag-1 autocorrelation: how much each year's value follows the year before. High values make plain tests too confident, so we switch to Hamed-Rao.",
  fdr: "False discovery rate (Benjamini-Hochberg): a correction for running many tests at once, so chance results are not counted as finds.",
  twin: "Twin score: cosine similarity of two parks' trend fingerprints (every measure, year and seasons, scaled across parks). +1 identical, 0 unrelated, −1 opposite.",
  tmax: "Average daily high: NASA POWER air temperature 2 m above the ground, daily maximum, averaged over the period.",
  tmin: "Average daily low: NASA POWER air temperature 2 m above the ground, daily minimum, averaged over the period.",
  tmean: "Average temperature: NASA POWER daily mean air temperature 2 m above the ground.",
  hot: "Hot days: the count of days whose daily high passed 90°F (32.2°C) or 100°F (37.8°C).",
  prcp: "Precipitation: NASA POWER bias-corrected rain and snow (as water), summed over the period, in mm.",
  seasons: "Seasons: DJF = Dec-Feb (winter; December counts toward the next year), MAM = spring, JJA = summer, SON = autumn.",
  grid: "NASA POWER is a grid about 50 km wide. Each park uses one grid point, so mountain parks show the average of the cell, not one peak.",
};

/** Which tip goes with an atlas variable key. */
export const VAR_TIP: Record<string, string> = {
  tmax_c: "tmax", tmin_c: "tmin", tmean_c: "tmean", hot90_days: "hot", hot100_days: "hot", prcp_mm: "prcp",
};

/** A small ⓘ that shows a definition on hover or keyboard focus. */
export function Tip({ term, text }: { term?: keyof typeof GLOSSARY | string; text?: string }) {
  const body = text ?? (term ? GLOSSARY[term] : "");
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null);
  if (!body) return null;
  // Drawn in a portal at fixed position, so cards with overflow: hidden do not clip it.
  const show = (e: React.SyntheticEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 140), window.innerWidth - 140);
    setAt({ x, y: r.top < 140 ? r.bottom : r.top, below: r.top < 140 });
  };
  return (
    <span className="st-tip" tabIndex={0} role="note" aria-label={body}
      style={{ marginLeft: 4, cursor: "help", color: "#6b7f3a", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}
      onMouseEnter={show} onFocus={show} onMouseLeave={() => setAt(null)} onBlur={() => setAt(null)}>
      ⓘ
      {at && createPortal(
        <span role="tooltip" style={{
          position: "fixed", left: at.x, top: at.below ? at.y + 8 : at.y - 8, zIndex: 2000,
          transform: at.below ? "translateX(-50%)" : "translate(-50%, -100%)",
          width: 260, padding: "9px 11px", borderRadius: 8, background: "#4a3726", color: "#f7f1e3",
          font: "400 12px/1.45 var(--font-body)", textAlign: "left", whiteSpace: "normal", textTransform: "none", letterSpacing: 0,
          boxShadow: "0 6px 18px rgba(38,30,20,.3)", pointerEvents: "none",
        }}>
          {body}
        </span>,
        document.body,
      )}
    </span>
  );
}

