import {
  collectThemeItems,
  STRATEGY_REVIEW_CHAIN_THEMES,
  type StrategyReviewChainHub,
  type StrategyReviewChainItem,
} from "./pre-read-chain";
import type { StrategyReviewParticipant } from "./participants";

export type ReviewElementKey = `${string}:${string}`;

export type ReviewerFeedbackProgress = {
  membershipId: string;
  displayName: string;
  roleLabel: string;
  ratedCount: number;
  totalCount: number;
  /** 0–100 */
  percent: number;
};

/** Alle bewertbaren Review-Elemente (challenge / focus_area / objective / program). */
export function listStrategyReviewElementKeys(
  hubs: StrategyReviewChainHub[],
  catalogs?: Partial<Record<"challenges" | "objectives" | "programs", StrategyReviewChainItem[]>>
): ReviewElementKey[] {
  const keys: ReviewElementKey[] = [];
  const seen = new Set<string>();
  for (const theme of STRATEGY_REVIEW_CHAIN_THEMES) {
    for (const item of collectThemeItems(hubs, theme.id, catalogs)) {
      const key = `${theme.subjectType}:${item.id}` as ReviewElementKey;
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

type FeedbackRow = {
  subject_type: string;
  subject_id: string;
  actor_id: string;
  rating: string | null;
};

/**
 * Fortschritt je Reviewer: Anteil der Review-Elemente mit Bewertung.
 * Zeigt Teilnehmende außer Beobachtern; Personen mit Feedback ohne Einladung werden ergänzt.
 */
export function computeReviewerFeedbackProgress(input: {
  hubs: StrategyReviewChainHub[];
  catalogs?: Partial<Record<"challenges" | "objectives" | "programs", StrategyReviewChainItem[]>>;
  participants: StrategyReviewParticipant[];
  feedbackRows: FeedbackRow[];
  roleLabel: (role: string) => string;
}): ReviewerFeedbackProgress[] {
  const elementKeys = listStrategyReviewElementKeys(input.hubs, input.catalogs);
  const totalCount = elementKeys.length;
  const elementSet = new Set(elementKeys);

  const ratedByActor = new Map<string, Set<string>>();
  for (const row of input.feedbackRows) {
    if (!row.rating) continue;
    const key = `${row.subject_type}:${row.subject_id}`;
    if (!elementSet.has(key as ReviewElementKey) && totalCount > 0) {
      // Feedback zu Elementen außerhalb der aktuellen Liste trotzdem zählen? Nein – nur aktuelle Elemente.
      continue;
    }
    if (totalCount === 0) continue;
    const set = ratedByActor.get(row.actor_id) ?? new Set();
    set.add(key);
    ratedByActor.set(row.actor_id, set);
  }

  const rows: ReviewerFeedbackProgress[] = [];
  const seen = new Set<string>();

  for (const p of input.participants) {
    if (p.review_role === "observer") continue;
    seen.add(p.membership_id);
    const ratedCount = ratedByActor.get(p.membership_id)?.size ?? 0;
    rows.push({
      membershipId: p.membership_id,
      displayName: p.display_name,
      roleLabel: input.roleLabel(p.review_role),
      ratedCount,
      totalCount,
      percent: totalCount === 0 ? 0 : Math.round((ratedCount / totalCount) * 100),
    });
  }

  for (const [actorId, set] of ratedByActor) {
    if (seen.has(actorId)) continue;
    const ratedCount = set.size;
    rows.push({
      membershipId: actorId,
      displayName: "Unbekannter Reviewer",
      roleLabel: "Feedback",
      ratedCount,
      totalCount,
      percent: totalCount === 0 ? 0 : Math.round((ratedCount / totalCount) * 100),
    });
  }

  return rows.sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    return a.displayName.localeCompare(b.displayName, "de");
  });
}
