import { renderDeterministicNarration } from "./deterministic-narrator";
import {
  rankingContractSchema,
  structuredAnswerContractSchema,
  type StructuredAnswerContract,
} from "./answer-contracts";

const NO_DATA_PATTERNS = [
  /keine daten/i,
  /keine informationen/i,
  /internal\s*context\s*leer/i,
  /internalcontext\s*leer/i,
  /nicht (moeglich|möglich)/i,
  /nicht verfuegbar/i,
  /nicht verfügbar/i,
  /kann nicht bestimmt werden/i,
];

export type AnswerVerificationResult =
  | { status: "ok" }
  | { status: "blocked"; reason: string; replacementText: string };

function splitSentences(text: string): string[] {
  return text
    .split(/[\n.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasNoDataClaim(text: string): boolean {
  return NO_DATA_PATTERNS.some((pattern) => pattern.test(text));
}

function mentionsPartialCoverage(text: string): boolean {
  return /teilabdeckung|teilweise|nicht alle|fehlend|nicht abgedeckt|missing/i.test(text);
}

function extractInteger(text: string): number | null {
  const match = text.match(/\b(\d+)\b/);
  if (!match) return null;
  return Number(match[1]);
}

function violatesTopOwnerClaim(contract: StructuredAnswerContract, text: string): boolean {
  if (contract.queryClass !== "ranking" || contract.top.length === 0) return false;
  const topLabel = contract.top[0].label.toLowerCase();
  const topSentences = splitSentences(text).filter((s) => /meisten|rang\s*1|fuehrend|führend/i.test(s));
  if (topSentences.length === 0) return false;
  return topSentences.some((sentence) => !sentence.toLowerCase().includes(topLabel));
}

function violatesContextualNumbers(contract: StructuredAnswerContract, text: string): boolean {
  if (contract.queryClass !== "ranking") return false;
  const sentences = splitSentences(text);
  const top = contract.top[0];
  if (!top) return false;
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const number = extractInteger(sentence);
    if (number == null) continue;
    if (lower.includes(top.label.toLowerCase()) && number !== top.count) return true;
    if (/insgesamt|gesamt|total/i.test(lower) && number !== contract.totalItems) {
      return true;
    }
  }
  return false;
}

function validateEvidenceConsistency(contract: StructuredAnswerContract): boolean {
  const parsedRanking = rankingContractSchema.safeParse(contract);
  if (!parsedRanking.success) return true;
  return parsedRanking.data.top.every((entry) => entry.count === entry.evidenceIds.length);
}

export function verifyAnswer(args: {
  contract: StructuredAnswerContract;
  llmText: string;
  baselineText?: string;
}): AnswerVerificationResult {
  const parsed = structuredAnswerContractSchema.safeParse(args.contract);
  if (!parsed.success) {
    return {
      status: "blocked",
      reason: "invalid_contract",
      replacementText: args.baselineText ?? renderDeterministicNarration(args.contract),
    };
  }
  const contract = parsed.data;
  const replacementText = args.baselineText ?? renderDeterministicNarration(contract);

  const totalItems = "totalItems" in contract ? contract.totalItems : "total" in contract ? contract.total : null;
  const hasContractData =
    (typeof totalItems === "number" && totalItems > 0) ||
    ("evidenceIds" in contract && contract.evidenceIds.length > 0) ||
    ("items" in contract && contract.items.length > 0) ||
    ("top" in contract && contract.top.length > 0) ||
    ("buckets" in contract && contract.buckets.length > 0);
  if (contract.retrievalStatus === "ok" && hasContractData && hasNoDataClaim(args.llmText)) {
    return { status: "blocked", reason: "no_data_claim_despite_contract_data", replacementText };
  }
  if (contract.retrievalStatus === "failed" && /\b\d+\b/.test(args.llmText)) {
    return { status: "blocked", reason: "numeric_claim_despite_failed_retrieval", replacementText };
  }
  if (contract.missingOps.length > 0 && !mentionsPartialCoverage(args.llmText)) {
    return { status: "blocked", reason: "missing_ops_not_disclosed", replacementText };
  }
  if (!validateEvidenceConsistency(contract)) {
    return { status: "blocked", reason: "evidence_count_mismatch", replacementText };
  }
  if (violatesTopOwnerClaim(contract, args.llmText)) {
    return { status: "blocked", reason: "top_owner_claim_mismatch", replacementText };
  }
  if (violatesContextualNumbers(contract, args.llmText)) {
    return { status: "blocked", reason: "contextual_number_mismatch", replacementText };
  }

  return { status: "ok" };
}

