import { strategyObjectRpcErrorMessage } from "@/lib/strategy-objects/write";

const REVISION_ERROR_CODES = new Set([
  "missing-revision-id",
  "revision-not-found",
  "draft-create-failed",
  "draft-update-failed",
  "draft-submit-failed",
  "draft-promote-failed",
  "draft-reject-failed",
  "strategy-object-auth-required",
  "strategy-object-write-forbidden",
  "strategy-object-revision-not-found",
  "strategy-object-definition-locked",
  "strategy-object-draft-base-not-current",
  "strategy-object-draft-already-exists",
  "strategy-object-revision-not-editable",
  "strategy-object-revision-not-submittable",
  "strategy-object-revision-not-rejectable",
  "strategy-object-revision-not-promotable",
  "strategy-object-current-revision-missing",
  "strategy-object-identity-not-found",
  "delete-only-draft",
  "lifecycle-invalid",
  "lifecycle-not-found",
  "lifecycle-transition-invalid",
  "lifecycle-update-failed",
]);

const LIFECYCLE_ERROR_MESSAGES: Record<string, string> = {
  "delete-only-draft":
    "Nur Entwürfe können gelöscht werden. Aktive Objekte bitte inaktivieren oder stilllegen.",
  "lifecycle-invalid": "Ungültige Statusänderung.",
  "lifecycle-not-found": "Objekt für die Statusänderung nicht gefunden.",
  "lifecycle-transition-invalid": "Dieser Statuswechsel ist nicht erlaubt.",
  "lifecycle-update-failed": "Status konnte nicht geändert werden. Bitte erneut versuchen.",
};

export function normalizeStrategyRevisionErrorCode(
  raw: string | undefined | null,
  fallback = "draft-create-failed"
): string {
  const code = String(raw ?? "").trim();
  if (!code) return fallback;
  if (REVISION_ERROR_CODES.has(code)) return code;
  if (code.startsWith("strategy-object-")) return code;
  return fallback;
}

export function getStrategyRevisionStatusMessage(
  error: string | undefined,
  success: string | undefined
): { type: "error" | "success"; text: string } | null {
  if (error) {
    const code = normalizeStrategyRevisionErrorCode(error);
    if (LIFECYCLE_ERROR_MESSAGES[code]) {
      return { type: "error", text: LIFECYCLE_ERROR_MESSAGES[code] };
    }
    if (code.startsWith("strategy-object-") || REVISION_ERROR_CODES.has(code)) {
      const text =
        code === "draft-create-failed" && error !== code
          ? "Revisionsentwurf konnte nicht erstellt werden. Bitte erneut versuchen."
          : strategyObjectRpcErrorMessage(code);
      return { type: "error", text };
    }
  }

  if (success === "draft-created") {
    return {
      type: "success",
      text: "Revisionsentwurf wurde erstellt. Das blaue Bearbeitungs-Panel oben bei «Ziele» ist jetzt aktiv.",
    };
  }
  if (success === "draft-opened") {
    return {
      type: "success",
      text: "Offener Revisionsentwurf — blaues Panel oben. Dort «Revision übernehmen» oder «Entwurf verwerfen».",
    };
  }
  if (success === "draft-updated") {
    return { type: "success", text: "Revisionsentwurf wurde gespeichert." };
  }
  if (success === "draft-submitted") {
    return { type: "success", text: "Revision wurde zur Freigabe eingereicht." };
  }
  if (success === "draft-promoted") {
    return { type: "success", text: "Revision wurde übernommen und ist jetzt aktiv." };
  }
  if (success === "draft-rejected") {
    return { type: "success", text: "Revisionsentwurf wurde verworfen." };
  }
  if (success === "lifecycle-active") {
    return { type: "success", text: "Objekt ist jetzt aktiv." };
  }
  if (success === "lifecycle-inactive") {
    return { type: "success", text: "Objekt wurde inaktiviert." };
  }
  if (success === "lifecycle-retired") {
    return { type: "success", text: "Objekt wurde stillgelegt." };
  }

  return null;
}

export const STRATEGY_REVISION_REFRESH_SUCCESS_KEYS = [
  "draft-created",
  "draft-opened",
  "draft-updated",
  "draft-submitted",
  "draft-promoted",
  "draft-rejected",
  "lifecycle-active",
  "lifecycle-inactive",
  "lifecycle-retired",
] as const;
