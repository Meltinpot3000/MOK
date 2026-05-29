/** OKR-Objective-Status im Freigabe-/Ausführungs-Lifecycle (DB: app.okr_objectives.status). */

function normalizeOkrObjectiveStatus(status: string): string {
  return status?.trim() || "draft";
}

export function okrObjectiveLifecycleLabelDe(status: string): string {
  const s = normalizeOkrObjectiveStatus(status);
  if (s === "shifted") return "Verschoben";
  if (s === "pending_approval") return "Freigabe ausstehend";
  if (s === "draft") return "Entwurf";
  if (s === "active") return "Freigegeben (aktiv)";
  if (s === "at_risk") return "Gefährdet";
  if (s === "completed") return "Abgeschlossen";
  if (s === "archived") return "Archiviert";
  return s;
}

export function okrObjectiveLifecycleBadgeClass(status: string): string {
  const s = normalizeOkrObjectiveStatus(status);
  if (s === "draft") return "border-zinc-300 bg-zinc-50 text-zinc-700";
  if (s === "pending_approval") return "border-sky-300 bg-sky-50 text-sinc-900";
  if (s === "active") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (s === "at_risk") return "border-amber-300 bg-amber-50 text-amber-900";
  if (s === "completed") return "border-indigo-300 bg-indigo-50 text-indigo-900";
  if (s === "archived") return "border-zinc-300 bg-zinc-100 text-zinc-600";
  if (s === "shifted") return "border-violet-300 bg-violet-50 text-violet-900";
  return "border-zinc-300 bg-zinc-50 text-zinc-700";
}

/** Entwürfe nur in der Planung; Tracking ab «Zur Freigabe senden». */
export function okrObjectiveVisibleInTracking(status: string): boolean {
  return normalizeOkrObjectiveStatus(status) !== "draft";
}

/** Planungsmaske: bearbeitbar nur im Status Entwurf (nach Freigabe gesperrt). */
export function okrObjectiveEditableInPlanning(status: string): boolean {
  return normalizeOkrObjectiveStatus(status) === "draft";
}

/** `null` = Bearbeitung erlaubt; sonst Fehlermeldung für UI/Server. */
export function okrPlanningEditBlockedMessageDe(status: string): string | null {
  const s = normalizeOkrObjectiveStatus(status);
  if (s === "draft") return null;
  if (s === "pending_approval") {
    return "Bearbeitung gesperrt: Freigabe ausstehend. Nach Rückweisung ist die Planung wieder möglich.";
  }
  if (s === "shifted") {
    return "Dieses Objective wurde in einen späteren OKR-Zeitraum verschoben. Bearbeitung ist hier deaktiviert.";
  }
  if (s === "active" || s === "at_risk") {
    return "Bearbeitung gesperrt: OKR wurde freigegeben. Änderungen nur noch im Tracking (Check-ins), nicht in der Planung.";
  }
  if (s === "completed" || s === "archived") {
    return "Bearbeitung gesperrt: abgeschlossenes bzw. archiviertes Objective.";
  }
  return "Bearbeitung in der Planung für diesen Status nicht möglich.";
}
