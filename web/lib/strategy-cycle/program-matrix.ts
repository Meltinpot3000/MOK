/**
 * Programm-Matrix: Zeilen = Stossrichtungen, Spalten = Herausforderungen.
 * Programmkandidaten: Direction x Challenge x Objectives.
 *
 * Score (pro Zelle, 0–100 nach Cap):
 *   raw = (Teil1 + Teil2 + Teil3) * Teil4
 *   Teil1 = max importance_score (1–5) der mit der Stossrichtung verknuepften Objectives
 *   Teil2 = Sentinel: max ai_objective_score jener Objectives (KI-Gesamtpunktzahl);
 *           kein Wert vorhanden → Fallback min(5, direction_score / 2)
 *   Teil3 = min(2, 0.5 * min(4, max(0, n-1))) — „weitere“ Objectives, bis zu 4 zaehlen (+0,5 je weiteres)
 *   Teil4 = challenge_score der Herausforderung (dieser Spalte)
 * Gap-Zelle (keine Objectives an der Richtung): Score = 0.
 *
 * Redundanz / Ueberlappung pro Herausforderung (Spalte):
 *   Eine Stossrichtung zaehlt nur bei formaler Verknuepfung (challenge_direction_links / isLinked).
 *   Farbstufen: 0=grau, 1-2=klarer Fokus, 3-4=ok, 5+=kritisch (Ueberengineering).
 */

export type ProgramMatrixRedundancyBand = "none" | "focus" | "ok" | "alert";

export type ProgramMatrixObjective = {
  id: string;
  title: string;
  importance_score?: number | null;
  ai_objective_score?: number | string | null;
};

export type ProgramMatrixCell = {
  challengeId: string;
  directionId: string;
  challengeTitle: string;
  directionTitle: string;
  score: number;
  isGap: boolean;
  /** UX: stark verknuepft | mittel | schwach | gap */
  statusTier: "strong" | "medium" | "weak" | "gap";
  linkedObjectives: ProgramMatrixObjective[];
  objectiveCoverage: number;
  isLinked: boolean;
  contributionWeight: number;
  overlapCount: number;
  scoreExplanation: string;
  /** true wenn Zelle zur Top-N pro Zeile gehoert (Highlight) */
  isTopInRow: boolean;
};

/** true, wenn diese Zelle fuer Ueberlappungs-Zaehlung (Spaltenfarbe) mitzaehlt — nur formale Links. */
export function matrixCellCountsAsAddressedForOverlap(cell: Pick<ProgramMatrixCell, "isLinked">): boolean {
  return cell.isLinked;
}

export type ProgramMatrixDirectionRow = {
  directionId: string;
  directionTitle: string;
  rowScoreSum: number;
  cells: ProgramMatrixCell[];
};

export type ProgramMatrixChallengeColumn = {
  challengeId: string;
  challengeTitle: string;
  columnScoreSum: number;
  /** Stossrichtungen mit formaler Challenge–Stossrichtung-Verknuepfung (Ueberlappung). */
  addressingDirectionsCount: number;
  redundancyBand: ProgramMatrixRedundancyBand;
};

export type ProgramMatrixModel = {
  directionRows: ProgramMatrixDirectionRow[];
  challengeColumns: ProgramMatrixChallengeColumn[];
  insights: {
    coveragePercent: number;
    addressedChallenges: number;
    totalChallenges: number;
    redundancyHighChallengeCount: number;
    /** Herausforderungen mit 5+ formal verknuepften Stossrichtungen. */
    matrixCriticalOverlapChallengeCount: number;
  };
  totalObjectives: number;
};

export type BuildProgramMatrixInput = {
  challenges: Array<{ id: string; title: string; challenge_score: number | string | null }>;
  directions: Array<{ id: string; title: string; direction_score: number | string | null }>;
  challengeDirectionLinks: Array<{
    strategic_challenge_id: string;
    strategic_direction_id: string;
    contribution_level?: string | null;
  }>;
  directionObjectiveLinks: Array<{ strategic_direction_id: string; objective_id: string }>;
  objectives: ProgramMatrixObjective[];
};

function num(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function redundancyBandFromAddressingCount(n: number): ProgramMatrixRedundancyBand {
  if (n <= 0) return "none";
  if (n <= 2) return "focus";
  if (n <= 4) return "ok";
  return "alert";
}

function linkContributionWeight(level: string | null | undefined): number {
  const c = String(level ?? "medium").toLowerCase();
  if (c === "high") return 3;
  if (c === "low") return 1;
  return 2;
}

/**
 * Teil1–3 und Teil4 wie Produktivorschrift; Teil4 = challenge_score.
 */
function computeCellScore(params: {
  linkedObjectives: ProgramMatrixObjective[];
  directionScore: number;
  challengeScore: number;
  isGap: boolean;
}): number {
  if (params.isGap || params.linkedObjectives.length === 0) return 0;

  const part1 = Math.max(
    ...params.linkedObjectives.map((o) => num(o.importance_score ?? 3)),
    0
  );

  const aiVals = params.linkedObjectives
    .map((o) => o.ai_objective_score)
    .map((v) => num(v))
    .filter((v) => v > 0);
  const part2 =
    aiVals.length > 0
      ? Math.min(5, Math.max(...aiVals))
      : Math.min(5, Math.max(0, params.directionScore / 2));

  const n = params.linkedObjectives.length;
  const additionalCount = Math.max(0, n - 1);
  const cappedAdditional = Math.min(4, additionalCount);
  const part3 = Math.min(2, 0.5 * cappedAdditional);

  const part4 = num(params.challengeScore);
  const raw = (part1 + part2 + part3) * part4;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function statusTier(isGap: boolean, score: number): ProgramMatrixCell["statusTier"] {
  if (isGap) return "gap";
  if (score >= 66) return "strong";
  if (score >= 40) return "medium";
  return "weak";
}

function buildExplanation(p: {
  isGap: boolean;
  isLinked: boolean;
  part1: number;
  part2: number;
  part2FromAi: boolean;
  part3: number;
  part4: number;
  contributionLabel: string | null;
}): string {
  const parts: string[] = [];
  if (p.isGap) {
    parts.push("Gap: keine Objectives an dieser Stossrichtung — Score 0.");
    return parts.join(" ");
  }
  parts.push(
    `Score = (max Wichtigkeit ${p.part1.toFixed(1)} + Sentinel ${p.part2.toFixed(2)}${p.part2FromAi ? " (KI)" : " (Fallback Direction/2)"} + weitere Objectives +${p.part3.toFixed(1)}) × Challenge-Score ${p.part4.toFixed(2)}.`
  );
  if (!p.isLinked) {
    parts.push("Hinweis: Herausforderung und Stossrichtung sind nicht als Vorgaenger verknuepft (ohne Einfluss auf die Zahl).");
  } else if (p.contributionLabel) {
    parts.push(`Verknuepfungs-Beitrag laut Matrix: ${p.contributionLabel}.`);
  }
  return parts.join(" ");
}

/**
 * Baut das Matrix-Modell: sortierte Zeilen (Directions nach Row-Summe DESC),
 * Spalten (Challenges nach Column-Summe DESC).
 */
export function buildProgramMatrix(input: BuildProgramMatrixInput): ProgramMatrixModel {
  const totalObjectives = Math.max(0, input.objectives.length);
  const objectiveById = new Map(input.objectives.map((o) => [o.id, o] as const));

  const objectiveIdsByDirection = new Map<string, string[]>();
  for (const link of input.directionObjectiveLinks) {
    const cur = objectiveIdsByDirection.get(link.strategic_direction_id) ?? [];
    cur.push(link.objective_id);
    objectiveIdsByDirection.set(link.strategic_direction_id, cur);
  }

  const contributionByPair = new Map<string, { weight: number; contribution: string | null }>();
  for (const link of input.challengeDirectionLinks) {
    const key = `${link.strategic_challenge_id}:${link.strategic_direction_id}`;
    const c = String(link.contribution_level ?? "medium");
    contributionByPair.set(key, { weight: linkContributionWeight(c), contribution: c });
  }

  const challengeLinkCounts = new Map<string, number>();
  for (const link of input.challengeDirectionLinks) {
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

  const raw = new Map<string, Map<string, Omit<ProgramMatrixCell, "isTopInRow">>>();

  for (const direction of input.directions) {
    const row = new Map<string, Omit<ProgramMatrixCell, "isTopInRow">>();
    const dirObjIds = objectiveIdsByDirection.get(direction.id) ?? [];
    const linkedObjectives = dirObjIds
      .map((id) => objectiveById.get(id))
      .filter((o): o is ProgramMatrixObjective => Boolean(o));
    const objectiveCoverage =
      totalObjectives === 0 ? 0 : Math.min(1, linkedObjectives.length / totalObjectives);

    const directionScore = num(direction.direction_score);

    for (const challenge of input.challenges) {
      const pairKey = `${challenge.id}:${direction.id}`;
      const pairMeta = contributionByPair.get(pairKey);
      const isLinked = Boolean(pairMeta);
      const cw = pairMeta?.weight ?? 0;
      const challengeScore = num(challenge.challenge_score);

      const isGap = linkedObjectives.length === 0;

      const part1 = isGap
        ? 0
        : Math.max(...linkedObjectives.map((o) => num(o.importance_score ?? 3)), 0);
      const aiVals = linkedObjectives
        .map((o) => o.ai_objective_score)
        .map((v) => num(v))
        .filter((v) => v > 0);
      const part2FromAi = aiVals.length > 0;
      const part2 = isGap
        ? 0
        : part2FromAi
          ? Math.min(5, Math.max(...aiVals))
          : Math.min(5, Math.max(0, directionScore / 2));
      const n = linkedObjectives.length;
      const part3 = isGap ? 0 : Math.min(2, 0.5 * Math.min(4, Math.max(0, n - 1)));
      const part4 = challengeScore;

      const score = computeCellScore({
        linkedObjectives,
        directionScore,
        challengeScore,
        isGap,
      });

      const st = statusTier(isGap, score);
      const contribLabel = !isLinked
        ? null
        : cw === 3
          ? "hoch"
          : cw === 1
            ? "niedrig"
            : "mittel";

      const cell: Omit<ProgramMatrixCell, "isTopInRow"> = {
        challengeId: challenge.id,
        directionId: direction.id,
        challengeTitle: challenge.title,
        directionTitle: direction.title,
        score,
        isGap,
        statusTier: st,
        linkedObjectives,
        objectiveCoverage,
        isLinked,
        contributionWeight: cw,
        overlapCount: 0,
        scoreExplanation: buildExplanation({
          isGap,
          isLinked,
          part1,
          part2,
          part2FromAi,
          part3,
          part4,
          contributionLabel: contribLabel,
        }),
      };
      row.set(challenge.id, cell);
    }
    raw.set(direction.id, row);
  }

  const columnSums = new Map<string, number>();
  for (const ch of input.challenges) columnSums.set(ch.id, 0);
  const rowSums = new Map<string, number>();
  for (const d of input.directions) rowSums.set(d.id, 0);

  for (const d of input.directions) {
    const row = raw.get(d.id);
    if (!row) continue;
    for (const ch of input.challenges) {
      const c = row.get(ch.id);
      if (!c) continue;
      rowSums.set(d.id, (rowSums.get(d.id) ?? 0) + c.score);
      columnSums.set(ch.id, (columnSums.get(ch.id) ?? 0) + c.score);
    }
  }

  const sortedDirections = [...input.directions].sort(
    (a, b) => (rowSums.get(b.id) ?? 0) - (rowSums.get(a.id) ?? 0)
  );
  const sortedChallenges = [...input.challenges].sort(
    (a, b) => (columnSums.get(b.id) ?? 0) - (columnSums.get(a.id) ?? 0)
  );

  const directionRows: ProgramMatrixDirectionRow[] = sortedDirections.map((direction) => {
    const rowMap = raw.get(direction.id)!;
    const cellsRaw = sortedChallenges.map((ch) => rowMap.get(ch.id)!);
    const maxScore = cellsRaw.length === 0 ? 0 : Math.max(...cellsRaw.map((c) => c.score));
    const cells: ProgramMatrixCell[] = cellsRaw.map((c) => ({
      ...c,
      isTopInRow: c.score === maxScore && maxScore >= 45,
    }));
    return {
      directionId: direction.id,
      directionTitle: direction.title,
      rowScoreSum: rowSums.get(direction.id) ?? 0,
      cells,
    };
  });

  /** Direkt aus gerenderten Zellen: Kopfzahl = gruene Ringe (formale Links), garantiert konsistent. */
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

  let matrixCriticalOverlapChallengeCount = 0;
  for (const col of challengeColumns) {
    if (col.addressingDirectionsCount >= 5) matrixCriticalOverlapChallengeCount += 1;
  }

  return {
    directionRows,
    challengeColumns,
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
