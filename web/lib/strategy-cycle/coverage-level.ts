export type ContributionLevel = "low" | "medium" | "high";

/** OKR-Einzahlung / Kantenbewertung (inkl. nicht auswertbarer Textlage). */
export type OkrContributionTier = ContributionLevel | "insufficient";

export function normalizeContributionLevel(raw: string | null | undefined): ContributionLevel {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "low" || v === "medium" || v === "high") return v;
  return "medium";
}

export const COVERAGE_LEVEL_ORDER: ContributionLevel[] = ["low", "medium", "high"];

export const COVERAGE_LEVEL_META: Record<
  ContributionLevel,
  { emoji: string; labelDe: string }
> = {
  low: { emoji: "🌱", labelDe: "schwach" },
  medium: { emoji: "⚡", labelDe: "mittel" },
  high: { emoji: "🔥", labelDe: "stark" },
};

export const OKR_CONTRIBUTION_TIER_ORDER: OkrContributionTier[] = [
  "insufficient",
  "low",
  "medium",
  "high",
];

export const OKR_CONTRIBUTION_TIER_META: Record<OkrContributionTier, { emoji: string; labelDe: string }> = {
  insufficient: { emoji: "✳️", labelDe: "unzureichend beschrieben" },
  low: COVERAGE_LEVEL_META.low,
  medium: COVERAGE_LEVEL_META.medium,
  high: COVERAGE_LEVEL_META.high,
};

/** Für manuelle OKR-Einstufung und `okr_contribution_edges`. */
export function normalizeOkrContributionTier(raw: string | null | undefined): OkrContributionTier {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    v === "insufficient" ||
    v === "underdescribed" ||
    v === "unzureichend" ||
    v === "not_assessable" ||
    v === "nicht_auswertbar"
  ) {
    return "insufficient";
  }
  if (v === "low" || v === "medium" || v === "high") return v;
  return "insufficient";
}
