// Catches a crash in one part of the page, so the rest keeps working.
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Short name shown in the message, e.g. "This card" or "This page". */
  what?: string;
}

interface State {
  error: Error | null;
}

/** A lazy page file could not be fetched (dev server restarted, or a new build went live). */
const isChunkError = (e: Error | null) =>
  !!e && /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(e.message);

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Canopy: a part of the page crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ border: "1px dashed var(--rust)", borderRadius: 12, padding: 16, background: "var(--rust-tint)", color: "var(--text)" }}>
        <b>{this.props.what ?? "This part"} hit a problem.</b>
        <p className="small muted" style={{ margin: "4px 0 10px" }}>The rest of the app still works. {this.state.error.message}</p>
        {/* A lazy tab that failed to load stays failed until the page reloads. */}
        <button
          className="btn-ghost"
          onClick={() => (isChunkError(this.state.error) ? location.reload() : this.setState({ error: null }))}
        >
          Try again
        </button>
      </div>
    );
  }
}

/** Wrap one card. */
export function Safe({ children, what = "This card" }: { children: ReactNode; what?: string }) {
  return <ErrorBoundary what={what}>{children}</ErrorBoundary>;
}
