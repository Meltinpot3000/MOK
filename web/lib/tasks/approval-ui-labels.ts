import type { ApprovalSourceObjectType } from "@/lib/tasks/approval-source-types";
import { okrObjectiveLifecycleLabelDe } from "@/lib/okr/okr-objective-lifecycle";

/** Breite Freigabe-Detailseite: max-w-3xl (48rem) + 30 % ≈ 62,4rem */
export const APPROVAL_DETAIL_MAX_WIDTH_CLASS = "max-w-[62.4rem]";

export function formatApprovalTaskTitleDe(title: string): string {
  const t = title.trim();
  if (/^approval:\s*/i.test(t)) {
    return `Freigabe: ${t.replace(/^approval:\s*/i, "").trim()}`;
  }
  if (/^abschluss bestätigen:/i.test(t)) {
    return t.replace(/^abschluss bestätigen:/i, "Abschluss bestätigen:").trim();
  }
  return t;
}

export function approvalSourceObjectTypeLabelDe(type: string): string {
  switch (type as ApprovalSourceObjectType | string) {
    case "okr_objective":
      return "OKR-Objective";
    case "strategy_objective":
      return "Strategisches Ziel";
    case "strategic_goal":
      return "Strategisches Ziel (Jahresziel)";
    case "strategic_direction":
      return "Stoßrichtung";
    case "strategy_program":
      return "Strategieprogramm";
    case "initiative":
      return "Initiative";
    case "functional_strategy":
      return "Funktionsstrategie";
    case "key_result":
      return "Key Result";
    default:
      return type;
  }
}

export function approvalObjectRowLabelDe(
  sourceObjectType: string,
  objectTitle: string
): string {
  return `${approvalSourceObjectTypeLabelDe(sourceObjectType)}: ${objectTitle}`;
}

export function taskTypeLabelDe(taskType: string): string {
  switch (taskType) {
    case "approval":
      return "Freigabe";
    case "completion_review":
      return "KR-Abschluss";
    default:
      return taskType;
  }
}

export function taskStatusLabelDe(status: string): string {
  switch (status) {
    case "open":
      return "Offen";
    case "completed":
      return "Erledigt";
    case "cancelled":
      return "Abgebrochen";
    case "in_progress":
      return "In Bearbeitung";
    case "blocked":
      return "Blockiert";
    case "overdue":
      return "Überfällig";
    default:
      return status;
  }
}

export function taskPriorityLabelDe(priority: string): string {
  switch (priority) {
    case "normal":
      return "Normal";
    case "high":
      return "Hoch";
    case "low":
      return "Niedrig";
    case "urgent":
      return "Dringend";
    default:
      return priority;
  }
}

/** Objektstatus in Freigabe-UI (OKR-Lifecycle + generische Fallbacks). */
export function approvalObjectStatusLabelDe(
  sourceObjectType: string,
  status: string | null | undefined
): string {
  if (!status) return "—";
  if (sourceObjectType === "okr_objective") {
    return okrObjectiveLifecycleLabelDe(status);
  }
  if (sourceObjectType === "key_result") {
    if (status === "completed") return "Abgeschlossen";
    if (status === "active") return "Aktiv";
    if (status === "draft") return "Entwurf";
    if (status === "at_risk") return "Gefährdet";
    if (status === "archived") return "Archiviert";
  }
  switch (status) {
    case "draft":
      return "Entwurf";
    case "pending_approval":
      return "Freigabe ausstehend";
    case "active":
      return "Aktiv";
    case "approved":
      return "Freigegeben";
    case "planned":
      return "Geplant";
    case "at_risk":
      return "Gefährdet";
    case "completed":
      return "Abgeschlossen";
    case "archived":
      return "Archiviert";
    case "shifted":
      return "Verschoben";
    default:
      return status;
  }
}
