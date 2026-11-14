import type { LandCover } from "../../api";
import type { Async } from "../../hooks";

export interface LandcoverPick {
  lc: LandCover;
  /** Why the bundled CCI maps are shown, or null when ORNL MCD12Q1 answered. */
  note: string | null;
}

const complete = (lc: LandCover) => lc.first !== null && lc.latest !== null;

/**
 * Show bundled ESA CCI / C3S land cover as soon as it arrives (milliseconds), and
 * swap in ORNL MCD12Q1 once it answers with both years (spec 5.1, 5.7).
 */
export function pickLandcover(cci: Async<LandCover>, ornl: Async<LandCover>): Async<LandcoverPick> {
  if (ornl.status === "ok" && complete(ornl.data)) return { status: "ok", data: { lc: ornl.data, note: null } };

  if (cci.status === "ok") {
    const note =
      ornl.status === "error"
        ? "ORNL did not answer, so this uses the bundled ESA CCI / C3S 300 m maps."
        : ornl.status === "ok"
          ? "ORNL has no MCD12Q1 data here, so this uses the bundled ESA CCI / C3S 300 m maps."
          : "Bundled ESA CCI / C3S 300 m maps. Checking ORNL MCD12Q1, which replaces this if it answers.";
    return { status: "ok", data: { lc: cci.data, note } };
  }

  if (cci.status === "error") {
    if (ornl.status === "ok") return { status: "ok", data: { lc: ornl.data, note: null } };
    if (ornl.status === "error") return { status: "error", error: `${ornl.error}; CCI fallback: ${cci.error}` };
    return ornl.status === "loading" ? { status: "loading" } : { status: "error", error: cci.error };
  }

  if (cci.status === "idle" && ornl.status === "idle") return { status: "idle" };
  return { status: "loading" };
}
