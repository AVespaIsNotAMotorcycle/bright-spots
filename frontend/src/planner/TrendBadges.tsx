import { VERDICT_LABEL, fmtNum, perDecade, type Atlas } from "../atlas/model";

const MONTH_IDS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const BADGE_VARS = ["tmax", "precip"] as const;

/**
 * Trend badges for a park in the travel month (SPEC: trip match shows trend
 * badges): the atlas daytime-high and rain trends, shown only when they are
 * "real" or "possible".
 */
export default function TrendBadges({
  atlas,
  parkId,
  month,
  fahrenheit,
}: {
  atlas: Atlas | null;
  parkId: string;
  month: number;
  fahrenheit: boolean;
}) {
  if (!atlas) return null;
  const i = atlas.parks.findIndex((p) => p.id === parkId);
  if (i < 0) return null;
  const period = MONTH_IDS[month - 1];
  const badges = BADGE_VARS.map((v) => ({ v, meta: atlas.variables[v], cell: atlas.cells[v]?.[period]?.[i] })).filter(
    (b) => b.cell && b.meta && (b.cell.verdict === "real" || b.cell.verdict === "possible") && b.cell.sen_per_decade != null,
  );
  if (badges.length === 0) return null;
  return (
    <span className="trend-badges">
      {badges.map(({ v, meta, cell }) => {
        const s = perDecade(cell!.sen_per_decade!, v, meta!, fahrenheit);
        const arrow = cell!.direction === "up" ? "▲" : "▼";
        const name = v === "tmax" ? "Daytime high" : "Rain";
        return (
          <span
            key={v}
            className={`trend-badge trend-${cell!.verdict} trend-${cell!.direction}`}
            title={`${meta!.name}, ${period}: ${VERDICT_LABEL[cell!.verdict]} (${cell!.first_year}–${cell!.last_year}, q = ${cell!.q})`}
          >
            {arrow} {name} {s.value > 0 ? "+" : ""}
            {fmtNum(s.value)} {s.unit}/decade{cell!.verdict === "possible" ? "?" : ""}
          </span>
        );
      })}
    </span>
  );
}
