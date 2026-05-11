import type { AiContextObject } from "@/lib/ai/types";

export type ContextRankingOptions = {
  maxObjects: number;
  /** Optionaler Boost fuer Objekte, deren objectType im Plan explizit genannt wurde. */
  preferredObjectTypes?: ReadonlyArray<string>;
};

/**
 * Deterministisches Ranking + Cut-off auf `maxObjects`.
 * Reine Pure-Function (testbar).
 */
export function rankAndCapContextObjects(
  objects: AiContextObject[],
  options: ContextRankingOptions
): AiContextObject[] {
  const preferred = new Set(options.preferredObjectTypes ?? []);
  const sortable = objects.map((obj) => ({
    obj,
    sortKey: scoreFor(obj, preferred),
  }));
  sortable.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return b.sortKey - a.sortKey;
    return (a.obj.title ?? "").localeCompare(b.obj.title ?? "");
  });
  return sortable.slice(0, options.maxObjects).map((entry) => entry.obj);
}

function scoreFor(obj: AiContextObject, preferred: Set<string>): number {
  const base = Math.max(0, Math.min(1, obj.relevanceScore));
  const typeBoost = preferred.has(obj.objectType) ? 0.15 : 0;
  const classificationPenalty =
    obj.classification === "restricted" ? 0.4 : obj.classification === "confidential" ? 0.1 : 0;
  return base + typeBoost - classificationPenalty;
}
