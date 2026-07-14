import {
  buildDescriptionQualityMaps,
  buildDescriptionQualityViewModel,
  type DescriptionQualityViewModel,
} from "@/lib/strategy-cycle/description-quality-view";
import type { BuildImpactPathGraphInput } from "@/lib/strategy-cycle/impact-path-graph";

export type ImpactPathAnalysability = Pick<
  DescriptionQualityViewModel,
  "isAnalysable" | "hintDe" | "displayLabelDe" | "displayStatus"
>;

function buildLinkageIndexes(input: BuildImpactPathGraphInput) {
  const analysisEntryIdsByChallenge: Record<string, string[]> = {};
  for (const link of input.challengeAnalysisEntries) {
    const list = analysisEntryIdsByChallenge[link.strategic_challenge_id] ?? [];
    if (!list.includes(link.analysis_entry_id)) list.push(link.analysis_entry_id);
    analysisEntryIdsByChallenge[link.strategic_challenge_id] = list;
  }

  const challengeIdsByDirection: Record<string, string[]> = {};
  for (const link of input.challengeDirectionLinks) {
    const list = challengeIdsByDirection[link.strategic_direction_id] ?? [];
    if (!list.includes(link.strategic_challenge_id)) list.push(link.strategic_challenge_id);
    challengeIdsByDirection[link.strategic_direction_id] = list;
  }

  const objectiveIdsByDirection: Record<string, string[]> = {};
  for (const link of input.directionObjectiveLinks) {
    const list = objectiveIdsByDirection[link.strategic_direction_id] ?? [];
    if (!list.includes(link.objective_id)) list.push(link.objective_id);
    objectiveIdsByDirection[link.strategic_direction_id] = list;
  }

  return { analysisEntryIdsByChallenge, challengeIdsByDirection, objectiveIdsByDirection };
}

export function buildImpactPathAnalysabilityMap(
  input: BuildImpactPathGraphInput
): Map<string, ImpactPathAnalysability> {
  const { analysisEntryIdsByChallenge, challengeIdsByDirection, objectiveIdsByDirection } =
    buildLinkageIndexes(input);

  const maps = buildDescriptionQualityMaps({
    challenges: input.challenges,
    directions: input.directions,
    objectives: input.objectives.map((objective) => ({
      id: objective.id,
      title: objective.title,
      description: objective.description,
      ai_clarity_score: objective.ai_clarity_score ?? null,
    })),
    analysisEntryIdsByChallenge,
    challengeIdsByDirection,
    objectiveIdsByDirection,
  });

  const result = new Map<string, ImpactPathAnalysability>();

  const attach = (id: string, vm: DescriptionQualityViewModel) => {
    result.set(id, {
      isAnalysable: vm.isAnalysable,
      hintDe: vm.hintDe,
      displayLabelDe: vm.displayLabelDe,
      displayStatus: vm.displayStatus,
    });
  };

  for (const [id, vm] of Object.entries(maps.challenges)) attach(id, vm);
  for (const [id, vm] of Object.entries(maps.directions)) attach(id, vm);
  for (const [id, vm] of Object.entries(maps.objectives)) attach(id, vm);

  for (const entry of input.entries) {
    const vm = buildDescriptionQualityViewModel("analysis_entry", {
      kind: "analysis_entry",
      title: entry.title,
      description: entry.description,
    });
    attach(entry.id, vm);
  }

  return result;
}

export function allAnalysableMap(ids: string[]): Map<string, ImpactPathAnalysability> {
  return new Map(
    ids.map((id) => [
      id,
      {
        isAnalysable: true,
        hintDe: "",
        displayLabelDe: "OK",
        displayStatus: "ok",
      },
    ])
  );
}

export function isImpactPathEdgeAnalysable(
  sourceId: string,
  targetId: string,
  analysabilityByNodeId: Map<string, ImpactPathAnalysability>
): boolean {
  const source = analysabilityByNodeId.get(sourceId);
  const target = analysabilityByNodeId.get(targetId);
  if (source && !source.isAnalysable) return false;
  if (target && !target.isAnalysable) return false;
  return true;
}
