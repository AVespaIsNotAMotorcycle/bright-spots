// The key a park is saved and drawn under. NPS gives Sequoia and Kings Canyon one code, "seki",
// so Kings Canyon gets "kica"; every other park keeps its NPS code (or its id when it has none).
import { PARK_NAMES } from "./parkNames";

export const parkKey = (p: { id: string; code?: string | null }): string => (p.id === "kings-canyon" ? "kica" : p.code ?? p.id);

/** Names for saved parks: the two California parks are told apart. */
export const SAVED_NAMES: Record<string, string> = { ...PARK_NAMES, seki: "Sequoia", kica: "Kings Canyon" };

/** The trend atlas keeps one record for both parks, under "seki". */
export const trendCode = (key: string): string => (key === "kica" ? "seki" : key);
