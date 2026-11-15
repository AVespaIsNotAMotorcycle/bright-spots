// Canopy logo: a leaf with a trend line, plus a green wordmark.
export const TAGLINE = "Go when the park is at its best.";

export function LeafMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M24 4C10 14 8 30 24 44C40 30 38 14 24 4z" fill="#5B6B3A" />
      <polyline points="15,32 21,26 26,29 33,18" fill="none" stroke="#F4EFE6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Deep forest to light sage, left to right. The fallback colour shows where background-clip:text is missing.
const WORD_GRADIENT = "linear-gradient(90deg, #2F3D24 0%, #3F5230 20%, #5B6B3A 40%, #6F7F4A 60%, #8A9A62 80%, #A9B39A 100%)";

export default function Logo({ size = 28, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.3) }}>
      <LeafMark size={size} />
      {withWord && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: Math.round(size * 0.85),
            lineHeight: 1,
            color: "#5B6B3A",
            backgroundImage: WORD_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Canopy
        </span>
      )}
    </span>
  );
}
