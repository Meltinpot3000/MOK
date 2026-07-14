import { strategyReviewDirectionFeedbackLabel } from "./pre-read-chain";

export type StrategyReviewFeedbackRowLike = {
  subject_type: string;
  subject_id: string;
  actor_id: string;
  rating: string | null;
  comment: string | null;
};

export type FeedbackRatingBucket = {
  rating: string;
  label: string;
  count: number;
  reviewers: string[];
};

export type FeedbackCommentLine = {
  author: string;
  ratingLabel: string;
  comment: string;
};

export type SubjectFeedbackSummary = {
  totalRatings: number;
  buckets: FeedbackRatingBucket[];
  comments: FeedbackCommentLine[];
};

/** Aggregiert Feedback aller Reviewer zu einem Review-Element. */
export function summarizeSubjectFeedback(
  rows: StrategyReviewFeedbackRowLike[],
  subjectType: string,
  subjectId: string,
  nameByActorId: Record<string, string>
): SubjectFeedbackSummary {
  const relevant = rows.filter(
    (r) => r.subject_type === subjectType && r.subject_id === subjectId && r.rating
  );

  const byRating = new Map<string, { count: number; reviewers: Set<string> }>();
  const comments: FeedbackCommentLine[] = [];

  for (const row of relevant) {
    const rating = row.rating!;
    const author = nameByActorId[row.actor_id] ?? "Unbekannt";
    const cur = byRating.get(rating) ?? { count: 0, reviewers: new Set<string>() };
    cur.count += 1;
    cur.reviewers.add(author);
    byRating.set(rating, cur);

    const comment = row.comment?.trim();
    if (comment) {
      comments.push({
        author,
        ratingLabel: strategyReviewDirectionFeedbackLabel(rating),
        comment,
      });
    }
  }

  const buckets: FeedbackRatingBucket[] = [...byRating.entries()]
    .map(([rating, v]) => ({
      rating,
      label: strategyReviewDirectionFeedbackLabel(rating),
      count: v.count,
      reviewers: [...v.reviewers].sort((a, b) => a.localeCompare(b, "de")),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "de"));

  return {
    totalRatings: relevant.length,
    buckets,
    comments,
  };
}

/** Anzahl Elemente eines Themas mit mindestens einer Bewertung. */
export function countItemsWithFeedback(
  items: Array<{ id: string }>,
  subjectType: string,
  rows: StrategyReviewFeedbackRowLike[]
): number {
  const rated = new Set(
    rows
      .filter((r) => r.subject_type === subjectType && r.rating)
      .map((r) => r.subject_id)
  );
  return items.filter((it) => rated.has(it.id)).length;
}
