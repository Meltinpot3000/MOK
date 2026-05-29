/** OKR-Objective-Status, ab dem Check-ins und operatives Tracking erlaubt sind. */
export function okrObjectiveAllowsCheckIn(status: string): boolean {
  return status === "active" || status === "at_risk";
}

export function okrCheckInBlockedMessageDe(status: string): string {
  if (status === "draft") {
    return "Check-ins sind erst nach Freigabe des OKR-Objective möglich (Status «Entwurf»). Bitte in der Planung «Freigabe anfragen».";
  }
  if (status === "pending_approval") {
    return "Check-ins sind gesperrt, solange die Freigabe durch den Vorgesetzten aussteht.";
  }
  if (status === "shifted") {
    return "Check-ins sind für verschobene Objectives nicht möglich.";
  }
  if (status === "completed" || status === "archived") {
    return "Check-ins sind für abgeschlossene oder archivierte Objectives nicht möglich.";
  }
  return "Check-ins sind für dieses Objective derzeit nicht möglich.";
}
