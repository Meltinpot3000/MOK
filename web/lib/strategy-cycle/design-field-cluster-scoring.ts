import {
  canonicalizeStrategicThemes,
  extractDirectionCode,
  normalizeSemanticText,
  strategicThemeAffinity,
  type StrategicTheme,
} from "@/lib/strategy-cycle/design-field-canonicalization";

export type AssignmentConfidence = "high" | "medium" | "low";

export type ClusterAssignmentScore = {
  designFieldId: string;
  designFieldLabel: string;
  directionId: string;
  score: number;
  confidence: AssignmentConfidence;
  reasons: string[];
};

export type DirectionSemanticContext = {
  directionId: string;
  code: string;
  title: string;
  description: string | null;
  semanticText: string;
  themes: StrategicTheme[];
  challengeTexts: string[];
  objectiveTexts: string[];
  challengeThemes: StrategicTheme[];
  objectiveThemes: StrategicTheme[];
};

export type DesignFieldSemanticProfile = {
  designFieldId: string;
  label: string;
  description: string | null;
  semanticText: string;
  themes: StrategicTheme[];
  challengeTexts: string[];
  objectiveTexts: string[];
  assignedDirectionIds: string[];
};

type TextEntity = { title: string; description?: string | null };

type BuildDirectionContextInput = {
  directionId: string;
  title: string;
  description?: string | null;
  linkedChallenges?: TextEntity[];
  linkedObjectives?: TextEntity[];
};

function entityText(entity: TextEntity): string {
  return `${entity.title} ${entity.description ?? ""}`.trim();
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeSemanticText(text)
      .split(" ")
      .filter((token) => token.length >= 3)
  );
}

function mapConfidence(score: number): AssignmentConfidence {
  if (score >= 0.75) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

function themeOverlapReasons(
  directionThemes: Set<StrategicTheme>,
  fieldThemes: Set<StrategicTheme>
): string[] {
  const shared = [...directionThemes].filter((theme) => fieldThemes.has(theme));
  return shared.map((theme) => `Gemeinsames Thema: ${theme}`);
}

function challengeOverlapReasons(
  directionChallengeThemes: Set<StrategicTheme>,
  fieldChallengeThemes: Set<StrategicTheme>,
  directionChallenges: string[],
  fieldChallenges: string[]
): string[] {
  const reasons: string[] = [];
  const sharedThemes = [...directionChallengeThemes].filter((t) => fieldChallengeThemes.has(t));
  for (const theme of sharedThemes) {
    reasons.push(`Verwandte Herausforderung (${theme})`);
  }
  const dirNorm = directionChallenges.map(normalizeSemanticText).join(" ");
  for (const challenge of fieldChallenges) {
    const c = normalizeSemanticText(challenge);
    if (c.length < 8) continue;
    const snippet = c.split(" ").slice(0, 6).join(" ");
    if (dirNorm.includes(snippet) || c.includes(normalizeSemanticText(directionChallenges[0] ?? ""))) {
      reasons.push(`Verwandte Herausforderung: ${challenge}`);
      break;
    }
  }
  return reasons;
}

export function buildDirectionSemanticContext(input: BuildDirectionContextInput): DirectionSemanticContext {
  const code = extractDirectionCode(input.title);
  const linkedChallenges = input.linkedChallenges ?? [];
  const linkedObjectives = input.linkedObjectives ?? [];
  const semanticText = [
    code,
    input.title,
    input.description ?? "",
    ...linkedChallenges.map(entityText),
    ...linkedObjectives.map(entityText),
  ]
    .join(" ")
    .trim();

  const challengeTexts = linkedChallenges.map((c) => entityText(c));
  const objectiveTexts = linkedObjectives.map((o) => entityText(o));

  return {
    directionId: input.directionId,
    code,
    title: input.title,
    description: input.description ?? null,
    semanticText,
    themes: canonicalizeStrategicThemes(semanticText),
    challengeTexts,
    objectiveTexts,
    challengeThemes: canonicalizeStrategicThemes(challengeTexts.join(" ")),
    objectiveThemes: canonicalizeStrategicThemes(objectiveTexts.join(" ")),
  };
}

export function buildDesignFieldSemanticProfile(input: {
  designFieldId: string;
  label: string;
  description?: string | null;
  assignedDirections: BuildDirectionContextInput[];
}): DesignFieldSemanticProfile {
  const assignedDirectionIds = input.assignedDirections.map((d) => d.directionId);
  const directionContexts = input.assignedDirections.map(buildDirectionSemanticContext);

  const semanticText = [
    input.label,
    input.description ?? "",
    ...directionContexts.map((d) => d.semanticText),
  ]
    .join(" ")
    .trim();

  const challengeTexts = directionContexts.flatMap((d) => d.challengeTexts);
  const objectiveTexts = directionContexts.flatMap((d) => d.objectiveTexts);

  return {
    designFieldId: input.designFieldId,
    label: input.label,
    description: input.description ?? null,
    semanticText,
    themes: canonicalizeStrategicThemes(semanticText),
    challengeTexts,
    objectiveTexts,
    assignedDirectionIds,
  };
}

export function applyCapabilityEngineeringBoundaryRule(
  direction: DirectionSemanticContext,
  field: DesignFieldSemanticProfile,
  score: number,
  reasons: string[]
): { score: number; reasons: string[] } {
  const directionThemes = new Set(direction.themes);
  const fieldThemes = new Set(field.themes);
  const directionHasCapability =
    directionThemes.has("capabilities") || directionThemes.has("knowledge");
  const fieldHasEngineeringCluster =
    fieldThemes.has("engineering") &&
    (fieldThemes.has("capabilities") || fieldThemes.has("knowledge"));

  if (!directionHasCapability || !fieldHasEngineeringCluster) {
    return { score, reasons };
  }

  const nextReasons = [...reasons];
  if (!nextReasons.some((r) => r.includes("capabilities"))) {
    nextReasons.push("Gemeinsames Thema: capabilities");
  }
  if (!nextReasons.some((r) => r.includes("knowledge"))) {
    nextReasons.push("Gemeinsames Thema: knowledge");
  }
  if (
    field.challengeTexts.some((c) =>
      /knowledge|knowhow|engineering skill/i.test(c)
    )
  ) {
    nextReasons.push(
      "Verwandte Herausforderung: knowledge position / knowhow / engineering skills"
    );
  }

  return { score: Math.max(score, 0.55), reasons: nextReasons };
}

export function applyOrganizationCapabilitiesBoundaryRule(
  direction: DirectionSemanticContext,
  field: DesignFieldSemanticProfile,
  score: number,
  reasons: string[]
): { score: number; reasons: string[] } {
  const directionThemes = new Set(direction.themes);
  const fieldThemes = new Set(field.themes);

  const directionTalent =
    directionThemes.has("organization_leadership") ||
    directionThemes.has("capabilities") ||
    directionThemes.has("knowledge");
  const fieldTalentCluster =
    (fieldThemes.has("organization_leadership") &&
      (fieldThemes.has("capabilities") || fieldThemes.has("knowledge"))) ||
    (fieldThemes.has("capabilities") && field.assignedDirectionIds.length > 0);

  const crossTalentBridge =
    (directionThemes.has("organization_leadership") &&
      (fieldThemes.has("capabilities") || fieldThemes.has("knowledge"))) ||
    ((directionThemes.has("capabilities") || directionThemes.has("knowledge")) &&
      fieldThemes.has("organization_leadership"));

  if (!directionTalent || (!fieldTalentCluster && !crossTalentBridge)) {
    return { score, reasons };
  }

  const nextReasons = [...reasons];
  if (directionThemes.has("capabilities") || directionThemes.has("knowledge")) {
    if (!nextReasons.some((r) => r.includes("capabilities"))) {
      nextReasons.push("Gemeinsames Thema: capabilities");
    }
    if (!nextReasons.some((r) => r.includes("knowledge"))) {
      nextReasons.push("Gemeinsames Thema: knowledge");
    }
  }
  if (directionThemes.has("organization_leadership")) {
    nextReasons.push("Gemeinsames Thema: organization_leadership");
  }
  if (field.challengeTexts.some((c) => /staff|management|development|expertise|skill/i.test(c))) {
    nextReasons.push("Verwandte Herausforderung: Personal-/Fähigkeitsentwicklung");
  }

  return { score: Math.max(score, 0.55), reasons: nextReasons };
}

export function scoreDirectionToDesignField(
  direction: DirectionSemanticContext,
  field: DesignFieldSemanticProfile
): ClusterAssignmentScore {
  const directionThemes = new Set(direction.themes);
  const fieldThemes = new Set(field.themes);
  const directionChallengeThemes = new Set([
    ...direction.challengeThemes,
    ...canonicalizeStrategicThemes(direction.challengeTexts.join(" ")),
  ]);
  const fieldChallengeThemes = new Set([
    ...canonicalizeStrategicThemes(field.challengeTexts.join(" ")),
  ]);
  const directionObjectiveThemes = new Set(direction.objectiveThemes);
  const fieldObjectiveThemes = new Set(canonicalizeStrategicThemes(field.objectiveTexts.join(" ")));

  const canonicalThemeOverlap = strategicThemeAffinity([...directionThemes], [...fieldThemes]);
  const linkedChallengeOverlap = jaccardSets(directionChallengeThemes, fieldChallengeThemes);
  const linkedObjectiveOverlap = jaccardSets(directionObjectiveThemes, fieldObjectiveThemes);
  const lexicalSimilarity = jaccardSets(
    tokenSet(direction.semanticText),
    tokenSet(field.semanticText)
  );

  let wTheme = 0.45;
  let wChallenge = 0.3;
  let wObjective = 0.15;
  let wLexical = 0.1;

  const hasChallenges =
    direction.challengeTexts.length > 0 && field.challengeTexts.length > 0;
  const hasObjectives =
    direction.objectiveTexts.length > 0 && field.objectiveTexts.length > 0;

  if (!hasChallenges && !hasObjectives) {
    const sum = wTheme + wLexical;
    wTheme /= sum;
    wLexical /= sum;
    wChallenge = 0;
    wObjective = 0;
  } else if (!hasChallenges) {
    const sum = wTheme + wObjective + wLexical;
    wTheme /= sum;
    wObjective /= sum;
    wLexical /= sum;
    wChallenge = 0;
  } else if (!hasObjectives) {
    const sum = wTheme + wChallenge + wLexical;
    wTheme /= sum;
    wChallenge /= sum;
    wLexical /= sum;
    wObjective = 0;
  }

  let score =
    wTheme * canonicalThemeOverlap +
    wChallenge * linkedChallengeOverlap +
    wObjective * linkedObjectiveOverlap +
    wLexical * lexicalSimilarity;

  let reasons = [
    ...themeOverlapReasons(directionThemes, fieldThemes),
    ...challengeOverlapReasons(
      directionChallengeThemes,
      fieldChallengeThemes,
      direction.challengeTexts,
      field.challengeTexts
    ),
  ];

  const boundedEng = applyCapabilityEngineeringBoundaryRule(direction, field, score, reasons);
  score = boundedEng.score;
  reasons = boundedEng.reasons;

  const boundedOrg = applyOrganizationCapabilitiesBoundaryRule(direction, field, score, reasons);
  score = boundedOrg.score;
  reasons = boundedOrg.reasons;

  if (lexicalSimilarity >= 0.2 && reasons.length === 0) {
    reasons.push("Lexikalische Nähe im Stoßrichtungs- und Designfeld-Kontext");
  }

  score = Number(Math.min(1, Math.max(0, score)).toFixed(3));

  return {
    designFieldId: field.designFieldId,
    designFieldLabel: field.label,
    directionId: direction.directionId,
    score,
    confidence: mapConfidence(score),
    reasons: [...new Set(reasons)].slice(0, 6),
  };
}

export function bestAssignmentsForDirections(
  directions: DirectionSemanticContext[],
  fields: DesignFieldSemanticProfile[],
  options: { minConfidence?: AssignmentConfidence } = {}
): ClusterAssignmentScore[] {
  const minRank = options.minConfidence === "high" ? 2 : options.minConfidence === "medium" ? 1 : 0;
  const rank = (c: AssignmentConfidence) => (c === "high" ? 2 : c === "medium" ? 1 : 0);

  const results: ClusterAssignmentScore[] = [];
  for (const direction of directions) {
    const scored = fields
      .map((field) => scoreDirectionToDesignField(direction, field))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || rank(best.confidence) < minRank) continue;
    results.push(best);
  }
  return results;
}
