export type ImpactPathMutationResult =
  | { ok: true; success: string }
  | { ok: false; error: string };

export function impactPathStatusMessage(
  error?: string | null,
  success?: string | null
): { type: "success" | "error"; text: string } | null {
  if (success === "path-link-accepted")
    return { type: "success", text: "Verbindung wurde hinzugefügt." };
  if (success === "path-link-draft-pending")
    return {
      type: "success",
      text: "Verbindung im Revisionsentwurf gespeichert. Bitte den Entwurf prüfen und «Revision übernehmen», damit sie aktiv wird.",
    };
  if (success === "path-link-rejected")
    return { type: "success", text: "Vorschlag wurde abgelehnt." };
  if (success === "path-link-deferred")
    return { type: "success", text: "Vorschlag wurde zur späteren Prüfung markiert." };
  if (success === "path-link-deleted")
    return { type: "success", text: "Verbindung wurde entfernt." };
  if (success === "correlation-override-saved")
    return { type: "success", text: "Status-Override für die Korrelation wurde gespeichert." };
  if (success === "correlation-override-cleared")
    return { type: "success", text: "Status-Override wurde entfernt. Auto-Status ist wieder aktiv." };

  if (error === "missing-link")
    return { type: "error", text: "Verbindung unvollständig. Bitte Quelle und Ziel prüfen." };
  if (error === "definition-locked")
    return {
      type: "error",
      text: "Objekt ist gesperrt. Bitte zuerst einen Revisionsentwurf anlegen oder die Revision übernehmen.",
    };
  if (error === "link-failed")
    return { type: "error", text: "Verbindung konnte nicht gespeichert werden." };
  if (error === "revision-not-found")
    return { type: "error", text: "Revisionsentwurf nicht gefunden." };
  if (error === "draft-create-failed" || error === "draft-update-failed")
    return { type: "error", text: "Revisionsentwurf konnte nicht aktualisiert werden." };

  if (error) return { type: "error", text: "Vorgang fehlgeschlagen. Bitte erneut versuchen." };
  return null;
}
