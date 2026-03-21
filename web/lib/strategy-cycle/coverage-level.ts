export type ContributionLevel = "low" | "medium" | "high";

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
