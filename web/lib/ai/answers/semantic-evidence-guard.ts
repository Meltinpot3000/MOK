import { SEMANTIC_MAP_BLOCKED_CLAIMS } from "@/lib/ai/semantic-map/types";
import type { SemanticMapRunDiagnostics } from "@/lib/ai/semantic-map/types";

export function isSemanticEvidenceEnforcementEnabled(diagnostics: SemanticMapRunDiagnostics): boolean {
  const envOn = process.env.AI_SEMANTIC_EVIDENCE_GUARD_ENABLED === "true";
  return envOn || diagnostics.diagnosticsOnly === false;
}

/**
 * Nur „High-Risk“-Lücken: strategische Challenge/Initiative, Top-Challenge ohne Evidence,
 * Initiative-Claim ohne Evidence, Zyklus-Mismatch.
 */
export function isHighRiskSemanticEvidenceGap(diagnostics: SemanticMapRunDiagnostics): boolean {
  if (!diagnostics.enabled) return false;
  if (diagnostics.cycleConsistency && !diagnostics.cycleConsistency.ok) return true;
  const cov = diagnostics.evidenceCoverage;
  if (cov.answerAllowed) return false;
  const miss = new Set(cov.missingEvidence);
  const blocked = new Set(cov.blockedClaims);
  if (miss.has("strategy_challenge") || miss.has("initiative")) return true;
  if (blocked.has(SEMANTIC_MAP_BLOCKED_CLAIMS.challengeClaimWithoutEvidence)) return true;
  if (blocked.has(SEMANTIC_MAP_BLOCKED_CLAIMS.initiativeClaimWithoutEvidence)) return true;
  if (blocked.has(SEMANTIC_MAP_BLOCKED_CLAIMS.topChallengeWithoutChallengeEvidence)) return true;
  return false;
}

export function buildSemanticEvidenceGuardReplacement(diagnostics: SemanticMapRunDiagnostics): string {
  const cycleBad = diagnostics.cycleConsistency && !diagnostics.cycleConsistency.ok;
  const miss = new Set(diagnostics.evidenceCoverage.missingEvidence);
  const parts: string[] = [];

  if (cycleBad) {
    parts.push(
      "Die Antwort würde Planungszyklen nennen, die nicht dem aktuell geladenen OKR-Zyklus entsprechen. " +
        "Eine widerspruchsfreie Aussage ist ohne Abgleich der Zyklusdaten nicht möglich."
    );
  }

  const lacksChallenge = miss.has("strategy_challenge");
  const lacksInit = miss.has("initiative");

  if (lacksChallenge && lacksInit) {
    parts.push(
      "Ich konnte den aktuellen Zyklus bestimmen, aber keine belastbaren Daten zu strategischen Herausforderungen " +
        "und Initiativen abrufen. Daher kann ich nicht seriös bestimmen, welches die größte strategische " +
        "Herausforderung ist oder welche Initiativen dazu laufen."
    );
  } else if (lacksChallenge) {
    parts.push(
      "Für diese Frage fehlen belastbare Daten zu strategischen Herausforderungen; eine seriöse Einschätzung " +
        "der größten Herausforderung ist ohne diese Quellen nicht möglich."
    );
  } else if (lacksInit) {
    parts.push(
      "Es fehlen Daten zu Initiativen; ich kann nicht zuverlässig angeben, welche Initiativen zur Herausforderung passen."
    );
  } else if (!diagnostics.evidenceCoverage.answerAllowed) {
    parts.push(
      "Die verfügbaren Quellen reichen für eine belastbare Antwort zu dieser Frage nicht aus."
    );
  }

  if (parts.length === 0) {
    return "Die verfügbaren Quellen reichen für eine belastbare Antwort zu dieser Frage nicht aus.";
  }
  return parts.join("\n\n");
}

export function evaluateSemanticEvidenceGuard(input: {
  diagnostics: SemanticMapRunDiagnostics | null | undefined;
}): { block: true; reason: string; replacementText: string } | null {
  const d = input.diagnostics;
  if (!d || !d.enabled) return null;
  if (!isSemanticEvidenceEnforcementEnabled(d)) return null;
  if (!isHighRiskSemanticEvidenceGap(d)) return null;

  const cycleBad = d.cycleConsistency && !d.cycleConsistency.ok;
  if (cycleBad) {
    return {
      block: true,
      reason: "semantic_cycle_claim_mismatch",
      replacementText: buildSemanticEvidenceGuardReplacement(d),
    };
  }
  if (!d.evidenceCoverage.answerAllowed) {
    return {
      block: true,
      reason: "semantic_evidence_incomplete",
      replacementText: buildSemanticEvidenceGuardReplacement(d),
    };
  }
  return null;
}
