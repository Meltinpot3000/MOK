export const MIN_ANALYSABLE_DESCRIPTION_LENGTH = 80;

export type StrategyObjectKind = "challenge" | "direction" | "objective" | "analysis_entry";

export type DescriptionQualityIssue =
  | "missing"
  | "too_short"
  | "duplicate_of_title"
  | "generic_only"
  | "no_measurable_outcome"
  | "no_analysis_basis"
  | "no_linked_scope";

export type DescriptionSeverity = "medium" | "high";

const GENERIC_PHRASES = [
  "strategisch wichtig",
  "strategisch relevant",
  "verbessern",
  "optimieren",
  "weiterentwickeln",
  "stärken",
  "ausbauen",
  "fokussieren",
  "wichtig",
  "relevant",
  "notwendig",
  "zentral",
];

const MEASURABLE_PATTERN =
  /\b(\d+\s*%|\d+|kpi|messbar|bis\s+\d{4}|von\s+.+\s+auf|zielwert|baseline|target)\b/i;

const SUBSTANCE_PATTERN =
  /\b(weil|damit|um zu|führt zu|reduziert|erhöht|verhindert|ermöglicht|problem|ziel|wirkung|ergebnis|risiko|kunde|markt|kosten|qualität|prozess|kompetenz|wissen)\b/i;

export function normalizeDescriptionText(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeDescriptionText(text)
      .split(" ")
      .filter((token) => token.length >= 3)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function isGenericOnlyDescription(normalized: string): boolean {
  if (!normalized) return false;
  if (SUBSTANCE_PATTERN.test(normalized)) return false;
  const hitsGeneric = GENERIC_PHRASES.some((phrase) => normalized.includes(phrase));
  return hitsGeneric && normalized.length < MIN_ANALYSABLE_DESCRIPTION_LENGTH;
}

function severityForIssue(issue: DescriptionQualityIssue): DescriptionSeverity {
  if (issue === "too_short") return "medium";
  return "high";
}

export function aggregateDescriptionSeverity(issues: DescriptionQualityIssue[]): DescriptionSeverity | null {
  if (issues.length === 0) return null;
  return issues.some((issue) => severityForIssue(issue) === "high") ? "high" : "medium";
}

export type EvaluateDescriptionQualityInput = {
  kind: StrategyObjectKind;
  title: string;
  description?: string | null;
  aiClarityScore?: number | null;
  hasAnalysisBasis?: boolean;
  hasLinkedChallenges?: boolean;
  hasLinkedObjectives?: boolean;
};

export type DescriptionQualityResult = {
  isAnalysable: boolean;
  issues: DescriptionQualityIssue[];
  severity: DescriptionSeverity | null;
  hintDe: string;
};

function buildHintDe(kind: StrategyObjectKind, issues: DescriptionQualityIssue[]): string {
  const labels: Record<DescriptionQualityIssue, string> = {
    missing: "Beschreibung fehlt",
    too_short: "Beschreibung ist sehr kurz",
    duplicate_of_title: "Beschreibung wiederholt den Titel",
    generic_only: "Beschreibung wirkt generisch ohne Wirkung oder Zielzustand",
    no_measurable_outcome: "Zielzustand oder Messbarkeit nicht erkennbar",
    no_analysis_basis: "Herkunft oder Begründung nicht nachvollziehbar",
    no_linked_scope: "Wirkungsfeld über Verknüpfungen nicht erkennbar",
  };
  const parts = issues.map((issue) => labels[issue]);
  const objectLabel =
    kind === "challenge"
      ? "Herausforderung"
      : kind === "direction"
        ? "Stoßrichtung"
        : kind === "objective"
          ? "Ziel"
          : "Analyse-Eintrag";
  return `${objectLabel} ist möglicherweise noch nicht ausreichend analysefähig beschrieben (${parts.join("; ")}).`;
}

function evaluateCoreDescriptionIssues(
  title: string,
  description: string | null | undefined
): DescriptionQualityIssue[] {
  const normalizedTitle = normalizeDescriptionText(title);
  const normalizedDescription = normalizeDescriptionText(description ?? "");
  const issues: DescriptionQualityIssue[] = [];

  if (!normalizedDescription) {
    issues.push("missing");
    return issues;
  }

  if (jaccardSimilarity(normalizedTitle, normalizedDescription) >= 0.85) {
    issues.push("duplicate_of_title");
  }

  if (isGenericOnlyDescription(normalizedDescription)) {
    issues.push("generic_only");
  }

  if (normalizedDescription.length < MIN_ANALYSABLE_DESCRIPTION_LENGTH) {
    issues.push("too_short");
  }

  return issues;
}

function hasDescriptionQualityGap(issues: DescriptionQualityIssue[]): boolean {
  return issues.some((issue) =>
    ["missing", "too_short", "duplicate_of_title", "generic_only"].includes(issue)
  );
}

export function evaluateDescriptionQuality(
  input: EvaluateDescriptionQualityInput
): DescriptionQualityResult {
  const coreIssues = evaluateCoreDescriptionIssues(input.title, input.description);

  if (!hasDescriptionQualityGap(coreIssues)) {
    return {
      isAnalysable: true,
      issues: [],
      severity: null,
      hintDe: "",
    };
  }

  const issues = [...coreIssues];

  if (input.kind === "objective") {
    const normalized = normalizeDescriptionText(input.description ?? "");
    const lowClarity =
      input.aiClarityScore != null &&
      Number.isFinite(Number(input.aiClarityScore)) &&
      Number(input.aiClarityScore) < 3;
    if (lowClarity || !MEASURABLE_PATTERN.test(normalized)) {
      issues.push("no_measurable_outcome");
    }
  }

  if (input.kind === "challenge" && input.hasAnalysisBasis === false) {
    issues.push("no_analysis_basis");
  }

  if (
    input.kind === "direction" &&
    !input.hasLinkedChallenges &&
    !input.hasLinkedObjectives
  ) {
    issues.push("no_linked_scope");
  }

  const severity = aggregateDescriptionSeverity(
    issues.filter((issue) =>
      ["missing", "too_short", "duplicate_of_title", "generic_only"].includes(issue)
    )
  );

  return {
    isAnalysable: false,
    issues,
    severity,
    hintDe: buildHintDe(input.kind, issues),
  };
}
