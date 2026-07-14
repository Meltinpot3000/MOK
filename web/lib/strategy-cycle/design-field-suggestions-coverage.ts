import {
  labelFromCanonicalThemes,
  canonicalizeStrategicThemes,
  strategicThemeAffinity,
} from "@/lib/strategy-cycle/design-field-canonicalization";
import {
  bestAssignmentsForDirections,
  buildDesignFieldSemanticProfile,
  buildDirectionSemanticContext,
  scoreDirectionToDesignField,
  type DesignFieldSemanticProfile,
  type DirectionSemanticContext,
} from "@/lib/strategy-cycle/design-field-cluster-scoring";
import type {
  ClusterCandidate,
  DesignFieldSuggestionsPrepDirection,
} from "@/lib/strategy-cycle/design-field-suggestions-prep";
import type {
  ChallengeDirectionLinkInput,
  ChallengeInput,
  DirectionObjectiveLinkInput,
  ObjectiveInput,
} from "@/lib/strategy-cycle/strategic-design-insights";
import type {
  DesignFieldSuggestion,
  DirectionAssignmentMeta,
  ValidateDesignFieldSuggestionsResult,
} from "@/lib/strategy-cycle/design-field-suggestions-validate";
import { directionHasExistingGrouping } from "@/lib/strategy-cycle/design-field-suggestions-prep";

const COVERAGE_TARGET_RATIO = 0.7;
const MIN_SUGGESTIONS = 2;
const MIN_SUGGESTION_DIRECTIONS = 2;

export type EnrichDesignFieldSuggestionsContext = {
  directions: DesignFieldSuggestionsPrepDirection[];
  challenges: ChallengeInput[];
  objectives: ObjectiveInput[];
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
  directionObjectiveLinks: DirectionObjectiveLinkInput[];
  managementPartitions: ClusterCandidate[];
  titleByDirectionId: Record<string, string>;
};

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function suggestionOverlapsPartition(
  suggestion: DesignFieldSuggestion,
  partition: ClusterCandidate
): boolean {
  const partitionSet = new Set(partition.directionIds);
  return suggestion.directionIds.some((id) => partitionSet.has(id));
}

function buildLinkedEntities(
  directionId: string,
  context: EnrichDesignFieldSuggestionsContext
): {
  challenges: Array<{ title: string; description?: string | null }>;
  objectives: Array<{ title: string; description?: string | null }>;
} {
  const challengeIds = context.challengeDirectionLinks
    .filter((l) => l.strategic_direction_id === directionId)
    .map((l) => l.strategic_challenge_id);
  const objectiveIds = context.directionObjectiveLinks
    .filter((l) => l.strategic_direction_id === directionId)
    .map((l) => l.objective_id);

  const challenges = context.challenges
    .filter((c) => challengeIds.includes(c.id))
    .map((c) => ({ title: c.title, description: null }));
  const objectives = context.objectives
    .filter((o) => objectiveIds.includes(o.id))
    .map((o) => ({ title: o.title, description: null }));

  return { challenges, objectives };
}

function buildDirectionContexts(
  directionIds: string[],
  context: EnrichDesignFieldSuggestionsContext
): DirectionSemanticContext[] {
  return directionIds
    .map((directionId) => {
      const direction = context.directions.find((d) => d.id === directionId);
      if (!direction) return null;
      const linked = buildLinkedEntities(directionId, context);
      return buildDirectionSemanticContext({
        directionId,
        title: direction.title,
        description: direction.description ?? null,
        linkedChallenges: linked.challenges,
        linkedObjectives: linked.objectives,
      });
    })
    .filter((item): item is DirectionSemanticContext => item !== null);
}

function buildProfilesFromSuggestions(
  suggestions: DesignFieldSuggestion[],
  context: EnrichDesignFieldSuggestionsContext
): DesignFieldSemanticProfile[] {
  return suggestions.map((suggestion, index) => {
    const assigned = buildDirectionContexts(suggestion.directionIds, context).map((ctx) => ({
      directionId: ctx.directionId,
      title: ctx.title,
      description: ctx.description,
      linkedChallenges: buildLinkedEntities(ctx.directionId, context).challenges,
      linkedObjectives: buildLinkedEntities(ctx.directionId, context).objectives,
    }));

    return buildDesignFieldSemanticProfile({
      designFieldId: `suggestion:${index}:${normalizeLabel(suggestion.label)}`,
      label: suggestion.label,
      description: suggestion.description,
      assignedDirections: assigned,
    });
  });
}

function buildProfilesFromExistingGroupings(
  context: EnrichDesignFieldSuggestionsContext
): DesignFieldSemanticProfile[] {
  const byGrouping = new Map<string, DesignFieldSuggestionsPrepDirection[]>();
  for (const direction of context.directions) {
    const grouping = direction.grouping?.trim();
    if (!grouping) continue;
    const list = byGrouping.get(grouping) ?? [];
    list.push(direction);
    byGrouping.set(grouping, list);
  }

  return [...byGrouping.entries()].map(([label, directions]) => {
    const assigned = directions.map((direction) => {
      const linked = buildLinkedEntities(direction.id, context);
      return {
        directionId: direction.id,
        title: direction.title,
        description: direction.description ?? null,
        linkedChallenges: linked.challenges,
        linkedObjectives: linked.objectives,
      };
    });

    return buildDesignFieldSemanticProfile({
      designFieldId: `existing:${normalizeLabel(label)}`,
      label,
      description: null,
      assignedDirections: assigned,
    });
  });
}

function findSuggestionForProfile(
  suggestions: DesignFieldSuggestion[],
  profile: DesignFieldSemanticProfile
): DesignFieldSuggestion | null {
  const byLabel = suggestions.find((s) => normalizeLabel(s.label) === normalizeLabel(profile.label));
  if (byLabel) return byLabel;

  return (
    suggestions.find((s) =>
      profile.assignedDirectionIds.some((id) => s.directionIds.includes(id))
    ) ?? null
  );
}

function assignmentMetaFromScore(
  score: ClusterAssignmentScoreLike,
  source: DirectionAssignmentMeta["source"] = "auto"
): DirectionAssignmentMeta {
  return {
    source,
    confidence: score.confidence,
    score: score.score,
    reasons: score.reasons,
  };
}

type ClusterAssignmentScoreLike = {
  score: number;
  confidence: DirectionAssignmentMeta["confidence"];
  reasons: string[];
};

function attachDirectionToSuggestion(
  suggestion: DesignFieldSuggestion,
  directionId: string,
  title: string,
  meta: DirectionAssignmentMeta
): void {
  if (suggestion.directionIds.includes(directionId)) return;
  suggestion.directionIds.push(directionId);
  suggestion.directionTitles.push(title);
  suggestion.directionAssignments[directionId] = meta;
}

function buildSuggestionFromPartition(
  partition: ClusterCandidate,
  context: EnrichDesignFieldSuggestionsContext,
  usedDirectionIds: Set<string>
): DesignFieldSuggestion | null {
  const directionIds = partition.directionIds.filter((id) => !usedDirectionIds.has(id));
  if (directionIds.length < MIN_SUGGESTION_DIRECTIONS) return null;

  const directionContexts = buildDirectionContexts(directionIds, context);
  const themes = canonicalizeStrategicThemes(
    directionContexts.map((d) => d.semanticText).join(" ")
  );
  const label = labelFromCanonicalThemes(themes);
  const directionTitles = directionIds.map((id) => context.titleByDirectionId[id] ?? id);
  const confidence = Math.min(78, Math.round(52 + partition.score * 45));

  const directionAssignments: Record<string, DirectionAssignmentMeta> = {};
  for (const id of directionIds) {
    directionAssignments[id] = {
      source: "auto",
      confidence: confidence >= 75 ? "high" : confidence >= 55 ? "medium" : "low",
      score: partition.score,
      reasons: [partition.reasonDe],
    };
  }

  return {
    label,
    description: `Management-Verdichtung: ${partition.reasonDe}`,
    strategicIntent: "Thematisch verwandte Stoßrichtungen gemeinsam steuern.",
    directionIds,
    directionTitles,
    confidence,
    confidenceTier: confidence >= 75 ? "high" : confidence >= 55 ? "medium" : "low",
    confidenceLabelDe: confidence >= 75 ? "hoch" : confidence >= 55 ? "mittel" : "niedrig",
    assignmentConfidence: confidence >= 75 ? "high" : confidence >= 55 ? "medium" : "low",
    rationaleDe: partition.reasonDe,
    directionAssignments,
  };
}

function enrichWithCanonicalAssignments(
  suggestions: DesignFieldSuggestion[],
  unassignedDirectionIds: string[],
  context: EnrichDesignFieldSuggestionsContext
): string[] {
  const eligibleUnassigned = unassignedDirectionIds.filter(
    (id) => !directionHasExistingGrouping(context.directions, id)
  );
  if (eligibleUnassigned.length === 0) return unassignedDirectionIds;

  const profiles = [
    ...buildProfilesFromSuggestions(suggestions, context),
    ...buildProfilesFromExistingGroupings(context),
  ];
  if (profiles.length === 0) return unassignedDirectionIds;

  const directionContexts = buildDirectionContexts(eligibleUnassigned, context);
  const assignments = bestAssignmentsForDirections(directionContexts, profiles, {
    minConfidence: "medium",
  });

  const remaining = new Set(unassignedDirectionIds);
  for (const assignment of assignments) {
    const profile = profiles.find((p) => p.designFieldId === assignment.designFieldId);
    if (!profile) continue;

    let target = findSuggestionForProfile(suggestions, profile);
    if (!target) {
      target = {
        label: profile.label,
        description: `Automatisch aus bestehendem Designfeld «${profile.label}» angereichert.`,
        strategicIntent: "Vorhandene Designfeld-Struktur konsistent erweitern.",
        directionIds: [...profile.assignedDirectionIds],
        directionTitles: profile.assignedDirectionIds.map(
          (id) => context.titleByDirectionId[id] ?? id
        ),
        confidence: Math.round(assignment.score * 100),
        confidenceTier: assignment.confidence,
        confidenceLabelDe:
          assignment.confidence === "high"
            ? "hoch"
            : assignment.confidence === "medium"
              ? "mittel"
              : "niedrig",
        assignmentConfidence: assignment.confidence,
        rationaleDe: assignment.reasons.join("; "),
        directionAssignments: Object.fromEntries(
          profile.assignedDirectionIds.map((id) => [
            id,
            {
              source: "approved" as const,
              confidence: "high" as const,
              score: 1,
              reasons: ["Bestehende Zuordnung im Zyklus"],
            },
          ])
        ),
      };
      suggestions.push(target);
    }

    attachDirectionToSuggestion(
      target,
      assignment.directionId,
      context.titleByDirectionId[assignment.directionId] ?? assignment.directionId,
      assignmentMetaFromScore(assignment, "auto")
    );
    remaining.delete(assignment.directionId);
  }

  return [...remaining];
}

function refreshSuggestionLabel(
  suggestion: DesignFieldSuggestion,
  context: EnrichDesignFieldSuggestionsContext
): void {
  const directionContexts = buildDirectionContexts(suggestion.directionIds, context);
  const themes = canonicalizeStrategicThemes(
    directionContexts.map((d) => d.semanticText).join(" ")
  );
  suggestion.label = labelFromCanonicalThemes(themes);
}

function shouldCoalesceSuggestions(
  primary: DesignFieldSemanticProfile,
  secondary: DesignFieldSemanticProfile,
  primarySuggestion: DesignFieldSuggestion,
  secondarySuggestion: DesignFieldSuggestion
): boolean {
  const involvesSingleton =
    primarySuggestion.directionIds.length === 1 || secondarySuggestion.directionIds.length === 1;
  const combinedDirections =
    primarySuggestion.directionIds.length + secondarySuggestion.directionIds.length;

  if (!involvesSingleton && combinedDirections > 4) return false;

  const setA = new Set(primary.themes);
  const setB = new Set(secondary.themes);

  const sharedAnchorThemes: Array<DesignFieldSemanticProfile["themes"][number]> = [
    "organization_leadership",
    "engineering",
    "operations",
    "digitalization",
    "market_customer",
    "process_governance",
  ];

  for (const theme of sharedAnchorThemes) {
    if (setA.has(theme) && setB.has(theme)) return true;
  }

  return strategicThemeAffinity(primary.themes, secondary.themes) >= 0.75;
}

function mergeSuggestionPair(
  suggestions: DesignFieldSuggestion[],
  primaryIndex: number,
  secondaryIndex: number,
  context: EnrichDesignFieldSuggestionsContext
): void {
  const primary = suggestions[primaryIndex];
  const secondary = suggestions[secondaryIndex];
  if (!primary || !secondary) return;

  for (const directionId of secondary.directionIds) {
    attachDirectionToSuggestion(
      primary,
      directionId,
      context.titleByDirectionId[directionId] ?? directionId,
      secondary.directionAssignments[directionId] ?? {
        source: "auto",
        confidence: "medium",
        score: 0.65,
        reasons: ["Zusammengeführt wegen thematischer Nähe"],
      }
    );
  }

  refreshSuggestionLabel(primary, context);
  suggestions.splice(secondaryIndex, 1);
}

function coalesceRelatedSuggestions(
  suggestions: DesignFieldSuggestion[],
  context: EnrichDesignFieldSuggestionsContext
): void {
  let changed = true;
  while (changed) {
    changed = false;
    const profiles = buildProfilesFromSuggestions(suggestions, context);

    outer: for (let i = 0; i < profiles.length; i += 1) {
      for (let j = i + 1; j < profiles.length; j += 1) {
        if (
          !shouldCoalesceSuggestions(
            profiles[i],
            profiles[j],
            suggestions[i],
            suggestions[j]
          )
        ) {
          continue;
        }

        const primaryIndex =
          suggestions[i].directionIds.length >= suggestions[j].directionIds.length ? i : j;
        const secondaryIndex = primaryIndex === i ? j : i;
        mergeSuggestionPair(suggestions, primaryIndex, secondaryIndex, context);
        changed = true;
        break outer;
      }
    }
  }
}

function mergeSingletonSuggestions(
  suggestions: DesignFieldSuggestion[],
  context: EnrichDesignFieldSuggestionsContext
): void {
  const singles = suggestions.filter((s) => s.directionIds.length === 1);
  if (singles.length === 0) return;

  const multi = suggestions.filter((s) => s.directionIds.length >= MIN_SUGGESTION_DIRECTIONS);
  if (multi.length === 0) return;

  const profiles = buildProfilesFromSuggestions(multi, context);

  for (const single of singles) {
    const directionId = single.directionIds[0];
    if (!directionId) continue;
    const directionContexts = buildDirectionContexts([directionId], context);
    if (directionContexts.length === 0) continue;

    const scored = profiles
      .map((profile) => ({
        profile,
        suggestion: multi.find((s) => normalizeLabel(s.label) === normalizeLabel(profile.label)),
        score: scoreDirectionToDesignField(directionContexts[0], profile),
      }))
      .filter((item) => item.suggestion)
      .sort((a, b) => b.score.score - a.score.score);

    const best = scored[0];
    if (!best?.suggestion || best.score.confidence === "low") continue;

    attachDirectionToSuggestion(
      best.suggestion,
      directionId,
      context.titleByDirectionId[directionId] ?? directionId,
      assignmentMetaFromScore(best.score, "auto")
    );

    const idx = suggestions.indexOf(single);
    if (idx >= 0) suggestions.splice(idx, 1);
  }
}

/**
 * Broadens sparse LLM output using canonical theme scoring and management partitions.
 */
export function enrichDesignFieldSuggestionsForCoverage(
  result: ValidateDesignFieldSuggestionsResult,
  context: EnrichDesignFieldSuggestionsContext
): ValidateDesignFieldSuggestionsResult {
  const allowedCount =
    result.suggestions.reduce((s, item) => s + item.directionIds.length, 0) +
    result.unassignedDirectionIds.length;
  if (allowedCount === 0) return result;

  const suggestions = result.suggestions.map((s) => ({
    ...s,
    directionIds: [...s.directionIds],
    directionTitles: [...s.directionTitles],
    directionAssignments: { ...s.directionAssignments },
  }));
  let unassignedDirectionIds = [...result.unassignedDirectionIds];

  unassignedDirectionIds = enrichWithCanonicalAssignments(
    suggestions,
    unassignedDirectionIds,
    context
  );

  const usedDirectionIds = new Set(suggestions.flatMap((s) => s.directionIds));
  let coverageRatio =
    allowedCount > 0 ? (allowedCount - unassignedDirectionIds.length) / allowedCount : 1;

  if (suggestions.length < MIN_SUGGESTIONS || coverageRatio < COVERAGE_TARGET_RATIO) {
    const sortedPartitions = [...context.managementPartitions].sort(
      (a, b) => b.directionIds.length - a.directionIds.length || b.score - a.score
    );
    for (const partition of sortedPartitions) {
      coverageRatio =
        allowedCount > 0 ? (allowedCount - unassignedDirectionIds.length) / allowedCount : 1;
      if (suggestions.length >= MIN_SUGGESTIONS && coverageRatio >= COVERAGE_TARGET_RATIO) break;
      if (suggestions.some((s) => suggestionOverlapsPartition(s, partition))) continue;
      const extra = buildSuggestionFromPartition(partition, context, usedDirectionIds);
      if (!extra) continue;
      for (const id of extra.directionIds) usedDirectionIds.add(id);
      suggestions.push(extra);
      unassignedDirectionIds = unassignedDirectionIds.filter((id) => !usedDirectionIds.has(id));
    }

    unassignedDirectionIds = enrichWithCanonicalAssignments(
      suggestions,
      unassignedDirectionIds,
      context
    );
  }

  coalesceRelatedSuggestions(suggestions, context);
  mergeSingletonSuggestions(suggestions, context);

  const finalCoverage =
    allowedCount > 0 ? (allowedCount - unassignedDirectionIds.length) / allowedCount : 1;

  const warningDe =
    suggestions.length < MIN_SUGGESTIONS
      ? `Nur ${suggestions.length} gültige Vorschläge — bitte manuell prüfen oder erneut generieren.`
      : finalCoverage < COVERAGE_TARGET_RATIO
        ? "Viele Stoßrichtungen konnten nicht sicher zugeordnet werden. Bitte Cluster-Schwelle prüfen oder manuell nachbearbeiten."
        : unassignedDirectionIds.length > 0
          ? `${unassignedDirectionIds.length} Stoßrichtung${unassignedDirectionIds.length === 1 ? "" : "en"} ohne klare Zuordnung — bitte im Editor prüfen.`
          : null;

  return { suggestions, unassignedDirectionIds, warningDe };
}
