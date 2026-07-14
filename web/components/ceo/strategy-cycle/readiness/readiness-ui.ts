import type {
  FocusDetailAction,
  ReadinessBand,
  ReadinessStatus,
} from "@/lib/strategy-cycle/design-readiness-snapshot";
import { readinessBandLabelDe, readinessStatusLabelDe } from "@/lib/strategy-cycle/design-readiness-snapshot";

export function statusBadgeClass(status: ReadinessStatus): string {
  switch (status) {
    case "strong":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "medium":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "weak":
      return "border-red-300 bg-red-50 text-red-800";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-600";
  }
}

export function bandBadgeClass(band: ReadinessBand): string {
  return band === "high"
    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : band === "medium"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : band === "low"
        ? "border-red-300 bg-red-50 text-red-900"
        : "border-zinc-300 bg-zinc-100 text-zinc-600";
}

/** Abdeckungsmetriken: bei voller Katalogabdeckung nicht „Tragfähig“, sondern „Abgedeckt“. */
export function coverageStatusLabelDe(
  covered: number,
  total: number,
  status: ReadinessStatus
): string {
  if (total === 0) return "Keine Daten";
  if (covered >= total) return "Abgedeckt";
  if (covered === 0) return "Nacharbeiten";
  return readinessStatusLabelDe(status);
}

export function actionHref(action: FocusDetailAction): string | null {
  switch (action.targetTab) {
    case "corporate-strategy-summary":
      return "/strategy-cycle?l1=corporate-strategy&l2=summary";
    case "challenges":
      return "/strategy-cycle?l1=strategic-directions&l2=challenges";
    case "design":
      return "/strategy-cycle?l1=strategic-directions&l2=design";
    case "strategy-matrix":
      return "/strategy-cycle?l1=strategic-directions&l2=strategy-matrix";
    case "summary":
      return "/strategy-cycle?l1=strategic-directions&l2=summary";
    default:
      return null;
  }
}

export { readinessBandLabelDe, readinessStatusLabelDe };
