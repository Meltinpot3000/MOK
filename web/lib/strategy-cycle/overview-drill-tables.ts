import {
  formatStrategyObjectStandLabel,
  getOperationalSignalLabelDe,
  getReviewDecisionLabelDe,
} from "@/lib/strategy-objects";
import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects";
import type { ProgramOverviewViewRow } from "@/lib/strategy-cycle/queries";
import {
  descriptionQualityDisplayLabelDe,
  descriptionQualityListHref,
  type DescriptionQualityViewModel,
} from "@/lib/strategy-cycle/description-quality-view";

export type OverviewDrillColumn = { id: string; label: string };
export type OverviewDrillRow = { id: string; cells: Record<string, string>; href?: string };
export type OverviewDrillTable = { columns: OverviewDrillColumn[]; rows: OverviewDrillRow[] };

const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  environment: "Umfeldanalyse",
  company: "Unternehmensanalyse",
  competitor: "Wettbewerbsanalyse",
  swot: "SWOT",
  workshop: "Workshop",
  other: "Sonstige",
};

const PROGRAM_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Aktiv",
  on_hold: "On Hold",
  closed: "Abgeschlossen",
};

const INITIATIVE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  planned: "Geplant",
  active: "Aktiv",
  at_risk: "Auffaellig",
  on_hold: "On Hold",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

function cell(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function formatDeDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  const a = start ? formatDeDateOnly(start) : "";
  const b = end ? formatDeDateOnly(end) : "";
  if (a && b) return `${a} – ${b}`;
  if (a) return `ab ${a}`;
  if (b) return `bis ${b}`;
  return "—";
}

function formatChf(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

const DESCRIPTION_QUALITY_COLUMN: OverviewDrillColumn = {
  id: "description_quality",
  label: "Beschreibung / Prüfqualität",
};

export const OVERVIEW_DRILL_COLUMNS = {
  objectives: [
    { id: "title", label: "Titel" },
    { id: "time_horizon", label: "Zeithorizont" },
    { id: "importance_score", label: "Gewicht" },
    { id: "ai_objective_score", label: "Sentinel✨ Score" },
  ],
  analysisEntries: [
    { id: "title", label: "Titel" },
    { id: "analysis_type", label: "Bereich" },
    { id: "sub_type", label: "Sub-Typ" },
    { id: "impact_level", label: "Wirkung" },
    { id: "uncertainty_level", label: "Unsicherheit" },
    { id: "quality_score", label: "Qualität" },
    { id: "challenge", label: "Herausforderung" },
    { id: "directions", label: "Stoßrichtungen" },
  ],
  challenges: [
    { id: "title", label: "Titel" },
    { id: "challenge_score", label: "Herausforderungs-Score" },
    { id: "directions", label: "Stoßrichtungen" },
    { id: "impact_score", label: "Auswirkung" },
    { id: "urgency_score", label: "Dringlichkeit" },
  ],
  directions: [
    { id: "title", label: "Titel" },
    { id: "priority", label: "Priorität" },
    { id: "challenges", label: "Herausforderungen" },
    { id: "objectives", label: "Ziele" },
  ],
  programs: [
    { id: "title", label: "Programm" },
    { id: "status", label: "Status" },
    { id: "progress", label: "Fortschritt" },
    { id: "initiatives", label: "Initiativen" },
    { id: "owner", label: "Sponsor" },
    { id: "period", label: "Zeitraum" },
    { id: "budget", label: "Budget" },
  ],
  initiatives: [
    { id: "title", label: "Initiative" },
    { id: "status", label: "Status" },
    { id: "progress", label: "Fortschritt" },
    { id: "owner", label: "Owner" },
    { id: "program", label: "Programm" },
    { id: "priority", label: "Priorität" },
    { id: "period", label: "Zeitraum" },
  ],
} as const satisfies Record<string, OverviewDrillColumn[]>;

const VERSIONING_COLUMNS: OverviewDrillColumn[] = [
  { id: "versioning_stand", label: "Stand" },
  { id: "versioning_signal", label: "Lage" },
  { id: "versioning_review", label: "Review" },
];

type BuildOverviewDrillTablesInput = {
  objectives: Array<{
    id: string;
    title: string;
    time_horizon?: string | null;
    importance_score?: number | string | null;
    ai_objective_score?: number | string | null;
    versioning?: StrategyObjectVersioningMeta;
  }>;
  entries: Array<{
    id: string;
    title: string;
    analysis_type?: string | null;
    sub_type?: string | null;
    impact_level?: number | null;
    uncertainty_level?: number | null;
    quality_score?: number | null;
  }>;
  challenges: Array<{
    id: string;
    title: string;
    challenge_score?: number | string | null;
    impact_score?: number | null;
    urgency_score?: number | null;
    versioning?: StrategyObjectVersioningMeta;
  }>;
  directions: Array<{
    id: string;
    title: string;
    priority?: number | string | null;
    versioning?: StrategyObjectVersioningMeta;
  }>;
  programs: Array<{
    id: string;
    title: string;
    status?: string | null;
    owner_membership_id?: string | null;
    budget_total?: number | null;
    start_date?: string | null;
    end_date?: string | null;
  }>;
  initiatives: Array<{
    id: string;
    title: string;
    status?: string | null;
    priority?: number | null;
    program_id?: string | null;
    owner_membership_id?: string | null;
    progress_percent?: number | null;
    start_date?: string | null;
    end_date?: string | null;
  }>;
  directionCountByChallengeId: Record<string, number>;
  challengeIdsByDirection: Record<string, string[]>;
  objectiveIdsByDirection: Record<string, string[]>;
  promotedEntryIds: Set<string>;
  directionCountByEntryId: Record<string, number>;
  programOverviewById: Map<string, ProgramOverviewViewRow>;
  programTitleById: Record<string, string>;
  ownerLabelByMembershipId: Record<string, string>;
  descriptionQualityByChallengeId?: Record<string, DescriptionQualityViewModel>;
  descriptionQualityByDirectionId?: Record<string, DescriptionQualityViewModel>;
  descriptionQualityByObjectiveId?: Record<string, DescriptionQualityViewModel>;
};

function versioningCells(versioning?: StrategyObjectVersioningMeta): Record<string, string> {
  return {
    versioning_stand: formatStrategyObjectStandLabel(versioning),
    versioning_signal: getOperationalSignalLabelDe(versioning?.latest_operational_signal),
    versioning_review: getReviewDecisionLabelDe(versioning?.latest_review_decision),
  };
}

function descriptionQualityCell(
  quality: DescriptionQualityViewModel | undefined
): string {
  if (!quality) return "Keine Daten";
  return descriptionQualityDisplayLabelDe(quality.displayStatus);
}

function descriptionQualityRowHref(
  kind: "challenge" | "direction" | "objective",
  id: string,
  quality: DescriptionQualityViewModel | undefined
): string | undefined {
  if (!quality || quality.isAnalysable) return undefined;
  const qualityFilter =
    quality.displayStatus === "rework"
      ? ("rework" as const)
      : quality.displayStatus === "review"
        ? ("needs_work" as const)
        : undefined;
  return descriptionQualityListHref({
    l1: kind === "objective" ? "objectives" : "strategic-directions",
    l2: kind === "challenge" ? "challenges" : kind === "direction" ? "design" : undefined,
    objectId: id,
    qualityFilter,
  });
}

export function buildOverviewDrillTables(input: BuildOverviewDrillTablesInput): {
  objectives: OverviewDrillTable;
  analysisEntries: OverviewDrillTable;
  challenges: OverviewDrillTable;
  directions: OverviewDrillTable;
  programs: OverviewDrillTable;
  initiatives: OverviewDrillTable;
} {
  const objectivesRows: OverviewDrillRow[] = [...input.objectives]
    .sort((a, b) => a.title.localeCompare(b.title, "de"))
    .map((o) => {
      const quality = input.descriptionQualityByObjectiveId?.[o.id];
      return {
        id: o.id,
        href: descriptionQualityRowHref("objective", o.id, quality),
        cells: {
          title: o.title,
          time_horizon: cell(o.time_horizon),
          importance_score: cell(o.importance_score),
          ai_objective_score:
            o.ai_objective_score != null && Number.isFinite(Number(o.ai_objective_score))
              ? Number(o.ai_objective_score).toFixed(1)
              : "—",
          description_quality: descriptionQualityCell(quality),
          ...versioningCells(o.versioning),
        },
      };
    });

  const analysisRows: OverviewDrillRow[] = [...input.entries]
    .sort((a, b) => a.title.localeCompare(b.title, "de"))
    .map((e) => ({
      id: e.id,
      cells: {
        title: e.title,
        analysis_type: ANALYSIS_TYPE_LABELS[e.analysis_type ?? ""] ?? cell(e.analysis_type),
        sub_type: cell(e.sub_type),
        impact_level: e.impact_level != null ? `${e.impact_level}/5` : "—",
        uncertainty_level: e.uncertainty_level != null ? `${e.uncertainty_level}/5` : "—",
        quality_score: cell(e.quality_score),
        challenge: input.promotedEntryIds.has(e.id) ? "verknüpft" : "offen",
        directions: String(input.directionCountByEntryId[e.id] ?? 0),
      },
    }));

  const challengeRows: OverviewDrillRow[] = [...input.challenges]
    .sort((a, b) => Number(b.challenge_score ?? 0) - Number(a.challenge_score ?? 0))
    .map((c) => {
      const quality = input.descriptionQualityByChallengeId?.[c.id];
      return {
        id: c.id,
        href: descriptionQualityRowHref("challenge", c.id, quality),
        cells: {
          title: c.title,
          challenge_score:
            c.challenge_score != null ? Number(c.challenge_score).toFixed(2) : "—",
          directions: String(input.directionCountByChallengeId[c.id] ?? 0),
          impact_score: cell(c.impact_score),
          urgency_score: cell(c.urgency_score),
          description_quality: descriptionQualityCell(quality),
          ...versioningCells(c.versioning),
        },
      };
    });

  const directionRows: OverviewDrillRow[] = [...input.directions]
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0))
    .map((d) => {
      const quality = input.descriptionQualityByDirectionId?.[d.id];
      return {
        id: d.id,
        href: descriptionQualityRowHref("direction", d.id, quality),
        cells: {
          title: d.title,
          priority:
            d.priority != null && d.priority !== "" ? Number(d.priority).toFixed(2) : "—",
          challenges: String((input.challengeIdsByDirection[d.id] ?? []).length),
          objectives: String((input.objectiveIdsByDirection[d.id] ?? []).length),
          description_quality: descriptionQualityCell(quality),
          ...versioningCells(d.versioning),
        },
      };
    });

  const programRows: OverviewDrillRow[] = [...input.programs]
    .sort((a, b) => a.title.localeCompare(b.title, "de"))
    .map((p) => {
      const overview = input.programOverviewById.get(p.id);
      const ownerId = p.owner_membership_id ?? "";
      return {
        id: p.id,
        cells: {
          title: p.title,
          status: PROGRAM_STATUS_LABELS[String(p.status ?? "draft")] ?? cell(p.status),
          progress:
            overview?.progress_percent != null
              ? `${Math.round(Number(overview.progress_percent))}%`
              : "—",
          initiatives: String(overview?.initiative_count ?? 0),
          owner: ownerId ? (input.ownerLabelByMembershipId[ownerId] ?? ownerId) : "—",
          period: formatPeriod(p.start_date ?? null, p.end_date ?? null),
          budget: formatChf(p.budget_total ?? null),
        },
      };
    });

  const initiativeRows: OverviewDrillRow[] = [...input.initiatives]
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
    .map((i) => {
      const ownerId = i.owner_membership_id ?? "";
      const programId = i.program_id ?? "";
      return {
        id: i.id,
        cells: {
          title: i.title,
          status: INITIATIVE_STATUS_LABELS[String(i.status ?? "draft")] ?? cell(i.status),
          progress:
            i.progress_percent != null ? `${Math.round(Number(i.progress_percent))}%` : "—",
          owner: ownerId ? (input.ownerLabelByMembershipId[ownerId] ?? ownerId) : "—",
          program: programId ? (input.programTitleById[programId] ?? programId) : "—",
          priority: i.priority != null ? String(i.priority) : "—",
          period: formatPeriod(i.start_date ?? null, i.end_date ?? null),
        },
      };
    });

  return {
    objectives: {
      columns: [...OVERVIEW_DRILL_COLUMNS.objectives, DESCRIPTION_QUALITY_COLUMN, ...VERSIONING_COLUMNS],
      rows: objectivesRows,
    },
    analysisEntries: { columns: [...OVERVIEW_DRILL_COLUMNS.analysisEntries], rows: analysisRows },
    challenges: {
      columns: [...OVERVIEW_DRILL_COLUMNS.challenges, DESCRIPTION_QUALITY_COLUMN, ...VERSIONING_COLUMNS],
      rows: challengeRows,
    },
    directions: {
      columns: [...OVERVIEW_DRILL_COLUMNS.directions, DESCRIPTION_QUALITY_COLUMN, ...VERSIONING_COLUMNS],
      rows: directionRows,
    },
    programs: { columns: [...OVERVIEW_DRILL_COLUMNS.programs], rows: programRows },
    initiatives: { columns: [...OVERVIEW_DRILL_COLUMNS.initiatives], rows: initiativeRows },
  };
}
