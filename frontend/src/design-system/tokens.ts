// The token inventory the sandbox shows and lets you edit. Names mirror :root in styles.css
// (and the proposed --pc-* layer in postcard.css); values are read live, never copied here.

export interface TokenGroup {
  title: string;
  note?: string;
  /** Not a colour group: the editor shows a text field only and the Colour section skips it. */
  nonColour?: boolean;
  tokens: { name: string; note?: string }[];
}

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    title: "Pine: primary",
    note: "Actions and links. Base pine is 4.38:1 on white, so text uses --pine-ink.",
    tokens: [
      { name: "--pine", note: "button fill, meter dot, chart: measured" },
      { name: "--pine-hover", note: "button hover · 5.37:1" },
      { name: "--pine-press", note: "button active · 6.47:1" },
      { name: "--pine-ink", note: "links, titles, small text" },
      { name: "--pine-tint", note: "success fill" },
      { name: "--pine-band", note: "meter range band" },
      { name: "--on-pine" },
    ],
  },
  {
    title: "Glacier lake: secondary",
    note: "Selected states and info. Base glacier is 3.28:1 on white: borders and fills only.",
    tokens: [
      { name: "--glacier", note: "selected borders, chart: forecast" },
      { name: "--glacier-ink", note: "selected text, filled nav/segment · 5.79:1" },
      { name: "--glacier-tint", note: "selected and info fill" },
      { name: "--glacier-band" },
      { name: "--on-glacier", note: "on --glacier-ink only" },
    ],
  },
  {
    title: "Sunset: accent",
    note: "Sparingly: the topbar rule, warming trends, chart: projected.",
    tokens: [
      { name: "--sunset", note: "2.84:1 on white: never text" },
      { name: "--sunset-ink", note: "rising trends, projected stamp · 5.18:1" },
      { name: "--sunset-tint" },
    ],
  },
  {
    title: "Status",
    note: "Verdicts, difficulty and answer feedback. Success is pine.",
    tokens: [
      { name: "--success" }, { name: "--success-ink" }, { name: "--success-tint" },
      { name: "--caution", note: "possible: dots, borders" }, { name: "--caution-ink", note: "5.78:1" }, { name: "--caution-tint" },
      { name: "--danger", note: "5.51:1" }, { name: "--danger-ink", note: "6.54:1" }, { name: "--danger-tint" },
    ],
  },
  {
    title: "Neutrals: card stock on sand",
    tokens: [
      { name: "--bg", note: "page, under topo texture" },
      { name: "--surface", note: "cards, inputs: pure white" },
      { name: "--surface-2", note: "hover, segmented track" },
      { name: "--surface-3", note: "disabled fill" },
      { name: "--border", note: "dividers, hairlines" },
      { name: "--border-strong", note: "control outlines" },
      { name: "--grid", note: "meter and slider tracks" },
    ],
  },
  {
    title: "Text",
    tokens: [
      { name: "--text", note: "deep charcoal" },
      { name: "--text-muted", note: "secondary" },
      { name: "--text-faint", note: "labels, placeholders · 4.22:1" },
    ],
  },
  {
    title: "Semantic aliases",
    note: "Aliases point at palette tokens; edit them to re-route a role.",
    tokens: [
      { name: "--accent" },
      { name: "--accent-2" },
      { name: "--accent-tint" },
      { name: "--on-accent" },
      { name: "--selected" },
      { name: "--selected-ink" },
      { name: "--selected-tint" },
      { name: "--info" },
      { name: "--info-tint" },
      { name: "--rising" },
      { name: "--falling" },
      { name: "--warning" },
      { name: "--error" },
      { name: "--chart-neutral" },
    ],
  },
  {
    title: "Shape",
    nonColour: true,
    note: "2px everywhere. Round only for points and handles (meter dot, slider thumbs).",
    tokens: [{ name: "--radius" }, { name: "--radius-round" }],
  },
  {
    title: "Spacing",
    nonColour: true,
    note: "rem steps; 1rem = 16px.",
    tokens: [
      { name: "--space-0-25" }, { name: "--space-0-5" }, { name: "--space-1" }, { name: "--space-2" },
      { name: "--space-3" }, { name: "--space-4" }, { name: "--space-6" }, { name: "--space-8" }, { name: "--space-10" },
    ],
  },
  {
    title: "Elevation",
    nonColour: true,
    tokens: [{ name: "--shadow-sm" }, { name: "--shadow-md" }, { name: "--shadow-lg" }],
  },
  {
    title: "Typography",
    nonColour: true,
    note: "Only Alfa Slab One and Shantell Sans are loaded; another family needs a <link> too.",
    tokens: [{ name: "--font-display" }, { name: "--font-body" }],
  },
  {
    title: "Postcard (proposed)",
    note: "New in postcard.css, defaulting to existing tokens.",
    tokens: [
      { name: "--pc-paper" },
      { name: "--pc-ink" },
      { name: "--pc-rule" },
      { name: "--pc-radius", note: "0: paper corners" },
      { name: "--pc-edge", note: "white border; 1rem when stacked" },
      { name: "--pc-shadow" },
    ],
  },
];

/** Spacing steps shown in the sandbox, in rem. */
export const SPACE_STEPS = ["0-25", "0-5", "1", "2", "3", "4", "6", "8", "10"] as const;
