import type { StrategyReviewCoverageIndex } from "@/lib/strategy-review/execution-coverage";

export type StrategyReviewChainItem = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  /** identity_lifecycle_state oder abgeleiteter Status für Anzeige */
  lifecycleState?: string | null;
  ownerLabel?: string | null;
  priority?: string | number | null;
  /** Programm-Details (optional) */
  startDate?: string | null;
  endDate?: string | null;
  budgetTotal?: number | null;
  /** Aggregierter Fortschritt aus Initiativen (0–100), siehe v_program_overview */
  progressPercent?: number | null;
  initiativeCount?: number | null;
  initiativeActiveCount?: number | null;
};

export type StrategyReviewChainGapFlags = {
  missingChallenges: boolean;
  missingObjectives: boolean;
  missingPrograms: boolean;
  hasAnyGap: boolean;
};

export type StrategyReviewChainHub = {
  direction: StrategyReviewChainItem;
  challenges: StrategyReviewChainItem[];
  objectives: StrategyReviewChainItem[];
  programs: StrategyReviewChainItem[];
  gapFlags: StrategyReviewChainGapFlags;
  challengeCount: number;
  objectiveCount: number;
  programCount: number;
};

export type StrategyReviewChainBuildInput = {
  directions: StrategyReviewChainItem[];
  challenges: StrategyReviewChainItem[];
  objectives: StrategyReviewChainItem[];
  programs: Array<
    StrategyReviewChainItem & {
      strategic_direction_id: string | null;
    }
  >;
  challengeDirectionLinks: Array<{
    strategic_challenge_id: string;
    strategic_direction_id: string;
  }>;
  directionObjectiveLinks: Array<{
    strategic_direction_id: string;
    strategy_objective_id: string;
  }>;
};

export const STRATEGY_REVIEW_DIRECTION_FEEDBACK_OPTIONS = [
  { code: "decreasing_relevance", label: "abnehmende Relevanz" },
  { code: "unchanged_relevance", label: "gleichbleibende Relevanz" },
  { code: "increasing_relevance", label: "zunehmende Relevanz" },
] as const;

export const STRATEGY_REVIEW_CHAIN_THEMES = [
  {
    id: "challenges",
    label: "Handlungsbedarf",
    subjectType: "challenge",
    hint: "Strategische Begründung — Herausforderungen an der Stoßrichtung",
    options: [
      { code: "improved", label: "verbessert" },
      { code: "unchanged", label: "gleich" },
      { code: "worsened", label: "verschlechtert" },
    ],
  },
  {
    id: "directions",
    label: "Stoßrichtungen",
    subjectType: "focus_area",
    hint: "Wie hat sich die strategische Relevanz der Stoßrichtung entwickelt?",
    options: [...STRATEGY_REVIEW_DIRECTION_FEEDBACK_OPTIONS],
  },
  {
    id: "objectives",
    label: "Ziele",
    subjectType: "objective",
    hint: "Wie hat sich die strategische Bedeutung des Ziels entwickelt?",
    options: [
      { code: "less_important", label: "unwichtiger" },
      { code: "unchanged", label: "gleich" },
      { code: "more_important", label: "wichtiger" },
    ],
  },
  {
    id: "programs",
    label: "Programme",
    subjectType: "program",
    hint: "Wie tragfähig ist das Programm als Umsetzungsvehikel?",
    options: [
      { code: "on_track", label: "Programm zielführend" },
      { code: "needs_adjustment", label: "Programm benötigt Anpassung" },
      { code: "no_foundation", label: "Programm hat keine Grundlage mehr" },
    ],
  },
] as const;

export type StrategyReviewChainThemeId = (typeof STRATEGY_REVIEW_CHAIN_THEMES)[number]["id"];

/** Archivierte / stillgelegte Objekte gehören nicht in Review-Grafik oder Listen. */
export function isArchivedStrategyReviewItem(item: StrategyReviewChainItem): boolean {
  const raw = (item.lifecycleState ?? item.status ?? "").trim().toLowerCase();
  return raw === "archived" || raw === "retired";
}

function withoutArchived(items: StrategyReviewChainItem[]): StrategyReviewChainItem[] {
  return items.filter((item) => !isArchivedStrategyReviewItem(item));
}

export function collectThemeItems(
  hubs: StrategyReviewChainHub[],
  themeId: StrategyReviewChainThemeId,
  catalogs?: Partial<Record<"challenges" | "objectives" | "programs", StrategyReviewChainItem[]>>
): StrategyReviewChainItem[] {
  if (themeId === "objectives" && catalogs?.objectives) {
    return withoutArchived([...catalogs.objectives]).sort((a, b) =>
      a.title.localeCompare(b.title, "de")
    );
  }
  if (themeId === "challenges" && catalogs?.challenges) {
    return withoutArchived([...catalogs.challenges]).sort((a, b) =>
      a.title.localeCompare(b.title, "de")
    );
  }
  if (themeId === "programs" && catalogs?.programs) {
    return withoutArchived([...catalogs.programs]).sort((a, b) =>
      a.title.localeCompare(b.title, "de")
    );
  }

  const map = new Map<string, StrategyReviewChainItem>();
  for (const hub of hubs) {
    if (themeId === "directions" && isArchivedStrategyReviewItem(hub.direction)) continue;

    const list =
      themeId === "challenges"
        ? hub.challenges
        : themeId === "objectives"
          ? hub.objectives
          : themeId === "programs"
            ? hub.programs
            : [hub.direction];
    for (const item of list) {
      if (isArchivedStrategyReviewItem(item)) continue;
      if (!map.has(item.id)) map.set(item.id, item);
    }
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, "de"));
}

export function themeCounts(
  hubs: StrategyReviewChainHub[],
  catalogs?: Partial<Record<"challenges" | "objectives" | "programs", StrategyReviewChainItem[]>>
): Record<StrategyReviewChainThemeId, number> {
  return {
    challenges: collectThemeItems(hubs, "challenges", catalogs).length,
    directions: collectThemeItems(hubs, "directions", catalogs).length,
    objectives: collectThemeItems(hubs, "objectives", catalogs).length,
    programs: collectThemeItems(hubs, "programs", catalogs).length,
  };
}

export type ChainOpenEndStat = {
  count: number;
  /** Kurztext in der Kachel, z. B. „ohne Umsetzungsplan“ */
  shortLabel: string;
  /** Volltext, z. B. „5 Ziele ohne Umsetzungsplan“ */
  fullLabel: string;
};

export type ChainLifecycleBucket = {
  key: string;
  label: string;
  count: number;
};

const LIFECYCLE_LABELS: Record<string, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  inactive: "Inaktiv",
  retired: "Stillgelegt",
  archived: "Archiviert",
  planned: "Geplant",
  on_hold: "Pausiert",
  closed: "Geschlossen",
  completed: "Abgeschlossen",
};

export function chainItemLifecycleLabel(item: StrategyReviewChainItem): string {
  const raw = (item.lifecycleState ?? item.status ?? "").trim().toLowerCase();
  if (!raw) return "Unbekannt";
  return LIFECYCLE_LABELS[raw] ?? raw;
}

/** Badge-Farben für Lifecycle in der Vorab-/Feedback-Liste. */
export function chainItemLifecycleBadgeClass(item: StrategyReviewChainItem): string {
  const raw = (item.lifecycleState ?? item.status ?? "").trim().toLowerCase();
  if (raw === "active" || raw === "approved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (raw === "draft" || raw === "planned") {
    return "border-zinc-300 bg-zinc-50 text-zinc-700";
  }
  if (raw === "on_hold" || raw === "paused" || raw === "at_risk") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
  if (raw === "retired" || raw === "archived" || raw === "inactive" || raw === "closed") {
    return "border-zinc-400 bg-zinc-100 text-zinc-600";
  }
  if (raw === "completed") {
    return "border-indigo-300 bg-indigo-50 text-indigo-900";
  }
  return "border-zinc-300 bg-zinc-50 text-zinc-700";
}

export function summarizeLifecycle(
  items: StrategyReviewChainItem[]
): ChainLifecycleBucket[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = (item.lifecycleState ?? item.status ?? "unknown").trim().toLowerCase() || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: LIFECYCLE_LABELS[key] ?? (key === "unknown" ? "Unbekannt" : key),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "de"));
}

/**
 * Lose Enden der Kette: fehlende Verbindung zur nächsten Hierarchie-Stufe.
 * Ziele ohne Umsetzungsplan = kein Pfad Ziel→Stoßrichtung→Programm.
 * Programme ohne Jahresziele und ohne Initiativen = nicht unterstützt.
 */
export function computeThemeOpenEnds(
  hubs: StrategyReviewChainHub[],
  catalogs?: Partial<Record<"challenges" | "objectives" | "programs", StrategyReviewChainItem[]>>,
  coverage?: StrategyReviewCoverageIndex | null
): Record<StrategyReviewChainThemeId, ChainOpenEndStat | null> {
  const objectiveIdsWithProgramPath = new Set<string>();
  const linkedObjectiveIds = new Set<string>();
  const linkedChallengeIds = new Set<string>();
  for (const hub of hubs) {
    for (const o of hub.objectives) linkedObjectiveIds.add(o.id);
    for (const c of hub.challenges) linkedChallengeIds.add(c.id);
    if (hub.programCount > 0) {
      for (const o of hub.objectives) objectiveIdsWithProgramPath.add(o.id);
    }
  }

  const allObjectives = catalogs?.objectives ?? collectThemeItems(hubs, "objectives");
  const objectivesOhnePlan = allObjectives.filter((o) => !objectiveIdsWithProgramPath.has(o.id));
  const objectivesOhneDirection = allObjectives.filter((o) => !linkedObjectiveIds.has(o.id));

  const allChallenges = catalogs?.challenges ?? collectThemeItems(hubs, "challenges");
  const challengesOhneDirection = allChallenges.filter((c) => !linkedChallengeIds.has(c.id));

  const directionsOhneProgramm = hubs.filter((h) => h.gapFlags.missingPrograms);

  const allPrograms = catalogs?.programs ?? collectThemeItems(hubs, "programs");
  const programsOhneDirection = allPrograms.filter((p) => {
    return !hubs.some((h) => h.programs.some((hp) => hp.id === p.id));
  });
  const programsUnsupported = allPrograms.filter((p) =>
    isProgramUnsupportedByCoverage(coverage, p.id)
  );

  const objectivesOpen =
    objectivesOhnePlan.length > 0
      ? {
          count: objectivesOhnePlan.length,
          shortLabel: "ohne Umsetzungsplan",
          fullLabel: `${objectivesOhnePlan.length} Ziel${objectivesOhnePlan.length === 1 ? "" : "e"} ohne Umsetzungsplan`,
        }
      : objectivesOhneDirection.length > 0
        ? {
            count: objectivesOhneDirection.length,
            shortLabel: "ohne Stoßrichtung",
            fullLabel: `${objectivesOhneDirection.length} Ziel${objectivesOhneDirection.length === 1 ? "" : "e"} ohne Stoßrichtung`,
          }
        : null;

  const programsOpen =
    programsUnsupported.length > 0
      ? {
          count: programsUnsupported.length,
          shortLabel: "nicht unterstützt",
          fullLabel: `${programsUnsupported.length} Programm${programsUnsupported.length === 1 ? "" : "e"} ohne Jahresziele/Initiativen (nicht unterstützt)`,
        }
      : programsOhneDirection.length > 0
        ? {
            count: programsOhneDirection.length,
            shortLabel: "ohne Stoßrichtung",
            fullLabel: `${programsOhneDirection.length} Programm${programsOhneDirection.length === 1 ? "" : "e"} ohne Stoßrichtung`,
          }
        : null;

  return {
    objectives: objectivesOpen,
    challenges:
      challengesOhneDirection.length > 0
        ? {
            count: challengesOhneDirection.length,
            shortLabel: "ohne Stoßrichtung",
            fullLabel: `${challengesOhneDirection.length} Handlungsbedarf ohne Stoßrichtung`,
          }
        : null,
    directions:
      directionsOhneProgramm.length > 0
        ? {
            count: directionsOhneProgramm.length,
            shortLabel: "ohne Programm",
            fullLabel: `${directionsOhneProgramm.length} Stoßrichtung${directionsOhneProgramm.length === 1 ? "" : "en"} ohne Programm`,
          }
        : null,
    programs: programsOpen,
  };
}

/** Programm ohne Jahresziele und ohne Initiativen = nicht unterstützt. */
export function isProgramUnsupportedByCoverage(
  coverage: StrategyReviewCoverageIndex | null | undefined,
  programId: string
): boolean {
  if (!coverage) return false;
  const c = coverage.program[programId];
  const annualTargetCount = c?.annualTargetCount ?? 0;
  const initiativeCount = c?.initiativeCount ?? 0;
  return annualTargetCount <= 0 && initiativeCount <= 0;
}

export type StrategyReviewDirectionFeedbackRating =
  (typeof STRATEGY_REVIEW_DIRECTION_FEEDBACK_OPTIONS)[number]["code"];

export function strategyReviewDirectionFeedbackLabel(rating: string | null | undefined): string {
  if (!rating) return "Noch kein Feedback";
  const found = STRATEGY_REVIEW_DIRECTION_FEEDBACK_OPTIONS.find((o) => o.code === rating);
  if (found) return found.label;
  switch (rating) {
    case "high_impact":
      return "hohe Wirkung";
    case "medium_impact":
      return "mittlere Wirkung";
    case "low_impact":
      return "geringe Wirkung";
    case "negative_impact":
      return "negative Wirkung";
    case "improved":
      return "verbessert";
    case "unchanged":
      return "gleich";
    case "worsened":
      return "verschlechtert";
    case "less_important":
      return "unwichtiger";
    case "more_important":
      return "wichtiger";
    case "decreasing_relevance":
      return "abnehmende Relevanz";
    case "unchanged_relevance":
      return "gleichbleibende Relevanz";
    case "increasing_relevance":
      return "zunehmende Relevanz";
    case "on_track":
      return "Programm zielführend";
    case "needs_adjustment":
      return "Programm benötigt Anpassung";
    case "no_foundation":
      return "Programm hat keine Grundlage mehr";
    case "keep":
      return "beibehalten";
    case "sharpen":
      return "schärfen";
    case "questionable":
      return "fraglich";
    case "continue":
      return "Fortsetzen";
    case "adjust":
      return "Anpassen";
    case "stop":
      return "Stoppen";
    case "escalate":
      return "Eskalieren";
    default:
      return rating;
  }
}

export function gapHintsForHub(hub: StrategyReviewChainHub): string[] {
  const hints: string[] = [];
  if (hub.gapFlags.missingChallenges) {
    hints.push("Keine Herausforderung verknüpft: strategische Begründung prüfen.");
  }
  if (hub.gapFlags.missingObjectives) {
    hints.push("Kein Ziel verknüpft: gewünschte Wirkung prüfen.");
  }
  if (hub.gapFlags.missingPrograms) {
    hints.push("Kein Programm verknüpft: Change-Anschluss prüfen.");
  }
  return hints;
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

export function buildStrategyReviewChainHubs(
  input: StrategyReviewChainBuildInput
): StrategyReviewChainHub[] {
  const challengesById = byId(withoutArchived(input.challenges));
  const objectivesById = byId(withoutArchived(input.objectives));
  const activeDirections = withoutArchived(input.directions);

  const challengeIdsByDirection = new Map<string, string[]>();
  for (const link of input.challengeDirectionLinks) {
    const list = challengeIdsByDirection.get(link.strategic_direction_id) ?? [];
    list.push(link.strategic_challenge_id);
    challengeIdsByDirection.set(link.strategic_direction_id, list);
  }

  const objectiveIdsByDirection = new Map<string, string[]>();
  for (const link of input.directionObjectiveLinks) {
    const list = objectiveIdsByDirection.get(link.strategic_direction_id) ?? [];
    list.push(link.strategy_objective_id);
    objectiveIdsByDirection.set(link.strategic_direction_id, list);
  }

  const programsByDirection = new Map<string, StrategyReviewChainItem[]>();
  for (const program of input.programs) {
    if (!program.strategic_direction_id) continue;
    if (isArchivedStrategyReviewItem(program)) continue;
    const list = programsByDirection.get(program.strategic_direction_id) ?? [];
    list.push({
      id: program.id,
      title: program.title,
      description: program.description,
      status: program.status,
      lifecycleState: program.lifecycleState,
      ownerLabel: program.ownerLabel,
      startDate: program.startDate,
      endDate: program.endDate,
      budgetTotal: program.budgetTotal,
      progressPercent: program.progressPercent,
      initiativeCount: program.initiativeCount,
      initiativeActiveCount: program.initiativeActiveCount,
    });
    programsByDirection.set(program.strategic_direction_id, list);
  }

  return activeDirections
    .map((direction) => {
      const challengeIds = [...new Set(challengeIdsByDirection.get(direction.id) ?? [])];
      const objectiveIds = [...new Set(objectiveIdsByDirection.get(direction.id) ?? [])];
      const challenges = challengeIds
        .map((id) => challengesById.get(id))
        .filter((x): x is StrategyReviewChainItem => Boolean(x));
      const objectives = objectiveIds
        .map((id) => objectivesById.get(id))
        .filter((x): x is StrategyReviewChainItem => Boolean(x));
      const programs = programsByDirection.get(direction.id) ?? [];

      const missingChallenges = challenges.length === 0;
      const missingObjectives = objectives.length === 0;
      const missingPrograms = programs.length === 0;

      return {
        direction,
        challenges,
        objectives,
        programs,
        gapFlags: {
          missingChallenges,
          missingObjectives,
          missingPrograms,
          hasAnyGap: missingChallenges || missingObjectives || missingPrograms,
        },
        challengeCount: challenges.length,
        objectiveCount: objectives.length,
        programCount: programs.length,
      };
    })
    .sort((a, b) => a.direction.title.localeCompare(b.direction.title, "de"));
}

/** IDs der Herausforderungen, die an mindestens einer Stoßrichtung hängen. */
export function linkedChallengeIdsFromHubs(hubs: StrategyReviewChainHub[]): Set<string> {
  const ids = new Set<string>();
  for (const hub of hubs) {
    for (const c of hub.challenges) ids.add(c.id);
  }
  return ids;
}

export function isChallengeWithoutDirection(
  hubs: StrategyReviewChainHub[],
  challengeId: string
): boolean {
  return !linkedChallengeIdsFromHubs(hubs).has(challengeId);
}

/** Stoßrichtungen, die mit einem Handlungsbedarf verknüpft sind. */
export function directionsLinkedToChallenge(
  hubs: StrategyReviewChainHub[],
  challengeId: string
): StrategyReviewChainItem[] {
  const out: StrategyReviewChainItem[] = [];
  const seen = new Set<string>();
  for (const hub of hubs) {
    if (hub.challenges.some((c) => c.id === challengeId) && !seen.has(hub.direction.id)) {
      seen.add(hub.direction.id);
      out.push(hub.direction);
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, "de"));
}

function asChainItemsFromUnknown(v: unknown): StrategyReviewChainItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .filter((x) => typeof x.id === "string")
    .map((x) => ({
      id: x.id as string,
      title: typeof x.title === "string" ? x.title : "Ohne Titel",
      description: typeof x.description === "string" ? x.description : null,
      status: typeof x.status === "string" ? x.status : null,
      lifecycleState:
        typeof x.identity_lifecycle_state === "string"
          ? x.identity_lifecycle_state
          : typeof x.lifecycle_state === "string"
            ? x.lifecycle_state
            : typeof x.status === "string"
              ? x.status
              : null,
      ownerLabel: typeof x.owner_label === "string" ? x.owner_label : null,
      priority: (x.priority as string | number | null | undefined) ?? null,
    }));
}

/** Alle Challenges aus dem Pre-Read (inkl. ohne Stoßrichtung; ohne Archiviert/Stillgelegt). */
export function extractPreReadChallenges(
  payload: Record<string, unknown> | null | undefined
): StrategyReviewChainItem[] {
  if (!payload) return [];
  return withoutArchived(asChainItemsFromUnknown(payload.challenges));
}

export function preReadPayloadHasChainLinks(payload: Record<string, unknown>): boolean {
  const links = payload.links;
  if (!links || typeof links !== "object") return false;
  const l = links as Record<string, unknown>;
  return Array.isArray(l.challenge_direction) || Array.isArray(l.direction_objective);
}

/** Baut Hubs aus einem pre_read_payload (neu oder Legacy ohne Links). */
export function buildStrategyReviewChainHubsFromPayload(
  payload: Record<string, unknown>
): StrategyReviewChainHub[] {
  const asItems = (v: unknown): StrategyReviewChainItem[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
      .filter((x) => typeof x.id === "string")
      .map((x) => ({
        id: x.id as string,
        title: typeof x.title === "string" ? x.title : "Ohne Titel",
        description: typeof x.description === "string" ? x.description : null,
        status: typeof x.status === "string" ? x.status : null,
        lifecycleState:
          typeof x.identity_lifecycle_state === "string"
            ? x.identity_lifecycle_state
            : typeof x.lifecycle_state === "string"
              ? x.lifecycle_state
              : typeof x.status === "string"
                ? x.status
                : null,
        ownerLabel: typeof x.owner_label === "string" ? x.owner_label : null,
        priority: (x.priority as string | number | null | undefined) ?? null,
      }));
  };

  const links = (
    payload.links && typeof payload.links === "object"
      ? (payload.links as Record<string, unknown>)
      : {}
  ) as Record<string, unknown>;

  const challengeDirectionLinks = Array.isArray(links.challenge_direction)
    ? (links.challenge_direction as Array<Record<string, unknown>>)
        .filter(
          (l) =>
            typeof l.strategic_challenge_id === "string" &&
            typeof l.strategic_direction_id === "string"
        )
        .map((l) => ({
          strategic_challenge_id: l.strategic_challenge_id as string,
          strategic_direction_id: l.strategic_direction_id as string,
        }))
    : [];

  const directionObjectiveLinks = Array.isArray(links.direction_objective)
    ? (links.direction_objective as Array<Record<string, unknown>>)
        .filter(
          (l) =>
            typeof l.strategic_direction_id === "string" &&
            (typeof l.strategy_objective_id === "string" || typeof l.objective_id === "string")
        )
        .map((l) => ({
          strategic_direction_id: l.strategic_direction_id as string,
          strategy_objective_id: (l.strategy_objective_id ?? l.objective_id) as string,
        }))
    : [];

  const programsRaw = Array.isArray(payload.programs) ? payload.programs : [];
  const programs = programsRaw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .filter((x) => typeof x.id === "string")
    .map((x) => ({
      id: x.id as string,
      title: typeof x.title === "string" ? x.title : "Ohne Titel",
      description: typeof x.description === "string" ? x.description : null,
      status: typeof x.status === "string" ? x.status : null,
      lifecycleState: typeof x.status === "string" ? x.status : null,
      ownerLabel: typeof x.owner_label === "string" ? x.owner_label : null,
      strategic_direction_id:
        typeof x.strategic_direction_id === "string" ? x.strategic_direction_id : null,
      startDate: typeof x.start_date === "string" ? x.start_date : null,
      endDate: typeof x.end_date === "string" ? x.end_date : null,
      budgetTotal:
        typeof x.budget_total === "number"
          ? x.budget_total
          : typeof x.budget_total === "string" && x.budget_total.trim() !== ""
            ? Number(x.budget_total)
            : null,
      progressPercent:
        typeof x.progress_percent === "number"
          ? x.progress_percent
          : typeof x.progress_percent === "string" && x.progress_percent.trim() !== ""
            ? Number(x.progress_percent)
            : null,
      initiativeCount:
        typeof x.initiative_count === "number"
          ? x.initiative_count
          : typeof x.initiative_count === "string"
            ? Number(x.initiative_count)
            : null,
      initiativeActiveCount:
        typeof x.initiative_active_count === "number"
          ? x.initiative_active_count
          : typeof x.initiative_active_count === "string"
            ? Number(x.initiative_active_count)
            : null,
    }));

  return buildStrategyReviewChainHubs({
    directions: asItems(payload.focus_areas),
    challenges: asItems(payload.challenges),
    objectives: asItems(payload.objectives),
    programs,
    challengeDirectionLinks,
    directionObjectiveLinks,
  });
}
