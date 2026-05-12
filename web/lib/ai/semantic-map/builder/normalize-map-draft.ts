import type { SemanticMapDraft, SemanticMapPlaceDraft, SemanticMapRoadDraft } from "../types";

function slugKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

export function normalizeMapDraft(draft: SemanticMapDraft): SemanticMapDraft {
  const placeByKey = new Map<string, SemanticMapPlaceDraft>();
  for (const p of draft.places) {
    const key = slugKey(p.placeKey);
    if (!key) continue;
    const merged: SemanticMapPlaceDraft = {
      ...p,
      placeKey: key,
      evidence: Array.isArray(p.evidence) ? [...p.evidence] : [],
    };
    placeByKey.set(key, merged);
  }

  const roadByKey = new Map<string, SemanticMapRoadDraft>();
  for (const r of draft.roads) {
    const rk = slugKey(r.roadKey);
    const from = slugKey(r.fromPlaceKey);
    const to = slugKey(r.toPlaceKey);
    if (!rk || !from || !to) continue;
    const merged: SemanticMapRoadDraft = {
      ...r,
      roadKey: rk,
      fromPlaceKey: from,
      toPlaceKey: to,
      evidence: Array.isArray(r.evidence) ? [...r.evidence] : [],
    };
    roadByKey.set(rk, merged);
  }

  return {
    places: [...placeByKey.values()],
    roads: [...roadByKey.values()],
    suggestedQuestions: draft.suggestedQuestions.map((q) => ({
      ...q,
      relatedPlaceKeys: q.relatedPlaceKeys?.map(slugKey).filter(Boolean),
    })),
    gaps: draft.gaps.map((g) => ({
      ...g,
      relatedPlaceKeys: g.relatedPlaceKeys?.map(slugKey).filter(Boolean),
    })),
  };
}
