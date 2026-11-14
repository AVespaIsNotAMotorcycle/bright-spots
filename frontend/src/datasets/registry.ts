import type { ComponentType } from "react";
import type { DatasetInfo, Place } from "../api";
import GibsPanel from "./gibs/GibsPanel";
import GracePanel from "./grace/GracePanel";
import GsomPanel from "./gsom/GsomPanel";
import KoppenPanel from "./koppen/KoppenPanel";
import ModisPanel from "./modis/ModisPanel";
import PowerPanel from "./power/PowerPanel";

export type PanelProps = { dataset: DatasetInfo; place: Place };

/**
 * Frontend panels keyed by backend dataset id (see GET /api/datasets).
 * To add a dataset: add it to the backend DATASETS list, write a panel, register it here.
 */
export const PANELS: Record<string, ComponentType<PanelProps>> = {
  power: PowerPanel,
  modis: ModisPanel,
  grace: GracePanel,
  koppen: KoppenPanel,
  gibs: GibsPanel,
  gsom: GsomPanel,
};
