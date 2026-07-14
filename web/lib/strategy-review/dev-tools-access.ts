/** Dev-Tools nur für festgelegte Entwickler-Accounts (Development). */

export const STRATEGY_REVIEW_DEV_TOOL_EMAILS = [
  "carmelo.messina@cabtecgroup.com",
] as const;

export function isStrategyReviewDevToolsAllowed(
  email: string | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  if (nodeEnv !== "development") return false;
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  return (STRATEGY_REVIEW_DEV_TOOL_EMAILS as readonly string[]).includes(normalized);
}
