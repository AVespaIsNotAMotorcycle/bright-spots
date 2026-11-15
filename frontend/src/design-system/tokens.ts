// The token inventory the sandbox shows and lets you edit. Names mirror :root in styles.css
// (and the proposed --pc-* layer in postcard.css); values are read live, never copied here.

export interface TokenGroup {
  title: string;
  note?: string;
  tokens: { name: string; note?: string }[];
}

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    title: "Core palette",
    tokens: [
      { name: "--pine", note: "deep forest green: primary" },
      { name: "--pine-light", note: "button hover" },
      { name: "--pine-tint", note: "hard-coded rgba of pine" },
      { name: "--pine-band", note: "meter range band" },
      { name: "--on-pine" },
      { name: "--rust", note: "canyon rust: secondary" },
      { name: "--rust-tint" },
      { name: "--on-rust" },
      { name: "--sky", note: "night sky: projected" },
      { name: "--sky-tint" },
    ],
  },
  {
    title: "Neutrals: sandstone",
    tokens: [
      { name: "--bg", note: "page, under topo texture" },
      { name: "--surface", note: "cards, inputs" },
      { name: "--surface-2", note: "hover, segmented track" },
      { name: "--surface-3" },
      { name: "--border" },
      { name: "--grid", note: "meter and slider tracks" },
    ],
  },
  {
    title: "Text",
    tokens: [{ name: "--text" }, { name: "--text-muted" }, { name: "--text-faint" }],
  },
  {
    title: "Semantic aliases",
    note: "Aliases point at palette tokens; edit them to re-route a role.",
    tokens: [
      { name: "--accent" },
      { name: "--accent-2" },
      { name: "--accent-tint" },
      { name: "--accent-band" },
      { name: "--on-accent" },
      { name: "--warning" },
      { name: "--error" },
      { name: "--chart-neutral" },
      { name: "--neutral-ink", note: "defined, not used by any component" },
    ],
  },
  {
    title: "Elevation",
    tokens: [{ name: "--shadow-sm" }, { name: "--shadow-md" }, { name: "--shadow-lg" }],
  },
  {
    title: "Typography",
    note: "Only Playfair Display and Inter are loaded; another family needs a <link> too.",
    tokens: [{ name: "--font-display" }, { name: "--font-body" }],
  },
  {
    title: "Postcard (proposed)",
    note: "New in postcard.css, defaulting to existing tokens.",
    tokens: [
      { name: "--pc-paper" },
      { name: "--pc-ink" },
      { name: "--pc-rule" },
      { name: "--pc-stamp" },
      { name: "--pc-postmark" },
      { name: "--pc-airmail-1" },
      { name: "--pc-airmail-2" },
      { name: "--pc-radius" },
      { name: "--pc-edge" },
      { name: "--pc-shadow" },
      { name: "--font-script" },
    ],
  },
];

/** Colours written straight into components instead of using a token. */
export const OFF_TOKEN: { hex: string; role: string; where: string }[] = [
  { hex: "#d4edda", role: "\"Real\" / easy / correct: badge fill", where: "ExplainerCard, StudentDetective, ParkDetective, ParkDetails" },
  { hex: "#155724", role: "\"Real\" / easy: badge text", where: "ExplainerCard, StudentDetective, ParkDetails" },
  { hex: "#fff3cd", role: "\"Possible\" / medium: badge fill", where: "ExplainerCard, StudentDetective, ParkDetective, ParkDetails" },
  { hex: "#856404", role: "\"Possible\" / medium: badge text", where: "ExplainerCard, StudentDetective, ParkDetails" },
  { hex: "#f8d7da", role: "Hard / wrong answer: fill", where: "StudentDetective" },
  { hex: "#721c24", role: "Hard: badge text", where: "StudentDetective" },
  { hex: "#2a7d4f", role: "\"Real\" dot, correct border (≠ --pine)", where: "Detective, StudentDetective" },
  { hex: "#b8860b", role: "\"Possible\" dot and border", where: "Detective, StudentDetective" },
  { hex: "#b7791f", role: "\"Possible\" in research views (≠ #b8860b)", where: "research/lib.ts, Families" },
  { hex: "#c0392b", role: "Wrong-answer border", where: "StudentDetective" },
  { hex: "#9c3b1b", role: "Rising trend text", where: "Detective" },
  { hex: "#2f5d3a", role: "Falling trend text", where: "Detective" },
  { hex: "#aaaaaa", role: "\"None\" verdict dot", where: "Detective" },
  { hex: "#cccccc", role: "\"Short\"/\"flat\" verdict dot", where: "Detective" },
];
