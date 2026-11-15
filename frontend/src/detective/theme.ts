// Earth palette and SVG backgrounds shared by Student and Researcher cards.
// Earth palette used by these cards.
export const E = {
  pine: "#5B6B3A",
  moss: "#5B6B3A",
  sage: "#A9B39A",
  sand: "#F4EFE6",
  clay: "#B5643C",
  rust: "#B5643C",
  bark: "#3B2F25",
  dusk: "#4F6A7A",
  cream: "#FBF8F2",
};

/** Words for a run of right answers, shown on the quiz card. */
export function trailWord(n: number): string {
  if (n >= 7) return "Park Legend!";
  if (n >= 5) return "Summit reached!";
  if (n >= 3) return "On the ridge!";
  return "Trail blazing!";
}

/** Little row of trees, one per right answer in a row (max 7). */
export const trees = (n: number) => "🌲".repeat(Math.min(n, 7));

// Mountain ridge silhouette for card backgrounds. Two layers, pine and moss.
export const RIDGE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 120' preserveAspectRatio='none'>
    <path d='M0 120 L0 70 L60 40 L110 66 L170 22 L230 62 L290 34 L350 70 L420 18 L480 58 L540 36 L600 60 L600 120Z' fill='${E.moss}' opacity='.35'/>
    <path d='M0 120 L0 92 L50 74 L100 94 L160 64 L220 90 L280 70 L340 96 L400 66 L470 92 L530 72 L600 88 L600 120Z' fill='${E.pine}' opacity='.45'/>
  </svg>`,
)}")`;

// Faint topographic contour lines.
export const TOPO = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220' fill='none' stroke='${E.bark}' stroke-opacity='.10' stroke-width='1.2'>
    <ellipse cx='110' cy='110' rx='100' ry='70'/><ellipse cx='110' cy='110' rx='76' ry='52'/>
    <ellipse cx='110' cy='110' rx='52' ry='34'/><ellipse cx='110' cy='110' rx='28' ry='17'/>
  </svg>`,
)}")`;

