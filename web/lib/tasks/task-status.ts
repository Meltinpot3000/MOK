/**
 * Einheitliche Status-Normalisierung fuer app.tasks (Rohstatus + Meta).
 */
export type NormalizedTaskStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "blocked"
  | "overdue"
  | "unknown";

export function normalizeTaskStatus(
  rawStatus: string | null | undefined,
  completedAt: string | null | undefined,
  dueAt: string | null | undefined,
  now: Date = new Date()
): NormalizedTaskStatus {
  if (completedAt != null && String(completedAt).trim() !== "") {
    return "completed";
  }

  const s = (rawStatus ?? "").toLowerCase().trim();
  if (["completed", "done", "closed", "erledigt"].includes(s)) {
    return "completed";
  }
  if (["open", "todo", "pending", "offen"].includes(s)) {
    if (dueAt) {
      const d = new Date(dueAt);
      if (!Number.isNaN(d.getTime()) && d.getTime() < now.getTime()) {
        return "overdue";
      }
    }
    return "open";
  }
  if (["in_progress", "active", "aktiv", "laufend"].includes(s)) {
    return "in_progress";
  }
  if (["blocked", "blockiert"].includes(s)) {
    return "blocked";
  }

  if (dueAt) {
    const d = new Date(dueAt);
    if (!Number.isNaN(d.getTime()) && d.getTime() < now.getTime() && s !== "completed") {
      return "overdue";
    }
  }

  return "unknown";
}

export function isCurrentWorkStatus(normalized: NormalizedTaskStatus): boolean {
  return normalized === "open" || normalized === "in_progress" || normalized === "overdue" || normalized === "blocked";
}
