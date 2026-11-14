import type { ReactNode } from "react";
import type { Async } from "../hooks";

/** Loading / error / ok switch for one async value. */
export function Status<T>({
  state,
  loading = "Loading…",
  children,
}: {
  state: Async<T>;
  loading?: string;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") return <p className="muted small">{loading}</p>;
  if (state.status === "error") return <p className="error small">{state.error}</p>;
  if (state.status === "ok") return <>{children(state.data)}</>;
  return null;
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="row gap-8 wrap" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          title={o.title}
          className={`chip ${o.value === value ? "active" : ""}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
