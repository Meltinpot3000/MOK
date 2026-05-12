import { SEMANTIC_MAP_BLOCKED_CLAIMS } from "../types";
import type {
  EvaluateSemanticEvidenceCoverageInput,
  SemanticEvidenceCoverageResult,
  SemanticEvidenceRequirement,
  SemanticUsedSource,
} from "../types";

const SLOT = {
  strategy_challenge: "strategy_challenge",
  initiative: "initiative",
  current_cycle: "current_cycle",
} as const;

type EvidenceSlot = (typeof SLOT)[keyof typeof SLOT];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Leitet aus placeKey fachliche Evidence-Slots ab (kein Keyword-Matching der Userfrage). */
export function placeKeyToEvidenceSlots(placeKey: string): EvidenceSlot[] {
  const k = norm(placeKey);
  const out = new Set<EvidenceSlot>();
  if (k.includes("challenge")) out.add(SLOT.strategy_challenge);
  if (k.includes("initiative")) out.add(SLOT.initiative);
  if (k.includes("cycle") || k.startsWith("okr.") && k.includes("cycle")) out.add(SLOT.current_cycle);
  if (out.size === 0 && k.includes("okr")) out.add(SLOT.current_cycle);
  return [...out];
}

function slotsFromUsedSource(src: SemanticUsedSource): Set<EvidenceSlot> {
  const out = new Set<EvidenceSlot>();
  const ref = norm(src.sourceRef);

  if (src.sourceType === "tool") {
    if (ref === "get_current_okr_cycle") out.add(SLOT.current_cycle);
    if (
      ref === "get_visible_initiatives" ||
      ref === "get_initiatives_for_direction" ||
      ref === "get_initiative_key_result_links"
    ) {
      out.add(SLOT.initiative);
    }
    if (
      ref === "get_visible_strategy_challenges" ||
      ref === "get_visible_strategic_challenges" ||
      ref === "get_strategy_challenges_for_cycle"
    ) {
      out.add(SLOT.strategy_challenge);
    }
    if (ref === "get_visible_okr_objectives" || ref === "get_key_results_for_objectives") {
      out.add(SLOT.current_cycle);
    }
  }

  if (src.sourceType === "table" || src.sourceType === "view") {
    if (/strategy_challenges|strategic_challenges/.test(ref)) out.add(SLOT.strategy_challenge);
    if (/initiatives|strategic_initiatives/.test(ref)) out.add(SLOT.initiative);
    if (/cycle_instances|okr_cycles/.test(ref)) out.add(SLOT.current_cycle);
  }

  if (src.placeKey) {
    for (const s of placeKeyToEvidenceSlots(src.placeKey)) out.add(s);
  }

  return out;
}

function collectSatisfiedSlots(used: SemanticUsedSource[]): Set<EvidenceSlot> {
  const s = new Set<EvidenceSlot>();
  for (const u of used) {
    for (const slot of slotsFromUsedSource(u)) s.add(slot);
  }
  return s;
}

function requiredSlotsWithSeverity(
  reqs: SemanticEvidenceRequirement[]
): Map<EvidenceSlot, "hard" | "soft"> {
  const m = new Map<EvidenceSlot, "hard" | "soft">();
  for (const r of reqs) {
    for (const slot of placeKeyToEvidenceSlots(r.placeKey)) {
      const prev = m.get(slot);
      const sev = r.severity === "hard" ? "hard" : "soft";
      if (!prev || prev === "soft") m.set(slot, sev);
    }
  }
  return m;
}

/**
 * Prüft, ob genutzte Quellen die geforderten Evidence-Slots abdecken (Answer-Gate, isoliert vom Orchestrator).
 */
export function evaluateSemanticEvidenceCoverage(
  input: EvaluateSemanticEvidenceCoverageInput
): SemanticEvidenceCoverageResult {
  const satisfied = collectSatisfiedSlots(input.usedSources);
  const required = requiredSlotsWithSeverity(input.requiredEvidence);

  const missingHard: EvidenceSlot[] = [];
  const missingSoft: EvidenceSlot[] = [];
  for (const [slot, sev] of required) {
    if (satisfied.has(slot)) continue;
    if (sev === "hard") missingHard.push(slot);
    else missingSoft.push(slot);
  }

  const missingEvidence = [...new Set([...missingHard, ...missingSoft])].map(String);
  const blockedClaims: string[] = [];

  if (missingHard.includes(SLOT.strategy_challenge) || missingSoft.includes(SLOT.strategy_challenge)) {
    if (missingHard.includes(SLOT.strategy_challenge)) {
      blockedClaims.push(SEMANTIC_MAP_BLOCKED_CLAIMS.challengeClaimWithoutEvidence);
    }
    if (input.questionClaimsTopStrategicChallenge && missingHard.includes(SLOT.strategy_challenge)) {
      blockedClaims.push(SEMANTIC_MAP_BLOCKED_CLAIMS.topChallengeWithoutChallengeEvidence);
    }
  }
  if (missingHard.includes(SLOT.initiative)) {
    blockedClaims.push(SEMANTIC_MAP_BLOCKED_CLAIMS.initiativeClaimWithoutEvidence);
  }

  const hardBlocks = missingHard.length > 0;
  const answerAllowed = !hardBlocks;
  let status: SemanticEvidenceCoverageResult["status"] = "ok";
  if (hardBlocks) status = "failed";
  else if (missingSoft.length > 0) status = "partial";

  return {
    status,
    missingEvidence,
    answerAllowed,
    blockedClaims: [...new Set(blockedClaims)],
  };
}

/** Hilfsfunktion für Tests: Evidence aus Resolution-PlaceKeys generieren. */
export function minimalRequirementsFromPlaceKeys(
  placeKeys: string[],
  severity: "hard" | "soft" = "hard"
): SemanticEvidenceRequirement[] {
  return placeKeys.map((placeKey) => ({
    placeKey,
    minObjects: 1,
    reason: "fixture",
    severity,
  }));
}
