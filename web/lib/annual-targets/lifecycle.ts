import type { AnnualTargetLifecycleStatus } from "@/lib/annual-targets/types";
import type { OrgAnnualTargetSignatureSettings } from "@/lib/annual-targets/types";

export type LifecycleAction =
  | "submit_for_review"
  | "mark_reviewed"
  | "approve"
  | "send_for_signature"
  | "mark_signed"
  | "activate"
  | "request_changes"
  | "archive"
  | "supersede";

const TRANSITIONS: Record<AnnualTargetLifecycleStatus, Partial<Record<LifecycleAction, AnnualTargetLifecycleStatus>>> = {
  draft: { submit_for_review: "submitted_for_review" },
  submitted_for_review: { mark_reviewed: "reviewed", request_changes: "change_requested" },
  reviewed: { approve: "approved", request_changes: "change_requested" },
  approved: { send_for_signature: "sent_for_signature", activate: "active" },
  sent_for_signature: { mark_signed: "signed", request_changes: "change_requested" },
  signed: { activate: "active" },
  active: { archive: "archived", supersede: "superseded", request_changes: "change_requested" },
  change_requested: { submit_for_review: "submitted_for_review" },
  superseded: { archive: "archived" },
  archived: {},
};

export function getNextStatusForAction(
  current: AnnualTargetLifecycleStatus,
  action: LifecycleAction,
  signatureSettings: OrgAnnualTargetSignatureSettings
): AnnualTargetLifecycleStatus | null {
  if (action === "approve" && current === "reviewed") {
    return "approved";
  }
  if (action === "activate" && current === "approved") {
    if (signatureSettings.requireSignature) {
      return null;
    }
    return "active";
  }
  if (action === "activate" && current === "signed") {
    return "active";
  }
  if (action === "send_for_signature" && current === "approved" && signatureSettings.requireSignature) {
    return "sent_for_signature";
  }
  if (action === "mark_signed" && current === "sent_for_signature") {
    return "signed";
  }
  return TRANSITIONS[current]?.[action] ?? null;
}

export function availableLifecycleActions(
  current: AnnualTargetLifecycleStatus,
  signatureSettings: OrgAnnualTargetSignatureSettings,
  signatureStatus: string
): LifecycleAction[] {
  const actions: LifecycleAction[] = [];
  for (const action of Object.keys(TRANSITIONS[current] ?? {}) as LifecycleAction[]) {
    if (getNextStatusForAction(current, action, signatureSettings)) {
      actions.push(action);
    }
  }
  if (current === "approved" && signatureSettings.requireSignature) {
    if (!actions.includes("send_for_signature")) actions.push("send_for_signature");
  }
  if (current === "approved" && !signatureSettings.requireSignature && !actions.includes("activate")) {
    actions.push("activate");
  }
  if (current === "signed" && signatureStatus === "signed" && !actions.includes("activate")) {
    actions.push("activate");
  }
  return actions;
}

export const LIFECYCLE_ACTION_LABELS_DE: Record<LifecycleAction, string> = {
  submit_for_review: "Zur Prüfung einreichen",
  mark_reviewed: "Als geprüft markieren",
  approve: "Freigeben",
  send_for_signature: "Zur Signatur senden",
  mark_signed: "Als signiert markieren",
  activate: "Aktivieren",
  request_changes: "Änderung anfordern",
  archive: "Archivieren",
  supersede: "Ersetzen",
};
