import type { OkrContributionTier } from "@/lib/strategy-cycle/coverage-level";
import { OKR_CONTRIBUTION_TIER_META } from "@/lib/strategy-cycle/coverage-level";

/** Formulierung: höhere Stufe = klarer/messbarer (positiv). */
export function formulationTierLabelDe(tier: OkrContributionTier | null | undefined): string {
  if (!tier) return "—";
  const meta = OKR_CONTRIBUTION_TIER_META[tier];
  return `${meta.emoji} ${meta.labelDe}`;
}

/**
 * Quartals-Fit / Scope: low = zu eng, medium = passend, high = überladen (Warnsemantik bei high).
 */
export function scopeFitTierLabelDe(tier: OkrContributionTier | null | undefined): string {
  if (!tier) return "—";
  switch (tier) {
    case "low":
      return "↘ Zu eng";
    case "medium":
      return "✓ Passend";
    case "high":
      return "⚠ Überladen";
    case "insufficient":
      return `${OKR_CONTRIBUTION_TIER_META.insufficient.emoji} ${OKR_CONTRIBUTION_TIER_META.insufficient.labelDe}`;
    default:
      return tier;
  }
}

export function scopeFitTierTitleDe(tier: OkrContributionTier | null | undefined): string {
  if (!tier) return "";
  switch (tier) {
    case "low":
      return "Für den OKR-Zeitraum eher zu wenig Scope";
    case "medium":
      return "Scope passt zum OKR-Zeitraum";
    case "high":
      return "Zu viel für den OKR-Zeitraum (überladen)";
    case "insufficient":
      return "Zeitraum oder KRs nicht ausreichend bewertbar";
    default:
      return "";
  }
}
