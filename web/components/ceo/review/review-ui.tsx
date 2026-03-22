import type { ReviewStatus } from "@/lib/review/key-result-progress";
import type { ResolvedDirectionSource } from "@/lib/review/review-cycle-view-model";
import {
  STRATEGIC_DIRECTION_STATUS_LABELS_DE,
  isStrategicDirectionStatus,
} from "@/lib/strategy-cycle/strategic-direction-lifecycle";

export function healthBadgeClass(status: ReviewStatus): string {
  const styles: Record<ReviewStatus, string> = {
    on_track: "bg-emerald-100 text-emerald-800",
    at_risk: "bg-amber-100 text-amber-800",
    off_track: "bg-red-100 text-red-800",
  };
  return styles[status] ?? "bg-zinc-100 text-zinc-700";
}

export function healthLabelDe(status: ReviewStatus): string {
  const labels: Record<ReviewStatus, string> = {
    on_track: "Auf Kurs",
    at_risk: "Auffällig",
    off_track: "Kritisch",
  };
  return labels[status] ?? status;
}

export function initiativeStatusLabelDe(status: string): string {
  const map: Record<string, string> = {
    draft: "Entwurf",
    planned: "Geplant",
    active: "Aktiv",
    at_risk: "Auffällig",
    on_hold: "Pausiert",
    completed: "Abgeschlossen",
    archived: "Archiviert",
  };
  return map[status] ?? status;
}

export function directionSourceLabelDe(source: ResolvedDirectionSource): string {
  const map: Record<ResolvedDirectionSource, string> = {
    program: "Programm",
    annual_target: "Jahresziel",
    unresolved: "Mehrdeutig",
    unassigned: "Nicht zugeordnet",
  };
  return map[source];
}

export function directionStatusLabelDe(status: string): string {
  if (isStrategicDirectionStatus(status)) {
    return STRATEGIC_DIRECTION_STATUS_LABELS_DE[status];
  }
  const legacy: Record<string, string> = {
    completed: "Abgeschlossen (Legacy)",
    archived: "Archiviert (Legacy)",
  };
  return legacy[status] ?? status;
}

export function formatDateDe(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
