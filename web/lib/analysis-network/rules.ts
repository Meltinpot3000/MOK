import type { AnalysisEntryRecord, LinkCandidate } from "@/lib/analysis-network/types";

const STOP_WORDS = new Set([
  "und",
  "oder",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "mit",
  "fuer",
  "für",
  "von",
  "den",
  "dem",
  "des",
  "im",
  "in",
  "auf",
  "am",
  "zu",
  "ist",
  "sind",
  "werden",
  "wird",
  "durch",
  "nicht",
]);

const SUPPORT_HINTS = [
  "foerder",
  "förder",
  "unterstuetz",
  "unterstütz",
  "staerkt",
  "stärkt",
  "ermoeglich",
  "ermöglich",
  "synergie",
  "positiv",
  "chance",
  "opportun",
  "benefit",
  "supports",
  "enables",
];

const REPULSION_HINTS = [
  "kontra",
  "risiko",
  "bedroh",
  "hemm",
  "verlust",
  "schwach",
  "konflikt",
  "widerspruch",
  "problem",
  "negativ",
  "threat",
  "decline",
  "block",
  "contradict",
];

const DEPENDENCY_HINTS = [
  "abh",
  "voraus",
  "bedingt",
  "notwendig",
  "muss",
  "requires",
  "depends",
  "praemiss",
  "prämiss",
];

const CAUSE_HINTS = [
  "fuehrt",
  "führt",
  "treiber",
  "ursache",
  "because",
  "causes",
  "induce",
  "result",
  "bewirkt",
];

const NEGATION_HINTS = ["nicht", "kein", "keine", "without", "ohne"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\säöüß-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\säöüß-]/gi, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part));
}

function buildBigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    out.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return out;
}

function jaccard(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersect = 0;
  for (const token of setA) {
    if (setB.has(token)) intersect += 1;
  }
  const union = setA.size + setB.size - intersect;
  return union <= 0 ? 0 : intersect / union;
}

function hintDensity(text: string, hints: string[]): number {
  if (!text) return 0;
  const hits = hints.reduce((count, hint) => (text.includes(hint) ? count + 1 : count), 0);
  return clamp(hits / Math.max(1, hints.length * 0.25), 0, 1);
}

function deriveRuleLinkType(
  a: AnalysisEntryRecord,
  b: AnalysisEntryRecord,
  triScores: { proximityScore: number; supportScore: number; repulsionScore: number },
  directional: { causeEvidence: number; dependencyEvidence: number }
): LinkCandidate["linkType"] {
  const { proximityScore, supportScore, repulsionScore } = triScores;
  const highImpactPair = (a.impact_level ?? 3) >= 4 && (b.impact_level ?? 3) >= 4;
  if (repulsionScore >= 0.62) {
    return "contradicts";
  }
  if (directional.dependencyEvidence >= 0.55 && repulsionScore < 0.6) {
    return "depends_on";
  }
  if (directional.causeEvidence >= 0.55 && repulsionScore < 0.6) {
    return "causes";
  }
  if (proximityScore >= 0.88 && repulsionScore <= 0.2) {
    return "duplicates";
  }
  if (supportScore >= 0.74 && highImpactPair && proximityScore >= 0.45) {
    return "amplifies";
  }
  if (supportScore >= 0.48) return "supports";
  return "related_to";
}

type PairFeatures = {
  similarity: number;
  bigramSimilarity: number;
  sameSubType: boolean;
  sameAnalysisType: boolean;
  impactAlignment: number;
  supportEvidence: number;
  repulsionEvidence: number;
  causeEvidence: number;
  dependencyEvidence: number;
  polarityConflict: number;
  negationDensity: number;
  evidenceQuality: number;
};

function computePairFeatures(
  left: { entry: AnalysisEntryRecord; text: string; tokens: string[]; bigrams: string[] },
  right: { entry: AnalysisEntryRecord; text: string; tokens: string[]; bigrams: string[] }
): PairFeatures {
  const similarity = jaccard(left.tokens, right.tokens);
  const bigramSimilarity = jaccard(left.bigrams, right.bigrams);
  const sameSubType = Boolean(
    left.entry.sub_type && right.entry.sub_type && left.entry.sub_type === right.entry.sub_type
  );
  const sameAnalysisType = left.entry.analysis_type === right.entry.analysis_type;
  const impactLeft = left.entry.impact_level ?? 3;
  const impactRight = right.entry.impact_level ?? 3;
  const impactAlignment = clamp(1 - Math.abs(impactLeft - impactRight) / 4, 0, 1);

  const supportEvidence = clamp(
    (hintDensity(left.text, SUPPORT_HINTS) + hintDensity(right.text, SUPPORT_HINTS)) / 2,
    0,
    1
  );
  const repulsionEvidence = clamp(
    (hintDensity(left.text, REPULSION_HINTS) + hintDensity(right.text, REPULSION_HINTS)) / 2,
    0,
    1
  );
  const causeEvidence = clamp(
    (hintDensity(left.text, CAUSE_HINTS) + hintDensity(right.text, CAUSE_HINTS)) / 2,
    0,
    1
  );
  const dependencyEvidence = clamp(
    (hintDensity(left.text, DEPENDENCY_HINTS) + hintDensity(right.text, DEPENDENCY_HINTS)) / 2,
    0,
    1
  );
  const negationDensity = clamp(
    (hintDensity(left.text, NEGATION_HINTS) + hintDensity(right.text, NEGATION_HINTS)) / 2,
    0,
    1
  );
  const polarityConflict = clamp(
    Math.min(supportEvidence, repulsionEvidence) + negationDensity * 0.35,
    0,
    1
  );
  const evidenceQuality = clamp((left.tokens.length + right.tokens.length) / 60, 0, 1);

  return {
    similarity,
    bigramSimilarity,
    sameSubType,
    sameAnalysisType,
    impactAlignment,
    supportEvidence,
    repulsionEvidence,
    causeEvidence,
    dependencyEvidence,
    polarityConflict,
    negationDensity,
    evidenceQuality,
  };
}

function computeRuleTriScores(features: PairFeatures) {
  const proximityScore = clamp(
    features.similarity * 0.5 +
      features.bigramSimilarity * 0.13 +
      (features.sameSubType ? 0.14 : 0) +
      (features.sameAnalysisType ? 0.08 : 0) +
      features.impactAlignment * 0.15,
    0,
    1
  );

  const supportScore = clamp(
    proximityScore * 0.45 +
      features.supportEvidence * 0.34 +
      (features.causeEvidence + features.dependencyEvidence) * 0.08 +
      (1 - features.polarityConflict) * 0.13,
    0,
    1
  );

  const repulsionScore = clamp(
    features.repulsionEvidence * 0.56 +
      features.polarityConflict * 0.24 +
      features.negationDensity * 0.1 +
      (1 - proximityScore) * 0.1,
    0,
    1
  );

  return { proximityScore, supportScore, repulsionScore };
}

export function buildRuleCandidates(entries: AnalysisEntryRecord[]): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];
  const normalized = entries.map((entry) => {
    const text = normalizeText(`${entry.title} ${entry.description ?? ""}`);
    const tokens = tokenize(text);
    return { entry, text, tokens, bigrams: buildBigrams(tokens) };
  });

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const left = normalized[i];
      const right = normalized[j];
      const features = computePairFeatures(left, right);
      const tri = computeRuleTriScores(features);
      const shouldLink =
        tri.proximityScore >= 0.2 ||
        tri.supportScore >= 0.32 ||
        tri.repulsionScore >= 0.42 ||
        features.dependencyEvidence >= 0.52 ||
        features.causeEvidence >= 0.52;
      if (!shouldLink) continue;

      const dominantScore = Math.max(tri.proximityScore, tri.supportScore, tri.repulsionScore);
      const consistency =
        tri.supportScore >= 0.45 && tri.repulsionScore >= 0.45
          ? 0.35
          : 1 - Math.min(0.4, Math.abs(tri.supportScore - tri.repulsionScore) * 0.3);
      const confidence = clamp(
        dominantScore * 0.44 + tri.proximityScore * 0.2 + features.evidenceQuality * 0.2 + consistency * 0.16,
        0.12,
        0.97
      );
      const strength = clamp(Math.round(1 + dominantScore * 4), 1, 5);
      const linkType = deriveRuleLinkType(left.entry, right.entry, tri, {
        causeEvidence: features.causeEvidence,
        dependencyEvidence: features.dependencyEvidence,
      });

      candidates.push({
        sourceEntryId: left.entry.id,
        targetEntryId: right.entry.id,
        linkType,
        strength,
        confidence: Number(confidence.toFixed(4)),
        comment: `Rule tri-score: prox=${tri.proximityScore.toFixed(2)} sup=${tri.supportScore.toFixed(2)} rep=${tri.repulsionScore.toFixed(2)}`,
        origin: "rule",
        metadata: {
          similarity: Number(features.similarity.toFixed(4)),
          bigramSimilarity: Number(features.bigramSimilarity.toFixed(4)),
          sameAnalysisType: features.sameAnalysisType,
          sameSubType: features.sameSubType,
          supportEvidence: Number(features.supportEvidence.toFixed(4)),
          repulsionEvidence: Number(features.repulsionEvidence.toFixed(4)),
          dependencyEvidence: Number(features.dependencyEvidence.toFixed(4)),
          causeEvidence: Number(features.causeEvidence.toFixed(4)),
          evidenceQuality: Number(features.evidenceQuality.toFixed(4)),
          triScores: {
            proximityScore: Number(tri.proximityScore.toFixed(4)),
            supportScore: Number(tri.supportScore.toFixed(4)),
            repulsionScore: Number(tri.repulsionScore.toFixed(4)),
          },
        },
      });
    }
  }

  return candidates;
}
