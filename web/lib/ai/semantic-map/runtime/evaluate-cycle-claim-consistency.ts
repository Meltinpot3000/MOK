import { SEMANTIC_MAP_BLOCKED_CLAIMS } from "../types";

export type EvaluateCycleClaimConsistencyInput = {
  selectedCurrentCycleId: string;
  answerClaimedCycleIds: string[];
};

export type CycleClaimConsistencyResult = {
  ok: boolean;
  blockedClaims: string[];
};

/**
 * Verhindert Antworten, die andere Zyklen als den geladenen Current Cycle behaupten (ohne weitere Evidence).
 */
export function evaluateCycleClaimConsistency(
  input: EvaluateCycleClaimConsistencyInput
): CycleClaimConsistencyResult {
  const selected = input.selectedCurrentCycleId.trim().toLowerCase();
  const blocked: string[] = [];
  for (const id of input.answerClaimedCycleIds) {
    const c = id.trim().toLowerCase();
    if (c && c !== selected) {
      blocked.push(SEMANTIC_MAP_BLOCKED_CLAIMS.currentCycleMismatch);
      break;
    }
  }
  return {
    ok: blocked.length === 0,
    blockedClaims: [...new Set(blocked)],
  };
}
