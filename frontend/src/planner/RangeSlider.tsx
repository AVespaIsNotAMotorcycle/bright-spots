/**
 * Two-thumb range slider built from two overlaid native range inputs, so keyboard
 * and screen-reader support come from the browser. Thumbs cannot cross.
 */
export default function RangeSlider({
  min,
  max,
  step = 1,
  low,
  high,
  onChange,
  labelLow,
  labelHigh,
  format = String,
}: {
  min: number;
  max: number;
  step?: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  labelLow: string;
  labelHigh: string;
  format?: (v: number) => string;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const lo = Math.max(min, Math.min(low, max));
  const hi = Math.max(min, Math.min(high, max));
  return (
    <div className="range2">
      <div className="range2-values num">
        <span>{format(lo)}</span>
        <span className="muted">to</span>
        <span>{format(hi)}</span>
      </div>
      <div className="range2-track">
        <div className="range2-fill" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={labelLow}
          aria-valuetext={format(lo)}
          onChange={(e) => onChange(Math.min(Number(e.target.value), hi), hi)}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={labelHigh}
          aria-valuetext={format(hi)}
          onChange={(e) => onChange(lo, Math.max(Number(e.target.value), lo))}
        />
      </div>
      <div className="range2-scale micro muted num">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
