import type { ComponentType } from "react";
import type { DatasetInfo } from "../api";
import GsomPanel from "./gsom/GsomPanel";

/**
 * Frontend panels keyed by backend dataset id (see GET /api/datasets).
 * To add a dataset: add it to the backend DATASETS list, write a panel, register it here.
 */
export const PANELS: Record<string, ComponentType<{ dataset: DatasetInfo }>> = {
  gsom: GsomPanel,
};
