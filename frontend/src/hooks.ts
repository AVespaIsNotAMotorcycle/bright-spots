import { useEffect, useState } from "react";

export type Async<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ok"; data: T };

/** Run `fn` whenever `key` changes; ignores stale responses. Pass key=null to stay idle. */
export function useAsync<T>(fn: () => Promise<T>, key: string | null): Async<T> {
  const [state, setState] = useState<Async<T>>({ status: "idle" });
  useEffect(() => {
    if (key === null) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fn()
      .then((data) => !cancelled && setState({ status: "ok", data }))
      .catch((e) => !cancelled && setState({ status: "error", error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
    // fn is recreated each render; `key` captures its inputs.
  }, [key]);
  return state;
}
