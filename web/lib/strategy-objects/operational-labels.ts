import type {
  StrategyObjectIdentityLifecycleState,
  StrategyObjectOperationalSignal,
  StrategyObjectReviewDecision,
  StrategyObjectRevisionState,
  StrategyObjectVersioningMeta,
} from "./types";
export const STRATEGY_OBJECT_LIFECYCLE_LABELS_DE: Record<
  StrategyObjectIdentityLifecycleState,
  string
> = {
  draft: "Entwurf",
  active: "Aktiv",
  inactive: "Inaktiv",
  retired: "Stillgelegt",
  archived: "Archiviert",
};

export const STRATEGY_OBJECT_REVISION_STATE_LABELS_DE: Record<
  StrategyObjectRevisionState,
  string
> = {
  draft: "Entwurf",
  pending_approval: "Freigabe ausstehend",
  current: "Aktuell",
  superseded: "Ersetzt",
  archived: "Archiviert",
};

export const STRATEGY_OBJECT_OPERATIONAL_SIGNAL_LABELS_DE: Record<
  StrategyObjectOperationalSignal,
  string
> = {
  on_track: "Auf Kurs",
  watch: "Beobachten",
  at_risk: "Risikobehaftet",
  completed: "Abgeschlossen",
  retired: "Stillgelegt",
  removed: "Entfernt",
};

export const STRATEGY_OBJECT_REVIEW_DECISION_LABELS_DE: Record<
  StrategyObjectReviewDecision,
  string
> = {
  reconfirm: "Bestätigen",
  escalate: "Eskaliert",
  deprioritize: "Depriorisieren",
  revise: "Überarbeiten",
  complete: "Abschließen",
  retire: "Stilllegen",
  remove: "Entfernen",
};

export function getLifecycleLabelDe(
  value: StrategyObjectIdentityLifecycleState | null | undefined
): string {
  if (!value) return "—";
  return STRATEGY_OBJECT_LIFECYCLE_LABELS_DE[value] ?? value;
}

export function getRevisionStateLabelDe(
  value: StrategyObjectRevisionState | null | undefined
): string {
  if (!value) return "—";
  return STRATEGY_OBJECT_REVISION_STATE_LABELS_DE[value] ?? value;
}

type OpenDraftRevisionHint = {
  revision_number: number;
  revision_state: StrategyObjectRevisionState;
};

export function formatRevisionNumberWithOpenDraft(
  versioning: StrategyObjectVersioningMeta | null | undefined,
  openDraft?: OpenDraftRevisionHint | null
): string {
  const current = versioning?.revision_number;
  if (current == null) return "—";
  if (!openDraft) return `r${current}`;
  return `r${current} (+r${openDraft.revision_number} Entw.)`;
}

export function formatRevisionStateWithOpenDraft(
  versioning: StrategyObjectVersioningMeta | null | undefined,
  openDraft?: OpenDraftRevisionHint | null
): string {
  const currentLabel = getRevisionStateLabelDe(versioning?.revision_state);
  if (!openDraft) return currentLabel;
  const draftLabel = getRevisionStateLabelDe(openDraft.revision_state);
  return `${currentLabel} · ${draftLabel} offen`;
}

export function resolveOpenDraftForVersioning<
  T extends OpenDraftRevisionHint & { object_identity_id: string }
>(
  versioning: StrategyObjectVersioningMeta | null | undefined,
  openDraftByIdentityId?: Record<string, T> | null
): T | undefined {
  const identityId = versioning?.object_identity_id;
  if (!identityId || !openDraftByIdentityId) return undefined;
  return openDraftByIdentityId[identityId];
}

/** Einheitliche UI-Spalte: Portfolio + Revision (+ optional offener Entwurf). */
export function formatStrategyObjectStandLabel(
  versioning: StrategyObjectVersioningMeta | null | undefined,
  openDraft?: OpenDraftRevisionHint | null
): string {
  if (!versioning) return "—";

  const lifecycle = versioning.identity_lifecycle_state;
  const revNum = versioning.revision_number;
  const revTag = revNum != null ? `r${revNum}` : null;

  if (openDraft) {
    const portfolio =
      lifecycle === "active" ? "Aktiv" : getLifecycleLabelDe(lifecycle);
    return `${portfolio} · Entwurf r${openDraft.revision_number} offen`;
  }

  if (lifecycle === "draft") {
    return revTag ? `Entwurf (${revTag})` : "Entwurf";
  }

  if (lifecycle === "active" && versioning.revision_state === "current") {
    return revTag ? `Aktiv (${revTag})` : "Aktiv";
  }

  if (lifecycle && lifecycle !== "active") {
    const portfolio = getLifecycleLabelDe(lifecycle);
    return revTag ? `${portfolio} (${revTag})` : portfolio;
  }

  if (versioning.revision_state && versioning.revision_state !== "current") {
    const revision = getRevisionStateLabelDe(versioning.revision_state);
    return revTag ? `${revision} (${revTag})` : revision;
  }

  return revTag ? `Aktiv (${revTag})` : "Aktiv";
}

export function strategyObjectStandSortValue(
  versioning: StrategyObjectVersioningMeta | null | undefined,
  openDraft?: OpenDraftRevisionHint | null
): string {
  if (!versioning) return "";
  const lifecycle = versioning.identity_lifecycle_state ?? "";
  const revision = String(versioning.revision_number ?? 0).padStart(5, "0");
  const draftFlag = openDraft ? "1" : "0";
  const draftRev = String(openDraft?.revision_number ?? 0).padStart(5, "0");
  return `${lifecycle}:${draftFlag}:${draftRev}:${revision}`;
}

export function getOperationalSignalLabelDe(
  value: StrategyObjectOperationalSignal | null | undefined
): string {
  if (!value) return "—";
  return STRATEGY_OBJECT_OPERATIONAL_SIGNAL_LABELS_DE[value] ?? value;
}

export function getReviewDecisionLabelDe(
  value: StrategyObjectReviewDecision | null | undefined
): string {
  if (!value) return "—";
  return STRATEGY_OBJECT_REVIEW_DECISION_LABELS_DE[value] ?? value;
}
