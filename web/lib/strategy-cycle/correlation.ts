export type CorrelationStatus = "green" | "yellow" | "red" | "unknown";

type ChallengeInput = {
  id: string;
  title: string;
  challenge_score: number | null;
  source_analysis_entry_id: string | null;
};

type ObjectiveInput = {
  id: string;
  title: string;
  importance_score: number | null;
  status: string | null;
};

type DirectionInput = {
  id: string;
  title: string;
  priority: number | string | null;
};

type ClusterMemberInput = {
  cluster_id: string;
  entry_id: string;
};

type ClusterObjectiveRelationInput = {
  id: string;
  cluster_id: string;
  objective_id: string;
  gap_score: number | null;
};

type ChallengeDirectionLinkInput = {
  strategic_challenge_id: string;
  strategic_direction_id: string;
};

type DirectionObjectiveLinkInput = {
  strategic_direction_id: string;
  objective_id: string;
};

type CorrelationOverrideInput = {
  objective_id: string;
  challenge_id: string;
  strategic_direction_id: string;
  status: string;
  note: string | null;
  updated_at: string | null;
};

export type CorrelationDirectionDetail = {
  directionId: string;
  directionTitle: string;
  autoScore: number;
  autoStatus: CorrelationStatus;
  effectiveStatus: CorrelationStatus;
  hasOverride: boolean;
  overrideNote: string | null;
  overrideUpdatedAt: string | null;
};

export type CorrelationCell = {
  key: string;
  challengeId: string;
  objectiveId: string;
  challengeTitle: string;
  objectiveTitle: string;
  score: number;
  status: CorrelationStatus;
  directionCount: number;
  directions: CorrelationDirectionDetail[];
  primaryDirectionId: string | null;
  objectiveStatus: string | null;
};

export type CorrelationSummaryResult = {
  objectives: Array<{ id: string; title: string; status: string | null }>;
  challenges: Array<{ id: string; title: string }>;
  cells: CorrelationCell[];
  goodObjectivePercent: number;
  weakCells: CorrelationCell[];
  conflictCount: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeScore1to5(value: number | null | undefined, fallback = 3): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return clamp01(fallback / 5);
  return clamp01(parsed / 5);
}

function normalizeGapScore(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return clamp01(parsed / 75);
}

function scoreToStatus(score: number): CorrelationStatus {
  if (!Number.isFinite(score) || score <= 0) return "unknown";
  if (score >= 70) return "green";
  if (score >= 45) return "yellow";
  return "red";
}

function normalizeStatus(value: string | null | undefined): CorrelationStatus | null {
  if (!value) return null;
  if (value === "green" || value === "yellow" || value === "red" || value === "unknown") return value;
  return null;
}

export function computeStrategicDesignCorrelationSummary(input: {
  challenges: ChallengeInput[];
  objectives: ObjectiveInput[];
  directions: DirectionInput[];
  clusterMembers: ClusterMemberInput[];
  clusterObjectiveRelations: ClusterObjectiveRelationInput[];
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
  directionObjectiveLinks: DirectionObjectiveLinkInput[];
  overrides: CorrelationOverrideInput[];
}): CorrelationSummaryResult {
  const challenges = [...(input.challenges ?? [])].sort((a, b) => a.title.localeCompare(b.title, "de"));
  const objectives = [...(input.objectives ?? [])].sort((a, b) => a.title.localeCompare(b.title, "de"));
  const directionsById = new Map((input.directions ?? []).map((row) => [row.id, row] as const));

  const clusterIdsByEntryId = new Map<string, Set<string>>();
  for (const member of input.clusterMembers ?? []) {
    const current = clusterIdsByEntryId.get(member.entry_id) ?? new Set<string>();
    current.add(member.cluster_id);
    clusterIdsByEntryId.set(member.entry_id, current);
  }

  const gapByClusterObjectiveKey = new Map<string, number>();
  for (const relation of input.clusterObjectiveRelations ?? []) {
    const key = `${relation.cluster_id}:${relation.objective_id}`;
    const current = gapByClusterObjectiveKey.get(key) ?? 0;
    const next = Math.max(current, Number(relation.gap_score ?? 0));
    gapByClusterObjectiveKey.set(key, Number.isFinite(next) ? next : 0);
  }

  const directionIdsByChallengeId = new Map<string, Set<string>>();
  for (const link of input.challengeDirectionLinks ?? []) {
    const current = directionIdsByChallengeId.get(link.strategic_challenge_id) ?? new Set<string>();
    current.add(link.strategic_direction_id);
    directionIdsByChallengeId.set(link.strategic_challenge_id, current);
  }

  const directionIdsByObjectiveId = new Map<string, Set<string>>();
  for (const link of input.directionObjectiveLinks ?? []) {
    const current = directionIdsByObjectiveId.get(link.objective_id) ?? new Set<string>();
    current.add(link.strategic_direction_id);
    directionIdsByObjectiveId.set(link.objective_id, current);
  }

  const overridesByTripletKey = new Map<
    string,
    { status: CorrelationStatus; note: string | null; updatedAt: string | null }
  >();
  for (const row of input.overrides ?? []) {
    const status = normalizeStatus(row.status);
    if (!status) continue;
    const key = `${row.objective_id}:${row.challenge_id}:${row.strategic_direction_id}`;
    overridesByTripletKey.set(key, {
      status,
      note: row.note ?? null,
      updatedAt: row.updated_at ?? null,
    });
  }

  const cells: CorrelationCell[] = [];
  let conflictCount = 0;

  for (const challenge of challenges) {
    const challengeNorm = normalizeScore1to5(challenge.challenge_score);
    const challengeClusterIds = challenge.source_analysis_entry_id
      ? [...(clusterIdsByEntryId.get(challenge.source_analysis_entry_id) ?? new Set<string>())]
      : [];
    const challengeDirectionIds = directionIdsByChallengeId.get(challenge.id) ?? new Set<string>();

    for (const objective of objectives) {
      const objectiveNorm = normalizeScore1to5(objective.importance_score);
      const objectiveDirectionIds = directionIdsByObjectiveId.get(objective.id) ?? new Set<string>();

      let bestGapScore = 0;
      for (const clusterId of challengeClusterIds) {
        bestGapScore = Math.max(
          bestGapScore,
          gapByClusterObjectiveKey.get(`${clusterId}:${objective.id}`) ?? 0
        );
      }
      const gapNorm = normalizeGapScore(bestGapScore);

      const candidateDirectionIds = [...challengeDirectionIds].filter((id) => objectiveDirectionIds.has(id));
      const directionDetails: CorrelationDirectionDetail[] = [];

      for (const directionId of candidateDirectionIds) {
        const direction = directionsById.get(directionId);
        if (!direction) continue;
        const priorityRaw = direction.priority;
        const priorityNum =
          priorityRaw != null && priorityRaw !== ""
            ? Number(priorityRaw)
            : null;
        const directionNorm = normalizeScore1to5(priorityNum);
        const autoScore = Math.round((gapNorm * 45 + directionNorm * 30 + objectiveNorm * 15 + challengeNorm * 10) * 100);
        const autoStatus = scoreToStatus(autoScore);
        const override = overridesByTripletKey.get(`${objective.id}:${challenge.id}:${directionId}`);
        const effectiveStatus = override?.status ?? autoStatus;
        const hasOverride = Boolean(override);
        if (hasOverride && effectiveStatus !== autoStatus && (autoScore >= 70 || autoScore <= 35)) {
          conflictCount += 1;
        }
        directionDetails.push({
          directionId,
          directionTitle: direction.title,
          autoScore,
          autoStatus,
          effectiveStatus,
          hasOverride,
          overrideNote: override?.note ?? null,
          overrideUpdatedAt: override?.updatedAt ?? null,
        });
      }

      directionDetails.sort((a, b) => b.autoScore - a.autoScore || a.directionTitle.localeCompare(b.directionTitle, "de"));

      let score = 0;
      let status: CorrelationStatus = "unknown";
      let primaryDirectionId: string | null = null;

      if (directionDetails.length > 0) {
        score = directionDetails[0].autoScore;
        status = directionDetails[0].effectiveStatus;
        primaryDirectionId = directionDetails[0].directionId;
      } else {
        score = Math.round((gapNorm * 45 + objectiveNorm * 30 + challengeNorm * 25) * 55);
        status = score > 0 ? "red" : "unknown";
      }

      cells.push({
        key: `${challenge.id}:${objective.id}`,
        challengeId: challenge.id,
        objectiveId: objective.id,
        challengeTitle: challenge.title,
        objectiveTitle: objective.title,
        score,
        status,
        directionCount: directionDetails.length,
        directions: directionDetails,
        primaryDirectionId,
        objectiveStatus: objective.status ?? null,
      });
    }
  }

  const goodObjectives = new Set<string>();
  for (const cell of cells) {
    if (cell.status === "green") {
      goodObjectives.add(cell.objectiveId);
    }
  }
  const goodObjectivePercent =
    objectives.length > 0 ? Math.round((goodObjectives.size / objectives.length) * 100) : 0;

  const weakCells = [...cells]
    .filter((cell) => cell.status === "red" || cell.status === "yellow")
    .sort((a, b) => a.score - b.score || a.challengeTitle.localeCompare(b.challengeTitle, "de"))
    .slice(0, 5);

  return {
    objectives: objectives.map((item) => ({ id: item.id, title: item.title, status: item.status ?? null })),
    challenges: challenges.map((item) => ({ id: item.id, title: item.title })),
    cells,
    goodObjectivePercent,
    weakCells,
    conflictCount,
  };
}
