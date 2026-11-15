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

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Park Trend Detective: a part of the page crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ border: "1px dashed var(--rust)", borderRadius: 12, padding: 16, background: "var(--rust-tint)", color: "var(--text)" }}>
        <b>🍂 {this.props.what ?? "This part"} hit a problem.</b>
        <p className="small muted" style={{ margin: "4px 0 10px" }}>The rest of the app still works. {this.state.error.message}</p>
        <button className="btn-ghost" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}

/** Wrap one card. */
export function Safe({ children, what = "This card" }: { children: ReactNode; what?: string }) {
  return <ErrorBoundary what={what}>{children}</ErrorBoundary>;
}
