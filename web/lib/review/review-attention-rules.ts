/**
 * Zentrale Attention-Regeln fuer den Reviewzyklus.
 * Kein Handlungsbedarf allein durch niedrigen Fortschritt (progress_percent / directionProgress).
 *
 * blockedInitiative: abgeleitetes Health `off_track` (kein eigener DB-Status „blocked“).
 */
import { deriveInitiativeHealth } from "./initiative-health";
import { isActiveExecutionInitiativeStatus } from "./initiative-review-fields";
import type { DirectionOperationalCoverage } from "./review-direction-status";
import type { ReviewCycleInitiativeInput, StrategicDirectionReviewSummary } from "./review-cycle-view-model";

export const REVIEW_ATTENTION_RULES = {
  blockedInitiative: true,
  atRiskInitiative: true,
  overdueInitiative: true,
  priorityDirectionWithoutActiveExecution: true,
  conflictingTargetDirections: true,
  unassignedDirection: true,
  missingOwner: true,
  staleUpdateDays: 30,
} as const;

export type AttentionSeverity = "high" | "medium" | "low";

export type ReviewAttentionItem = {
  id: string;
  issueType: string;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  directionId: string | null;
  initiativeId: string | null;
};

const PRIORITY_THRESHOLD = 2;

export function buildAttentionItems(
  initiativeRows: ReviewCycleInitiativeInput[],
  directionSummaries: StrategicDirectionReviewSummary[],
  directions: Array<{ id: string; title: string; status: string; priority: number }>,
  coverageByDirectionId?: Map<string, DirectionOperationalCoverage>
): ReviewAttentionItem[] {
  const items: ReviewAttentionItem[] = [];
  const now = new Date();
  const staleDays = REVIEW_ATTENTION_RULES.staleUpdateDays;
  const staleMs = staleDays * 24 * 60 * 60 * 1000;

  const summaryByDirectionId = new Map(directionSummaries.map((s) => [s.directionId, s]));

  for (const row of initiativeRows) {
    if (REVIEW_ATTENTION_RULES.conflictingTargetDirections && row.resolvedDirectionSource === "unresolved") {
      items.push({
        id: `conflict-${row.id}`,
        issueType: "conflicting_target_directions",
        severity: "medium",
        title: "Widersprüchliche Stoßrichtungen über Jahresziele",
        detail: `Initiative „${row.title}“ ist über mehrere Jahresziele unterschiedlichen Stoßrichtungen zugeordnet.`,
        directionId: null,
        initiativeId: row.id,
      });
    }

    if (REVIEW_ATTENTION_RULES.unassignedDirection && row.resolvedDirectionSource === "unassigned") {
      items.push({
        id: `unassigned-${row.id}`,
        issueType: "unassigned_direction",
        severity: "low",
        title: "Keine Stoßrichtung zuordenbar",
        detail: `Initiative „${row.title}“ hat kein Programm mit Stoßrichtung.`,
        directionId: null,
        initiativeId: row.id,
      });
    }

    if (row.legacyNachpflege) {
      items.push({
        id: `legacy-nachpflege-${row.id}`,
        issueType: "legacy_initiative_nachpflege",
        severity: "medium",
        title: "Change-Nachpflege: Programm fehlt",
        detail: `Initiative „${row.title}“ nutzt noch einen Legacy-Jahresziel-Link — bitte Programm zuweisen.`,
        directionId: row.directionId,
        initiativeId: row.id,
      });
    }

    if (!isActiveExecutionInitiativeStatus(row.status)) continue;

    const health = deriveInitiativeHealth(row);

    if (REVIEW_ATTENTION_RULES.blockedInitiative && health === "off_track") {
      items.push({
        id: `blocked-${row.id}`,
        issueType: "blocked_initiative",
        severity: "high",
        title: "Kritische Umsetzung",
        detail: `Initiative „${row.title}“: Lagebild „kritisch“ (abgeleitetes Risiko / Override).`,
        directionId: row.directionId,
        initiativeId: row.id,
      });
    }

    if (REVIEW_ATTENTION_RULES.atRiskInitiative && health === "at_risk") {
      items.push({
        id: `atrisk-${row.id}`,
        issueType: "at_risk_initiative",
        severity: "medium",
        title: "Erhöhtes Umsetzungsrisiko",
        detail: `Initiative „${row.title}“: Status oder Lagebild erfordert Aufmerksamkeit.`,
        directionId: row.directionId,
        initiativeId: row.id,
      });
    }

    if (REVIEW_ATTENTION_RULES.overdueInitiative && row.end_date) {
      const end = new Date(row.end_date);
      if (end < now && (row.status === "active" || row.status === "at_risk")) {
        items.push({
          id: `overdue-${row.id}`,
          issueType: "overdue_initiative",
          severity: "high",
          title: "Überfällige Fälligkeit (Initiative)",
          detail: `Initiative „${row.title}“: Enddatum ${row.end_date} ist überschritten.`,
          directionId: row.directionId,
          initiativeId: row.id,
        });
      }
    }

    if (REVIEW_ATTENTION_RULES.missingOwner && !row.owner_membership_id) {
      items.push({
        id: `owner-${row.id}`,
        issueType: "missing_owner",
        severity: "medium",
        title: "Aktive Umsetzung ohne Owner",
        detail: `Initiative „${row.title}“ hat keinen Verantwortlichen.`,
        directionId: row.directionId,
        initiativeId: row.id,
      });
    }

    if (typeof staleDays === "number" && staleDays > 0) {
      const last = row.last_review_update_at ? new Date(row.last_review_update_at).getTime() : null;
      const isStale = last === null || now.getTime() - last > staleMs;
      if (isStale) {
        items.push({
          id: `stale-${row.id}`,
          issueType: last === null ? "never_reviewed" : "stale_review",
          severity: last === null ? "low" : "medium",
          title: last === null ? "Noch kein Review erfasst" : `Lange kein Review (${staleDays}+ Tage)`,
          detail: `Initiative „${row.title}“: letztes Review-Update ${
            last === null ? "nie" : row.last_review_update_at
          }.`,
          directionId: row.directionId,
          initiativeId: row.id,
        });
      }
    }
  }

  if (REVIEW_ATTENTION_RULES.priorityDirectionWithoutActiveExecution) {
    for (const d of directions) {
      if (d.status !== "active" || d.priority > PRIORITY_THRESHOLD) continue;
      const coverage = coverageByDirectionId?.get(d.id);
      const noCoverage =
        coverage != null
          ? !coverage.hasAnyCoverage
          : (summaryByDirectionId.get(d.id)?.activeInitiativeCount ?? 0) === 0;
      if (noCoverage) {
        items.push({
          id: `prio-dir-${d.id}`,
          issueType: "priority_direction_no_execution",
          severity: "medium",
          title: "Priorisierte Richtung ohne operative Abdeckung",
          detail: `Stoßrichtung „${d.title}“ ist aktiv und hoch priorisiert, aber ohne operative Abdeckung (Jahresziel, Programm, Initiative oder OKR/KR).`,
          directionId: d.id,
          initiativeId: null,
        });
      }
    }
  }

  const order: Record<AttentionSeverity, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);
  return items;
}
