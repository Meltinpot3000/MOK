import { isActiveExecutionInitiativeStatus } from "./initiative-review-fields";
import { deriveInitiativeHealth } from "./initiative-health";
import type { ReviewAttentionItem } from "./review-attention-rules";
import type { DirectionReviewStatus, EnrichedStrategicDirectionReviewSummary } from "./review-direction-status";
import { primaryCoverageTypeLabelDe } from "./review-direction-status";
import type { ReviewCycleInitiativeInput } from "./review-cycle-view-model";
import type { OverviewDrillTable } from "@/lib/strategy-cycle/overview-drill-tables";

type ProgramBrief = {
  id: string;
  title: string;
  strategic_direction_id: string | null;
  status: string;
};

type AnnualTargetBrief = {
  id: string;
  strategic_direction_id: string;
  title: string;
  progress_percent: number;
};

type FeedbackBrief = {
  id: string;
  feedback_type: string;
  object_type: string;
  object_id: string;
  comment: string | null;
};

type KeyResultBrief = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  objective_id: string;
};

export type ReviewLagebildDrillId =
  | "directions"
  | "programs"
  | "annual-targets"
  | "initiatives"
  | "content-progress"
  | "time-progress"
  | "delta"
  | "status-on-track"
  | "status-at-risk"
  | "status-off-track"
  | "status-no-coverage"
  | "status-unclear"
  | "without-execution"
  | "open-signals"
  | "initiative-signals"
  | "overdue-reviews"
  | "strategy-impulses"
  | "overdue-deadlines";

export type ReviewLagebildDrillTables = Record<ReviewLagebildDrillId, OverviewDrillTable>;

function cell(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function formatDeDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const DIRECTION_STATUS_LABELS: Record<DirectionReviewStatus, string> = {
  on_track: "Auf Kurs",
  at_risk: "Gefährdet",
  off_track: "Kritisch",
  no_coverage: "Keine operative Abdeckung",
  unclear: "Unklar",
};

const INITIATIVE_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  planned: "Geplant",
  active: "Aktiv",
  at_risk: "Auffällig",
  on_hold: "Pausiert",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

const HEALTH_LABELS = {
  on_track: "Auf Kurs",
  at_risk: "Auffällig",
  off_track: "Kritisch",
} as const;

const PROGRAM_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  on_hold: "Pausiert",
  closed: "Abgeschlossen",
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

function directionTable(rows: EnrichedStrategicDirectionReviewSummary[]): OverviewDrillTable {
  return {
    columns: [
      { id: "title", label: "Stoßrichtung" },
      { id: "review_status", label: "Review-Status" },
      { id: "coverage", label: "Operative Abdeckung" },
      { id: "annual_targets", label: "Aktive JZ (Run/Change)" },
      { id: "programs", label: "Aktives Programm" },
      { id: "initiatives", label: "Initiativen" },
      { id: "okr", label: "OKR/KR" },
      { id: "progress", label: "Fortschritt" },
      { id: "last_review", label: "Letztes Review" },
    ],
    rows: rows.map((d) => {
      const c = d.coverage;
      const jzLabel =
        c.activeAnnualTargetCount > 0
          ? `${c.runAnnualTargetCount} Run / ${c.changeAnnualTargetCount} Change`
          : "0";
      return {
        id: d.directionId,
        href: "/reviews?tab=netzwerk",
        cells: {
          title: d.title,
          review_status: DIRECTION_STATUS_LABELS[d.reviewStatus] ?? d.reviewStatus,
          coverage: primaryCoverageTypeLabelDe(c),
          annual_targets: jzLabel,
          programs: c.programCoverage ? "Ja" : "Nein",
          initiatives: c.initiativeCoverage ? String(d.activeInitiativeCount) : "0",
          okr: c.okrCoverage ? "Ja" : "Nein",
          progress: d.directionProgress != null ? `${d.directionProgress}%` : "—",
          last_review: formatDeDateOnly(d.lastReviewUpdateAt),
        },
      };
    }),
  };
}

function initiativeTable(
  rows: ReviewCycleInitiativeInput[],
  directionNameById: Map<string, string>
): OverviewDrillTable {
  return {
    columns: [
      { id: "title", label: "Initiative" },
      { id: "status", label: "Status" },
      { id: "health", label: "Lagebild" },
      { id: "direction", label: "Stoßrichtung" },
      { id: "progress", label: "Fortschritt" },
      { id: "weight", label: "Gewicht" },
      { id: "owner", label: "Owner" },
    ],
    rows: rows.map((i) => ({
      id: i.id,
      href: "/reviews?tab=initiativen",
      cells: {
        title: i.title,
        status: INITIATIVE_STATUS_LABELS[i.status] ?? i.status,
        health: HEALTH_LABELS[deriveInitiativeHealth(i)],
        direction: i.directionId ? directionNameById.get(i.directionId) ?? "—" : "—",
        progress: `${i.progress_percent}%`,
        weight: String(i.weight),
        owner: i.owner_display_name ?? "—",
      },
    })),
  };
}

function attentionTable(items: ReviewAttentionItem[]): OverviewDrillTable {
  return {
    columns: [
      { id: "title", label: "Handlungsbedarf" },
      { id: "severity", label: "Schwere" },
      { id: "detail", label: "Detail" },
    ],
    rows: items.map((item) => ({
      id: item.id,
      href: item.initiativeId ? "/reviews?tab=initiativen" : "/reviews?tab=netzwerk",
      cells: {
        title: item.title,
        severity: SEVERITY_LABELS[item.severity] ?? item.severity,
        detail: item.detail,
      },
    })),
  };
}

export function buildReviewLagebildDrillTables(input: {
  enrichedSummaries: EnrichedStrategicDirectionReviewSummary[];
  initiativeRows: ReviewCycleInitiativeInput[];
  attentionItems: ReviewAttentionItem[];
  programs: ProgramBrief[];
  annualTargets: AnnualTargetBrief[];
  reviewFeedback: FeedbackBrief[];
  keyResults?: KeyResultBrief[];
  directionNameById: Record<string, string>;
  cycleStartsOn: string | null;
  cycleEndsOn: string | null;
  timeProgressPercent: number;
  weightedContentProgress: number | null;
  deltaPp: number | null;
}): ReviewLagebildDrillTables {
  const directionNameById = new Map(Object.entries(input.directionNameById));
  const activeDirections = input.enrichedSummaries.filter((d) => d.status === "active");
  const activeExecutionInitiatives = input.initiativeRows.filter((i) =>
    isActiveExecutionInitiativeStatus(i.status)
  );
  const now = new Date();

  const directionsByReviewStatus = (status: DirectionReviewStatus) =>
    activeDirections.filter((d) => d.reviewStatus === status);

  const overdueReviewItems = input.attentionItems.filter(
    (a) => a.issueType === "stale_review" || a.issueType === "never_reviewed"
  );

  const overdueInitiatives = activeExecutionInitiatives.filter(
    (i) => i.end_date && new Date(i.end_date) < now
  );

  const overdueKeyResults = (input.keyResults ?? []).filter((kr) => {
    if (!kr.due_date) return false;
    if (new Date(kr.due_date) >= now) return false;
    if (kr.status === "completed" || kr.status === "archived") return false;
    return true;
  });

  const contentProgressInitiatives = activeExecutionInitiatives.filter((i) => i.weight > 0);

  const deltaRows = activeExecutionInitiatives
    .map((i) => {
      const gap =
        input.weightedContentProgress != null
          ? i.progress_percent - input.timeProgressPercent
          : null;
      return { initiative: i, gap };
    })
    .sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0));

  return {
    directions: directionTable(activeDirections),
    programs: {
      columns: [
        { id: "title", label: "Programm" },
        { id: "status", label: "Status" },
        { id: "direction", label: "Stoßrichtung" },
      ],
      rows: input.programs.map((p) => ({
        id: p.id,
        href: "/strategy-cycle?l1=pips&l2=programme",
        cells: {
          title: p.title,
          status: PROGRAM_STATUS_LABELS[p.status] ?? p.status,
          direction: p.strategic_direction_id
            ? directionNameById.get(p.strategic_direction_id) ?? "—"
            : "—",
        },
      })),
    },
    "annual-targets": {
      columns: [
        { id: "title", label: "Jahresziel" },
        { id: "direction", label: "Stoßrichtung" },
        { id: "progress", label: "Fortschritt" },
      ],
      rows: input.annualTargets.map((t) => ({
        id: t.id,
        href: "/reviews?tab=netzwerk",
        cells: {
          title: t.title,
          direction: directionNameById.get(t.strategic_direction_id) ?? "—",
          progress: `${t.progress_percent}%`,
        },
      })),
    },
    initiatives: initiativeTable(input.initiativeRows, directionNameById),
    "content-progress": {
      columns: [
        { id: "title", label: "Initiative" },
        { id: "progress", label: "Fortschritt" },
        { id: "weight", label: "Gewicht" },
        { id: "contribution", label: "Anteil am Gesamt" },
      ],
      rows: contentProgressInitiatives.map((i) => {
        const weightSum = contentProgressInitiatives.reduce((s, r) => s + r.weight, 0);
        const share =
          weightSum > 0 ? Math.round((i.weight / weightSum) * 100) : 0;
        return {
          id: i.id,
          href: "/reviews?tab=initiativen",
          cells: {
            title: i.title,
            progress: `${i.progress_percent}%`,
            weight: String(i.weight),
            contribution: `${share}%`,
          },
        };
      }),
    },
    "time-progress": {
      columns: [
        { id: "title", label: "Bezug" },
        { id: "start", label: "Start" },
        { id: "end", label: "Ende" },
        { id: "progress", label: "Zeitfortschritt" },
      ],
      rows: [
        {
          id: "cycle",
          cells: {
            title: "Reviewzyklus (L2)",
            start: formatDeDateOnly(input.cycleStartsOn),
            end: formatDeDateOnly(input.cycleEndsOn),
            progress: `${input.timeProgressPercent}%`,
          },
        },
      ],
    },
    delta: {
      columns: [
        { id: "title", label: "Initiative" },
        { id: "progress", label: "Umsetzung" },
        { id: "time", label: "Zeitplan" },
        { id: "gap", label: "Abstand" },
      ],
      rows: deltaRows.map(({ initiative: i, gap }) => ({
        id: i.id,
        href: "/reviews?tab=initiativen",
        cells: {
          title: i.title,
          progress: `${i.progress_percent}%`,
          time: `${input.timeProgressPercent}%`,
          gap: gap != null ? `${gap >= 0 ? "+" : ""}${Math.round(gap)} PP` : "—",
        },
      })),
    },
    "status-on-track": directionTable(directionsByReviewStatus("on_track")),
    "status-at-risk": directionTable(directionsByReviewStatus("at_risk")),
    "status-off-track": directionTable(directionsByReviewStatus("off_track")),
    "status-no-coverage": directionTable(directionsByReviewStatus("no_coverage")),
    "status-unclear": directionTable(directionsByReviewStatus("unclear")),
    "without-execution": directionTable(
      activeDirections.filter((d) => !d.coverage.hasAnyCoverage)
    ),
    "open-signals": attentionTable(input.attentionItems),
    "initiative-signals": attentionTable(
      input.attentionItems.filter((a) => a.initiativeId !== null)
    ),
    "overdue-reviews": attentionTable(overdueReviewItems),
    "strategy-impulses": {
      columns: [
        { id: "title", label: "Typ" },
        { id: "object", label: "Bezug" },
        { id: "comment", label: "Kommentar" },
      ],
      rows: input.reviewFeedback.map((f) => ({
        id: f.id,
        href: "/reviews?tab=netzwerk",
        cells: {
          title: f.feedback_type,
          object: `${f.object_type} · ${f.object_id.slice(0, 8)}…`,
          comment: cell(f.comment),
        },
      })),
    },
    "overdue-deadlines": {
      columns: [
        { id: "kind", label: "Art" },
        { id: "title", label: "Titel" },
        { id: "due", label: "Fällig" },
        { id: "status", label: "Status" },
        { id: "context", label: "Kontext" },
      ],
      rows: [
        ...overdueInitiatives.map((i) => ({
          id: `init-${i.id}`,
          href: "/reviews?tab=initiativen",
          cells: {
            kind: "Initiative",
            title: i.title,
            due: formatDeDateOnly(i.end_date),
            status: INITIATIVE_STATUS_LABELS[i.status] ?? i.status,
            context: i.directionId
              ? directionNameById.get(i.directionId) ?? "—"
              : "—",
          },
        })),
        ...overdueKeyResults.map((kr) => ({
          id: `kr-${kr.id}`,
          href: "/okr",
          cells: {
            kind: "Key Result",
            title: kr.title,
            due: formatDeDateOnly(kr.due_date),
            status: kr.status,
            context: "OKR",
          },
        })),
      ],
    },
  };
}
