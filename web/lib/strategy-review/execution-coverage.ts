export type StrategyReviewExecutionCoverage = {
  programCount: number;
  annualTargetCount: number;
  initiativeCount: number;
  okrCount: number;
  programTitles: string[];
  annualTargetTitles: string[];
  initiativeTitles: string[];
  okrTitles: string[];
};

export type StrategyReviewCoverageIndex = {
  challenge: Record<string, StrategyReviewExecutionCoverage>;
  focus_area: Record<string, StrategyReviewExecutionCoverage>;
  objective: Record<string, StrategyReviewExecutionCoverage>;
  program: Record<string, StrategyReviewExecutionCoverage>;
};

type CoverageAcc = {
  programs: Map<string, string>;
  annualTargets: Map<string, string>;
  initiatives: Map<string, string>;
  okrs: Map<string, string>;
};

function emptyAcc(): CoverageAcc {
  return {
    programs: new Map(),
    annualTargets: new Map(),
    initiatives: new Map(),
    okrs: new Map(),
  };
}

export function emptyExecutionCoverage(): StrategyReviewExecutionCoverage {
  return {
    programCount: 0,
    annualTargetCount: 0,
    initiativeCount: 0,
    okrCount: 0,
    programTitles: [],
    annualTargetTitles: [],
    initiativeTitles: [],
    okrTitles: [],
  };
}

export function coverageHasAny(c: StrategyReviewExecutionCoverage | null | undefined): boolean {
  if (!c) return false;
  return (
    c.programCount > 0 ||
    c.annualTargetCount > 0 ||
    c.initiativeCount > 0 ||
    c.okrCount > 0
  );
}

export function coverageForSubject(
  index: StrategyReviewCoverageIndex | null | undefined,
  subjectType: "challenge" | "focus_area" | "objective" | "program",
  subjectId: string
): StrategyReviewExecutionCoverage {
  if (!index) return emptyExecutionCoverage();
  return index[subjectType][subjectId] ?? emptyExecutionCoverage();
}

function ensureAcc(map: Record<string, CoverageAcc>, id: string | null | undefined): CoverageAcc | null {
  if (!id) return null;
  const cur = map[id] ?? emptyAcc();
  map[id] = cur;
  return cur;
}

function addNamed(
  target: Map<string, string>,
  id: string | null | undefined,
  title: string | null | undefined
) {
  if (!id) return;
  if (!target.has(id)) target.set(id, (title ?? "").trim() || "Ohne Titel");
}

function sortTitles(map: Map<string, string>): string[] {
  return [...map.values()].sort((a, b) => a.localeCompare(b, "de"));
}

function finalizeAcc(acc: CoverageAcc): StrategyReviewExecutionCoverage {
  return {
    programCount: acc.programs.size,
    annualTargetCount: acc.annualTargets.size,
    initiativeCount: acc.initiatives.size,
    okrCount: acc.okrs.size,
    programTitles: sortTitles(acc.programs),
    annualTargetTitles: sortTitles(acc.annualTargets),
    initiativeTitles: sortTitles(acc.initiatives),
    okrTitles: sortTitles(acc.okrs),
  };
}

function finalizeIndex(
  challenge: Record<string, CoverageAcc>,
  focus_area: Record<string, CoverageAcc>,
  objective: Record<string, CoverageAcc>,
  program: Record<string, CoverageAcc>
): StrategyReviewCoverageIndex {
  const out: StrategyReviewCoverageIndex = {
    challenge: {},
    focus_area: {},
    objective: {},
    program: {},
  };
  for (const [id, acc] of Object.entries(challenge)) out.challenge[id] = finalizeAcc(acc);
  for (const [id, acc] of Object.entries(focus_area)) out.focus_area[id] = finalizeAcc(acc);
  for (const [id, acc] of Object.entries(objective)) out.objective[id] = finalizeAcc(acc);
  for (const [id, acc] of Object.entries(program)) out.program[id] = finalizeAcc(acc);
  return out;
}

/** Aggregiert Coverage inkl. Bezeichnungen aus Rohdaten (für Tests und Query-Layer). */
export function buildCoverageIndex(input: {
  programs: Array<{
    id: string;
    title?: string | null;
    strategic_direction_id: string | null;
    strategic_challenge_id?: string | null;
    supported_objective_ids?: string[] | null;
  }>;
  annualTargets: Array<{
    id: string;
    title?: string | null;
    strategic_direction_id: string | null;
    strategy_program_id: string | null;
  }>;
  initiatives: Array<{
    id: string;
    title?: string | null;
    program_id: string | null;
  }>;
  /** OKR-Objectives direkt an Strategy-Objectives */
  okrsByStrategyObjectiveId?: Record<string, Array<{ id: string; title: string }>>;
  /** OKR-Objectives über Jahresziele */
  okrsByAnnualTargetId?: Record<string, Array<{ id: string; title: string }>>;
  /** @deprecated nutze okrsByStrategyObjectiveId */
  okrCountByStrategyObjectiveId?: Record<string, number>;
  /** @deprecated nutze okrsByAnnualTargetId */
  okrCountByAnnualTargetId?: Record<string, number>;
  directionObjectiveLinks: Array<{
    strategic_direction_id: string;
    strategy_objective_id: string;
  }>;
  challengeDirectionLinks?: Array<{
    strategic_challenge_id: string;
    strategic_direction_id: string;
  }>;
}): StrategyReviewCoverageIndex {
  const challenge: Record<string, CoverageAcc> = {};
  const focus_area: Record<string, CoverageAcc> = {};
  const objective: Record<string, CoverageAcc> = {};
  const program: Record<string, CoverageAcc> = {};

  const programById = new Map(input.programs.map((p) => [p.id, p]));
  const objectivesByDirection = new Map<string, string[]>();
  for (const link of input.directionObjectiveLinks) {
    const list = objectivesByDirection.get(link.strategic_direction_id) ?? [];
    list.push(link.strategy_objective_id);
    objectivesByDirection.set(link.strategic_direction_id, list);
  }

  const challengeIdsByDirection = new Map<string, string[]>();
  for (const link of input.challengeDirectionLinks ?? []) {
    const list = challengeIdsByDirection.get(link.strategic_direction_id) ?? [];
    list.push(link.strategic_challenge_id);
    challengeIdsByDirection.set(link.strategic_direction_id, list);
  }

  const withChallengesViaDirection = (
    directionId: string | null | undefined,
    fn: (acc: CoverageAcc) => void
  ) => {
    if (!directionId) return;
    for (const challengeId of challengeIdsByDirection.get(directionId) ?? []) {
      const acc = ensureAcc(challenge, challengeId);
      if (acc) fn(acc);
    }
  };

  for (const p of input.programs) {
    const title = p.title ?? null;
    const addProgram = (acc: CoverageAcc) => addNamed(acc.programs, p.id, title);

    const fa = ensureAcc(focus_area, p.strategic_direction_id);
    if (fa) addProgram(fa);
    withChallengesViaDirection(p.strategic_direction_id, addProgram);

    if (
      p.strategic_challenge_id &&
      !(
        p.strategic_direction_id &&
        (challengeIdsByDirection.get(p.strategic_direction_id) ?? []).includes(
          p.strategic_challenge_id
        )
      )
    ) {
      const ca = ensureAcc(challenge, p.strategic_challenge_id);
      if (ca) addProgram(ca);
    }

    const pa = ensureAcc(program, p.id);
    if (pa) addProgram(pa);

    const supported = new Set(p.supported_objective_ids ?? []);
    for (const oid of supported) {
      const oa = ensureAcc(objective, oid);
      if (oa) addProgram(oa);
    }
    if (p.strategic_direction_id) {
      for (const oid of objectivesByDirection.get(p.strategic_direction_id) ?? []) {
        if (supported.has(oid)) continue;
        const oa = ensureAcc(objective, oid);
        if (oa) addProgram(oa);
      }
    }
  }

  for (const at of input.annualTargets) {
    const title = at.title ?? null;
    const addAt = (acc: CoverageAcc) => addNamed(acc.annualTargets, at.id, title);

    const fa = ensureAcc(focus_area, at.strategic_direction_id);
    if (fa) addAt(fa);
    withChallengesViaDirection(at.strategic_direction_id, addAt);

    const pa = ensureAcc(program, at.strategy_program_id);
    if (pa) addAt(pa);

    if (at.strategic_direction_id) {
      for (const oid of objectivesByDirection.get(at.strategic_direction_id) ?? []) {
        const oa = ensureAcc(objective, oid);
        if (oa) addAt(oa);
      }
    }

    const prog = at.strategy_program_id ? programById.get(at.strategy_program_id) : null;
    if (
      prog?.strategic_challenge_id &&
      !(
        at.strategic_direction_id &&
        (challengeIdsByDirection.get(at.strategic_direction_id) ?? []).includes(
          prog.strategic_challenge_id
        )
      )
    ) {
      const ca = ensureAcc(challenge, prog.strategic_challenge_id);
      if (ca) addAt(ca);
    }
  }

  for (const init of input.initiatives) {
    const title = init.title ?? null;
    const addInit = (acc: CoverageAcc) => addNamed(acc.initiatives, init.id, title);

    const pa = ensureAcc(program, init.program_id);
    if (pa) addInit(pa);

    const prog = init.program_id ? programById.get(init.program_id) : null;
    if (prog) {
      const fa = ensureAcc(focus_area, prog.strategic_direction_id);
      if (fa) addInit(fa);
      withChallengesViaDirection(prog.strategic_direction_id, addInit);

      if (
        prog.strategic_challenge_id &&
        !(
          prog.strategic_direction_id &&
          (challengeIdsByDirection.get(prog.strategic_direction_id) ?? []).includes(
            prog.strategic_challenge_id
          )
        )
      ) {
        const ca = ensureAcc(challenge, prog.strategic_challenge_id);
        if (ca) addInit(ca);
      }

      const supported = new Set(prog.supported_objective_ids ?? []);
      const objectiveIds = new Set<string>(supported);
      if (prog.strategic_direction_id) {
        for (const oid of objectivesByDirection.get(prog.strategic_direction_id) ?? []) {
          objectiveIds.add(oid);
        }
      }
      for (const oid of objectiveIds) {
        const oa = ensureAcc(objective, oid);
        if (oa) addInit(oa);
      }
    }
  }

  const okrsByStrategy =
    input.okrsByStrategyObjectiveId ??
    Object.fromEntries(
      Object.entries(input.okrCountByStrategyObjectiveId ?? {}).map(([oid, n]) => [
        oid,
        Array.from({ length: n }, (_, i) => ({ id: `${oid}-okr-${i}`, title: `OKR ${i + 1}` })),
      ])
    );
  for (const [oid, okrs] of Object.entries(okrsByStrategy)) {
    const oa = ensureAcc(objective, oid);
    if (!oa) continue;
    for (const okr of okrs) addNamed(oa.okrs, okr.id, okr.title);
  }

  const okrsByAt =
    input.okrsByAnnualTargetId ??
    Object.fromEntries(
      Object.entries(input.okrCountByAnnualTargetId ?? {}).map(([atId, n]) => [
        atId,
        Array.from({ length: n }, (_, i) => ({
          id: `${atId}-okr-${i}`,
          title: `OKR ${i + 1}`,
        })),
      ])
    );
  const atById = new Map(input.annualTargets.map((a) => [a.id, a]));
  for (const [atId, okrs] of Object.entries(okrsByAt)) {
    const at = atById.get(atId);
    if (!at) continue;
    const addOkrs = (acc: CoverageAcc) => {
      for (const okr of okrs) addNamed(acc.okrs, okr.id, okr.title);
    };
    const fa = ensureAcc(focus_area, at.strategic_direction_id);
    if (fa) addOkrs(fa);
    withChallengesViaDirection(at.strategic_direction_id, addOkrs);
    const pa = ensureAcc(program, at.strategy_program_id);
    if (pa) addOkrs(pa);
    if (at.strategic_direction_id) {
      for (const oid of objectivesByDirection.get(at.strategic_direction_id) ?? []) {
        const oa = ensureAcc(objective, oid);
        if (oa) addOkrs(oa);
      }
    }
  }

  return finalizeIndex(challenge, focus_area, objective, program);
}

export function coverageTooltipLines(titles: string[], emptyLabel: string): string {
  if (titles.length === 0) return emptyLabel;
  return titles.join("\n");
}
