import type { ContributionLevel } from "./coverage-level";
import { normalizeContributionLevel } from "./coverage-level";
import {
  type StrategicDirectionStatus,
  isStrategicDirectionVisibleInProgramMatrix,
  normalizeStrategicDirectionStatus,
} from "./strategic-direction-lifecycle";

/**
 * Programm-Matrix: Zeilen = Stossrichtungen; Spalten = Herausforderungen, danach Objectives.
 *
 * --- Herausforderung × Stossrichtung ---
 *   Roh_H = ( Σ_i (OI_i × ÜF_O,i) ) × HS × ÜF_H × SP
 *   (wie zuvor; OI = importance_score Objective, ÜF_O/ÜF_H = 0 | 0,5 | 1 | 2)
 *
 * --- Objective × Stossrichtung (Unterstützung des Objectives durch die Richtung) ---
 *   Roh_O = SP × Priorität_Obj × Importance_Obj × ÜF_O / 3
 *   Priorität_Obj = importance_score (1–5, Standard 3)
 *   Importance_Obj = ai_objective_score falls gesetzt, sonst 3 (neutral — vermeidet Doppelzählung)
 *   ÜF_O = Abdeckung Richtung–Objective: 0 (kein Link) | 0,5 | 1 | 2
 *   Der Faktor /3 bewirkt: gleiche Basisgrössen zählen Herausforderungs-Zellen etwa dreimal so stark
 *   wie Objective-Zellen (vor gemeinsamer Normierung auf 0–100).
 *
 * Anzeige 0–100: min(100, round(Roh / MaxRoh × 100)) über alle Zellen (Challenges + Objectives);
 * MaxRoh = 0 → alle 0.
 */

export type ProgramMatrixRedundancyBand = "none" | "focus" | "ok" | "alert";

export type ProgramMatrixObjective = {
  id: string;
  title: string;
  importance_score?: number | null;
  ai_objective_score?: number | string | null;
  status?: string | null;
};

export type ProgramMatrixCell = {
  challengeId: string;
  directionId: string;
  challengeTitle: string;
  directionTitle: string;
  score: number;
  isGap: boolean;
  statusTier: "strong" | "medium" | "weak" | "gap";
  linkedObjectives: ProgramMatrixObjective[];
  objectiveCoverage: number;
  isLinked: boolean;
  /** ÜF_H Challenge–Richtung: 0 | 0,5 | 1 | 2 */
  contributionWeight: number;
  contributionLevel: ContributionLevel | null;
  overlapCount: number;
  scoreExplanation: string;
  isTopInRow: boolean;
};

export type ProgramMatrixObjectiveCell = {
  objectiveId: string;
  directionId: string;
  objectiveTitle: string;
  objectiveStatus: string | null;
  directionTitle: string;
  score: number;
  statusTier: "strong" | "medium" | "weak";
  isLinked: boolean;
  /** ÜF_O Richtung–Objective: 0 | 0,5 | 1 | 2 */
  contributionWeight: number;
  contributionLevel: ContributionLevel | null;
  scoreExplanation: string;
  isTopInRow: boolean;
};

export function matrixCellCountsAsAddressedForOverlap(cell: Pick<ProgramMatrixCell, "isLinked">): boolean {
  return cell.isLinked;
}

export function matrixObjectiveCellCountsAsAddressedForOverlap(
  cell: Pick<ProgramMatrixObjectiveCell, "isLinked">
): boolean {
  return cell.isLinked;
}

export type ProgramMatrixDirectionRow = {
  directionId: string;
  directionTitle: string;
  directionStatus: StrategicDirectionStatus;
  rowScoreSum: number;
  /** Verknuepfte Objectives der Stossrichtung (fuer Zeilen-Info unabhaengig von Challenge-Spalten). */
  linkedObjectives: ProgramMatrixObjective[];
  cells: ProgramMatrixCell[];
  objectiveCells: ProgramMatrixObjectiveCell[];
};

export type ProgramMatrixChallengeColumn = {
  challengeId: string;
  challengeTitle: string;
  columnScoreSum: number;
  addressingDirectionsCount: number;
  redundancyBand: ProgramMatrixRedundancyBand;
};

export type ProgramMatrixObjectiveColumn = {
  objectiveId: string;
  objectiveTitle: string;
  columnScoreSum: number;
  addressingDirectionsCount: number;
  redundancyBand: ProgramMatrixRedundancyBand;
};

export type ProgramMatrixModel = {
  directionRows: ProgramMatrixDirectionRow[];
  challengeColumns: ProgramMatrixChallengeColumn[];
  objectiveColumns: ProgramMatrixObjectiveColumn[];
  insights: {
    coveragePercent: number;
    addressedChallenges: number;
    totalChallenges: number;
    redundancyHighChallengeCount: number;
    matrixCriticalOverlapChallengeCount: number;
  };
  totalObjectives: number;
};

export type BuildProgramMatrixInput = {
  challenges: Array<{ id: string; title: string; challenge_score: number | string | null }>;
  directions: Array<{
    id: string;
    title: string;
    priority?: number | string | null;
    status?: string | null;
  }>;
  challengeDirectionLinks: Array<{
    strategic_challenge_id: string;
    strategic_direction_id: string;
    contribution_level?: string | null;
  }>;
  directionObjectiveLinks: Array<{
    strategic_direction_id: string;
    objective_id: string;
    contribution_level?: string | null;
  }>;
  objectives: ProgramMatrixObjective[];
};

function num(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** KI- oder Neutral-Importance (1–5-Skala); ohne KI-Bewertung 3, damit Roh_O = SP×Priorität×ÜF_O. */
function objectiveImportanceMultiplier(obj: ProgramMatrixObjective): number {
  const ai = obj.ai_objective_score;
  if (ai != null && ai !== "" && Number.isFinite(Number(ai))) return num(ai);
  return 3;
}

export function redundancyBandFromAddressingCount(n: number): ProgramMatrixRedundancyBand {
  if (n <= 0) return "none";
  if (n <= 2) return "focus";
  if (n <= 4) return "ok";
  return "alert";
}

/**
 * Abdeckung aus Pill-Stufe (Challenge–Richtung oder Richtung–Objective):
 * schwach 0,5 | mittel 1 | stark 2
 */
export function matrixCoverageFactorFromLevel(level: string | null | undefined): number {
  const c = String(level ?? "medium").toLowerCase();
  if (c === "high") return 2;
  if (c === "low") return 0.5;
  return 1;
}

/** Prioritaet Stossrichtung (1–5); gleiche Logik wie in der Programm-Matrix. */
export function directionPriorityValue(priority: number | string | null | undefined): number {
  let p = num(priority);
  if (!Number.isFinite(p) || p <= 0) p = 1;
  return p;
}

function statusTierChallenge(isGap: boolean, score: number): ProgramMatrixCell["statusTier"] {
  if (isGap) return "gap";
  if (score >= 66) return "strong";
  if (score >= 40) return "medium";
  return "weak";
}

function statusTierObjective(score: number): ProgramMatrixObjectiveCell["statusTier"] {
  if (score >= 66) return "strong";
  if (score >= 40) return "medium";
  return "weak";
}

type ChallengeCellDraft = {
  weightedOISum: number;
  challengeScore: number;
  üfH: number;
  sp: number;
  raw: number;
  isLinked: boolean;
  isGap: boolean;
  contributionLabel: string | null;
  contributionLevel: ContributionLevel | null;
};

type ObjectiveCellDraft = {
  sp: number;
  objectivePriority: number;
  objectiveImportance: number;
  üfO: number;
  raw: number;
  isLinked: boolean;
  contributionLabel: string | null;
  usedAiImportance: boolean;
  contributionLevel: ContributionLevel | null;
};

function abdeckungLabel(üf: number): string | null {
  if (üf <= 0) return null;
  if (Math.abs(üf - 2) < 0.001) return "stark (2)";
  if (Math.abs(üf - 0.5) < 0.001) return "schwach (0,5)";
  return "mittel (1)";
}

const LEVEL_RANK: Record<ContributionLevel, number> = { low: 0, medium: 1, high: 2 };

/** Groesste Abdeckung bei mehreren Links; bei Gleichstand hoehere Stufe (high > medium > low). */
function bestDirectionObjectiveCoverage(
  links: BuildProgramMatrixInput["directionObjectiveLinks"],
  directionId: string,
  objectiveId: string
): { factor: number; level: ContributionLevel | null } {
  let bestFactor = 0;
  let levelAtBest: ContributionLevel | null = null;
  for (const link of links) {
    if (link.strategic_direction_id !== directionId || link.objective_id !== objectiveId) continue;
    const f = matrixCoverageFactorFromLevel(link.contribution_level);
    const lv = normalizeContributionLevel(link.contribution_level);
    if (f > bestFactor) {
      bestFactor = f;
      levelAtBest = lv;
    } else if (f === bestFactor && f > 0 && levelAtBest !== null && LEVEL_RANK[lv] > LEVEL_RANK[levelAtBest]) {
      levelAtBest = lv;
    }
  }
  return { factor: bestFactor, level: bestFactor > 0 ? levelAtBest : null };
}

function buildChallengeExplanation(p: {
  isGap: boolean;
  isLinked: boolean;
  weightedOISum: number;
  challengeScore: number;
  üfH: number;
  sp: number;
  raw: number;
  maxRaw: number;
  normalizedScore: number;
  contributionLabel: string | null;
}): string {
  if (!p.isLinked || p.üfH <= 0) {
    const parts = [
      "Keine Abdeckung: Herausforderung und Stossrichtung sind nicht verknuepft (Abdeckung = 0). Roh-Score dieser Zelle = 0.",
    ];
    if (p.maxRaw > 0) {
      parts.push(
        `Normierung: min(100, Roh/MaxRoh×100) mit MaxRoh=${p.maxRaw.toFixed(3)} → Anzeige ${p.normalizedScore}.`
      );
    } else parts.push("Normierung: MaxRoh = 0 — Anzeige 0.");
    if (p.isGap) parts.push("Gap: keine Objectives an der Stossrichtung.");
    return parts.join(" ");
  }

  const parts: string[] = [];
  parts.push(
    `Unterstützung = Σ(OI×Abdeckung_Objekt) × HS × Abdeckung_Challenge × SP = ${p.weightedOISum.toFixed(3)} × ${p.challengeScore.toFixed(2)} × ${p.üfH} × ${p.sp.toFixed(2)} = ${p.raw.toFixed(3)}.`
  );
  if (p.weightedOISum <= 0) {
    parts.push("Hinweis: Summe OI×Abdeckung_Objekt ist 0 (keine verknuepften Objectives oder alle OI 0).");
  }
  if (p.maxRaw > 0) {
    parts.push(
      `Normierung Matrix: min(100, Roh/MaxRoh×100) mit MaxRoh=${p.maxRaw.toFixed(3)} → Anzeige-Score ${p.normalizedScore}.`
    );
  } else parts.push("Normierung: MaxRoh = 0 — Anzeige 0.");
  if (p.isGap) parts.push("Hinweis: keine Objectives an dieser Stossrichtung (Gap).");
  if (p.contributionLabel) parts.push(`Abdeckung Herausforderung–Richtung: ${p.contributionLabel}.`);
  return parts.join(" ");
}

function buildObjectiveExplanation(p: {
  isLinked: boolean;
  sp: number;
  objectivePriority: number;
  objectiveImportance: number;
  üfO: number;
  raw: number;
  maxRaw: number;
  normalizedScore: number;
  contributionLabel: string | null;
  usedAiImportance: boolean;
}): string {
  if (!p.isLinked || p.üfO <= 0) {
    const parts = [
      "Keine Abdeckung: Stossrichtung und Objective sind nicht verknuepft (Abdeckung = 0). Roh-Score = 0.",
    ];
    if (p.maxRaw > 0) {
      parts.push(
        `Normierung: min(100, Roh/MaxRoh×100) mit MaxRoh=${p.maxRaw.toFixed(3)} → Anzeige ${p.normalizedScore}.`
      );
    } else parts.push("Normierung: MaxRoh = 0 — Anzeige 0.");
    return parts.join(" ");
  }
  const impNote = p.usedAiImportance
    ? "Importance = KI-Gesamtscore (ai_objective_score)"
    : "Importance = 3 (neutral, keine KI-Bewertung — Roh = SP×Priorität×Abdeckung)";
  const parts: string[] = [
    `Unterstützung Objective = SP × Objective-Priorität (importance_score) × Importance × Abdeckung / 3 = ${p.sp.toFixed(2)} × ${p.objectivePriority} × ${p.objectiveImportance.toFixed(2)} × ${p.üfO} / 3 = ${p.raw.toFixed(3)}.`,
    impNote,
  ];
  if (p.maxRaw > 0) {
    parts.push(
      `Normierung Matrix (gemeinsam mit Herausforderungs-Zellen): MaxRoh=${p.maxRaw.toFixed(3)} → Anzeige ${p.normalizedScore}.`
    );
  }
  if (p.contributionLabel) parts.push(`Abdeckung Richtung–Objective: ${p.contributionLabel}.`);
  return parts.join(" ");
}

export function buildProgramMatrix(input: BuildProgramMatrixInput): ProgramMatrixModel {
  const totalObjectives = Math.max(0, input.objectives.length);
  const objectiveById = new Map(input.objectives.map((o) => [o.id, o] as const));

  const directionsForMatrix = input.directions.filter((d) =>
    isStrategicDirectionVisibleInProgramMatrix(d.status)
  );
  const visibleDirectionIds = new Set(directionsForMatrix.map((d) => d.id));

  const objectiveIdsByDirection = new Map<string, Set<string>>();
  for (const link of input.directionObjectiveLinks) {
    const dir = link.strategic_direction_id;
    let idSet = objectiveIdsByDirection.get(dir);
    if (!idSet) {
      idSet = new Set();
      objectiveIdsByDirection.set(dir, idSet);
    }
    idSet.add(link.objective_id);
  }

  const weightedOISumByDirection = new Map<string, number>();
  for (const direction of directionsForMatrix) {
    let sum = 0;
    for (const link of input.directionObjectiveLinks) {
      if (link.strategic_direction_id !== direction.id) continue;
      const obj = objectiveById.get(link.objective_id);
      if (!obj) continue;
      const oi = num(obj.importance_score ?? 3);
      const üo = matrixCoverageFactorFromLevel(link.contribution_level);
      sum += oi * üo;
    }
    weightedOISumByDirection.set(direction.id, sum);
  }

  const contributionByPair = new Map<string, { üfH: number; contribution: string | null }>();
  for (const link of input.challengeDirectionLinks) {
    const key = `${link.strategic_challenge_id}:${link.strategic_direction_id}`;
    const c = String(link.contribution_level ?? "medium");
    contributionByPair.set(key, { üfH: matrixCoverageFactorFromLevel(c), contribution: c });
  }

  const challengeLinkCounts = new Map<string, number>();
  for (const link of input.challengeDirectionLinks) {
    if (!visibleDirectionIds.has(link.strategic_direction_id)) continue;
    challengeLinkCounts.set(
      link.strategic_challenge_id,
      (challengeLinkCounts.get(link.strategic_challenge_id) ?? 0) + 1
    );
  }
  const redundancyHighChallengeCount = [...challengeLinkCounts.values()].filter((n) => n > 1).length;

  const addressedChallenges = input.challenges.filter(
    (c) => (challengeLinkCounts.get(c.id) ?? 0) > 0
  ).length;
  const totalChallenges = input.challenges.length;
  const coveragePercent =
    totalChallenges === 0 ? 0 : Math.round((addressedChallenges / totalChallenges) * 100);

  const challengeDrafts = new Map<string, Map<string, ChallengeCellDraft>>();
  const objectiveDrafts = new Map<string, Map<string, ObjectiveCellDraft>>();
  let maxRaw = 0;

  for (const direction of directionsForMatrix) {
    const rowChallenge = new Map<string, ChallengeCellDraft>();
    const rowObjective = new Map<string, ObjectiveCellDraft>();
    const dirObjIds = [...(objectiveIdsByDirection.get(direction.id) ?? [])];
    const linkedObjectives = dirObjIds
      .map((id) => objectiveById.get(id))
      .filter((o): o is ProgramMatrixObjective => Boolean(o));
    const weightedOISum = weightedOISumByDirection.get(direction.id) ?? 0;
    const sp = directionPriorityValue(direction.priority);
    const isGap = linkedObjectives.length === 0;

    for (const challenge of input.challenges) {
      const pairKey = `${challenge.id}:${direction.id}`;
      const pairMeta = contributionByPair.get(pairKey);
      const isLinked = Boolean(pairMeta);
      const üfH = isLinked ? (pairMeta?.üfH ?? matrixCoverageFactorFromLevel("medium")) : 0;
      const challengeScore = num(challenge.challenge_score);
      const raw = weightedOISum * challengeScore * üfH * sp;
      maxRaw = Math.max(maxRaw, raw);

      rowChallenge.set(challenge.id, {
        weightedOISum,
        challengeScore,
        üfH,
        sp,
        raw,
        isLinked,
        isGap,
        contributionLabel: abdeckungLabel(üfH),
        contributionLevel: isLinked && pairMeta ? normalizeContributionLevel(pairMeta.contribution) : null,
      });
    }

    for (const objective of input.objectives) {
      const { factor: üfO, level: objLevel } = bestDirectionObjectiveCoverage(
        input.directionObjectiveLinks,
        direction.id,
        objective.id
      );
      const isLinked = üfO > 0;
      const objectivePriority = num(objective.importance_score ?? 3);
      const objectiveImportance = objectiveImportanceMultiplier(objective);
      const usedAiImportance =
        objective.ai_objective_score != null &&
        objective.ai_objective_score !== "" &&
        Number.isFinite(Number(objective.ai_objective_score));
      const raw = (sp * objectivePriority * objectiveImportance * üfO) / 3;
      maxRaw = Math.max(maxRaw, raw);

      rowObjective.set(objective.id, {
        sp,
        objectivePriority,
        objectiveImportance,
        üfO,
        raw,
        isLinked,
        contributionLabel: abdeckungLabel(üfO),
        usedAiImportance,
        contributionLevel: isLinked && objLevel ? objLevel : null,
      });
    }

    challengeDrafts.set(direction.id, rowChallenge);
    objectiveDrafts.set(direction.id, rowObjective);
  }

  const rawChallengeCells = new Map<string, Map<string, Omit<ProgramMatrixCell, "isTopInRow">>>();
  const rawObjectiveCells = new Map<string, Map<string, Omit<ProgramMatrixObjectiveCell, "isTopInRow">>>();

  for (const direction of directionsForMatrix) {
    const rowC = new Map<string, Omit<ProgramMatrixCell, "isTopInRow">>();
    const dirObjIds = [...(objectiveIdsByDirection.get(direction.id) ?? [])];
    const linkedObjectives = dirObjIds
      .map((id) => objectiveById.get(id))
      .filter((o): o is ProgramMatrixObjective => Boolean(o));
    const objectiveCoverage =
      totalObjectives === 0 ? 0 : Math.min(1, linkedObjectives.length / totalObjectives);

    for (const challenge of input.challenges) {
      const d = challengeDrafts.get(direction.id)!.get(challenge.id)!;
      const normalizedScore =
        maxRaw <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((d.raw / maxRaw) * 100)));
      const st = statusTierChallenge(d.isGap, normalizedScore);

      rowC.set(challenge.id, {
        challengeId: challenge.id,
        directionId: direction.id,
        challengeTitle: challenge.title,
        directionTitle: direction.title,
        score: normalizedScore,
        isGap: d.isGap,
        statusTier: st,
        linkedObjectives,
        objectiveCoverage,
        isLinked: d.isLinked,
        contributionWeight: d.üfH,
        contributionLevel: d.contributionLevel,
        overlapCount: 0,
        scoreExplanation: buildChallengeExplanation({
          isGap: d.isGap,
          isLinked: d.isLinked,
          weightedOISum: d.weightedOISum,
          challengeScore: d.challengeScore,
          üfH: d.üfH,
          sp: d.sp,
          raw: d.raw,
          maxRaw,
          normalizedScore,
          contributionLabel: d.contributionLabel,
        }),
      });
    }
    rawChallengeCells.set(direction.id, rowC);

    const rowO = new Map<string, Omit<ProgramMatrixObjectiveCell, "isTopInRow">>();
    for (const objective of input.objectives) {
      const d = objectiveDrafts.get(direction.id)!.get(objective.id)!;
      const normalizedScore =
        maxRaw <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((d.raw / maxRaw) * 100)));
      const st = statusTierObjective(normalizedScore);
      rowO.set(objective.id, {
        objectiveId: objective.id,
        directionId: direction.id,
        objectiveTitle: objective.title,
        objectiveStatus: objective.status ?? null,
        directionTitle: direction.title,
        score: normalizedScore,
        statusTier: st,
        isLinked: d.isLinked,
        contributionWeight: d.üfO,
        contributionLevel: d.contributionLevel,
        scoreExplanation: buildObjectiveExplanation({
          isLinked: d.isLinked,
          sp: d.sp,
          objectivePriority: d.objectivePriority,
          objectiveImportance: d.objectiveImportance,
          üfO: d.üfO,
          raw: d.raw,
          maxRaw,
          normalizedScore,
          contributionLabel: d.contributionLabel,
          usedAiImportance: d.usedAiImportance,
        }),
      });
    }
    rawObjectiveCells.set(direction.id, rowO);
  }

  const columnSums = new Map<string, number>();
  for (const ch of input.challenges) columnSums.set(ch.id, 0);
  const objectiveColumnSums = new Map<string, number>();
  for (const o of input.objectives) objectiveColumnSums.set(o.id, 0);
  const rowSums = new Map<string, number>();
  for (const d of directionsForMatrix) rowSums.set(d.id, 0);

  for (const d of directionsForMatrix) {
    const rowC = rawChallengeCells.get(d.id);
    const rowO = rawObjectiveCells.get(d.id);
    if (rowC) {
      for (const ch of input.challenges) {
        const c = rowC.get(ch.id);
        if (!c) continue;
        rowSums.set(d.id, (rowSums.get(d.id) ?? 0) + c.score);
        columnSums.set(ch.id, (columnSums.get(ch.id) ?? 0) + c.score);
      }
    }
    if (rowO) {
      for (const obj of input.objectives) {
        const c = rowO.get(obj.id);
        if (!c) continue;
        rowSums.set(d.id, (rowSums.get(d.id) ?? 0) + c.score);
        objectiveColumnSums.set(obj.id, (objectiveColumnSums.get(obj.id) ?? 0) + c.score);
      }
    }
  }

  const sortedDirections = [...directionsForMatrix].sort(
    (a, b) => (rowSums.get(b.id) ?? 0) - (rowSums.get(a.id) ?? 0)
  );
  const sortedChallenges = [...input.challenges].sort(
    (a, b) => (columnSums.get(b.id) ?? 0) - (columnSums.get(a.id) ?? 0)
  );
  const sortedObjectives = [...input.objectives].sort(
    (a, b) => (objectiveColumnSums.get(b.id) ?? 0) - (objectiveColumnSums.get(a.id) ?? 0)
  );

  const directionRows: ProgramMatrixDirectionRow[] = sortedDirections.map((direction) => {
    const rowMapC = rawChallengeCells.get(direction.id)!;
    const rowMapO = rawObjectiveCells.get(direction.id)!;
    const cellsRaw = sortedChallenges.map((ch) => rowMapC.get(ch.id)!);
    const maxChallengeScore = cellsRaw.length === 0 ? 0 : Math.max(...cellsRaw.map((c) => c.score));
    const cells: ProgramMatrixCell[] = cellsRaw.map((c) => ({
      ...c,
      isTopInRow: c.score === maxChallengeScore && maxChallengeScore >= 45,
    }));
    const objCellsRaw = sortedObjectives.map((o) => rowMapO.get(o.id)!);
    const maxObjScore = objCellsRaw.length === 0 ? 0 : Math.max(...objCellsRaw.map((c) => c.score));
    const objectiveCells: ProgramMatrixObjectiveCell[] = objCellsRaw.map((c) => ({
      ...c,
      isTopInRow: c.score === maxObjScore && maxObjScore >= 45,
    }));
    const dirObjIdsRow = [...(objectiveIdsByDirection.get(direction.id) ?? [])];
    const linkedObjectivesRow = dirObjIdsRow
      .map((id) => objectiveById.get(id))
      .filter((o): o is ProgramMatrixObjective => Boolean(o));

    return {
      directionId: direction.id,
      directionTitle: direction.title,
      directionStatus: normalizeStrategicDirectionStatus(direction.status),
      rowScoreSum: rowSums.get(direction.id) ?? 0,
      linkedObjectives: linkedObjectivesRow,
      cells,
      objectiveCells,
    };
  });

  const challengeColumns: ProgramMatrixChallengeColumn[] = sortedChallenges.map((ch, colIndex) => {
    let addressingDirectionsCount = 0;
    for (const row of directionRows) {
      const cell = row.cells[colIndex];
      if (cell && cell.challengeId === ch.id && matrixCellCountsAsAddressedForOverlap(cell)) {
        addressingDirectionsCount += 1;
      }
    }
    return {
      challengeId: ch.id,
      challengeTitle: ch.title,
      columnScoreSum: columnSums.get(ch.id) ?? 0,
      addressingDirectionsCount,
      redundancyBand: redundancyBandFromAddressingCount(addressingDirectionsCount),
    };
  });

  const objectiveColumns: ProgramMatrixObjectiveColumn[] = sortedObjectives.map((obj, colIndex) => {
    let addressingDirectionsCount = 0;
    for (const row of directionRows) {
      const cell = row.objectiveCells[colIndex];
      if (cell && cell.objectiveId === obj.id && matrixObjectiveCellCountsAsAddressedForOverlap(cell)) {
        addressingDirectionsCount += 1;
      }
    }
    return {
      objectiveId: obj.id,
      objectiveTitle: obj.title,
      columnScoreSum: objectiveColumnSums.get(obj.id) ?? 0,
      addressingDirectionsCount,
      redundancyBand: redundancyBandFromAddressingCount(addressingDirectionsCount),
    };
  });

  let matrixCriticalOverlapChallengeCount = 0;
  for (const col of challengeColumns) {
    if (col.addressingDirectionsCount >= 5) matrixCriticalOverlapChallengeCount += 1;
  }

  return {
    directionRows,
    challengeColumns,
    objectiveColumns,
    insights: {
      coveragePercent,
      addressedChallenges,
      totalChallenges,
      redundancyHighChallengeCount,
      matrixCriticalOverlapChallengeCount,
    },
    totalObjectives,
  };
}
