export type KrConfirmationStatus = "none" | "pending" | "accepted" | "rejected" | "manual";

export type ExistingKrInitiativeLink = {
  id: string;
  initiativeId: string;
  confirmationStatus: KrConfirmationStatus;
  confirmedLevel: "low" | "medium" | "high" | null;
};

export type SuggestedKrInitiativeMatch = {
  initiativeId: string;
  level: "low" | "medium" | "high";
  reason: string;
};

export type KrInitiativeReconcileResult = {
  updates: Array<{
    id: string;
    patch: {
      llm_level: "low" | "medium" | "high" | null;
      llm_reason: string | null;
      llm_run_id: string | null;
      confirmation_status?: KrConfirmationStatus;
    };
  }>;
  inserts: Array<{
    initiativeId: string;
    llmLevel: "low" | "medium" | "high";
    llmReason: string;
    confirmationStatus: "pending";
  }>;
};

function canLlmModifyStatus(status: KrConfirmationStatus): status is "none" | "pending" | "rejected" {
  return status === "none" || status === "pending" || status === "rejected";
}

export function reconcileKrInitiativeMatching(input: {
  existingLinks: ExistingKrInitiativeLink[];
  suggestedMatches: SuggestedKrInitiativeMatch[];
  runId: string | null;
}): KrInitiativeReconcileResult {
  const updates: KrInitiativeReconcileResult["updates"] = [];
  const inserts: KrInitiativeReconcileResult["inserts"] = [];

  const existingByInitiativeId = new Map(input.existingLinks.map((row) => [row.initiativeId, row]));
  const suggestedByInitiativeId = new Map(input.suggestedMatches.map((row) => [row.initiativeId, row]));

  for (const row of input.existingLinks) {
    if (row.confirmationStatus === "accepted" || row.confirmationStatus === "manual") {
      continue;
    }
    const match = suggestedByInitiativeId.get(row.initiativeId);
    if (match) {
      updates.push({
        id: row.id,
        patch: {
          llm_level: match.level,
          llm_reason: match.reason.slice(0, 2000),
          llm_run_id: input.runId,
          confirmation_status: row.confirmedLevel != null ? row.confirmationStatus : "pending",
        },
      });
      continue;
    }
    if (canLlmModifyStatus(row.confirmationStatus)) {
      updates.push({
        id: row.id,
        patch: {
          llm_level: null,
          llm_reason: null,
          llm_run_id: null,
          confirmation_status: "none",
        },
      });
    }
  }

  for (const suggestion of input.suggestedMatches) {
    if (existingByInitiativeId.has(suggestion.initiativeId)) continue;
    inserts.push({
      initiativeId: suggestion.initiativeId,
      llmLevel: suggestion.level,
      llmReason: suggestion.reason.slice(0, 2000),
      confirmationStatus: "pending",
    });
  }

  return { updates, inserts };
}
