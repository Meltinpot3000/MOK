import type {
  ExecutableSemanticMap,
  SemanticEvidenceRequirement,
  SemanticMapQuestionResolution,
} from "../types";

/**
 * Leitet Evidence-Anforderungen aus der Question-Resolution ab (für späteren Answer-Verifier).
 * Keine Sentinel-Orchestrator-Integration im MVP.
 */
export function deriveEvidenceRequirementsFromResolution(input: {
  resolution: SemanticMapQuestionResolution;
  map: ExecutableSemanticMap;
}): SemanticEvidenceRequirement[] {
  const placeByKey = new Map(input.map.places.map((p) => [p.placeKey, p]));
  const out: SemanticEvidenceRequirement[] = [];

  for (const ev of input.resolution.requiredEvidence) {
    const place = placeByKey.get(ev.placeKey);
    const verified = place?.validationStatus === "verified";
    out.push({
      placeKey: ev.placeKey,
      minObjects: ev.minObjects,
      reason: ev.reason,
      severity: verified ? "hard" : "soft",
    });
  }

  for (const rp of input.resolution.relevantPlaces) {
    if (out.some((x) => x.placeKey === rp.placeKey)) continue;
    const place = placeByKey.get(rp.placeKey);
    if (!place) continue;
    out.push({
      placeKey: rp.placeKey,
      minObjects: 1,
      reason: rp.reasoningSummary,
      severity: place.validationStatus === "verified" ? "hard" : "soft",
    });
  }

  return out;
}
