/** Lesbare Zusammenfassung des Strategy-Review-Entscheidungspayloads. */

export type DecisionSummaryLine = {
  kindLabel: string;
  title: string;
  decisionLabel: string;
  comment: string | null;
};

const DECISION_LABELS: Record<string, string> = {
  keep: "Beibehalten",
  adjust: "Anpassen",
  change: "Anpassen",
  replace: "Ersetzen",
  inactivate: "Inaktivieren",
  remove: "Entfernen",
  stop: "Stoppen",
  double_down: "Verstärken",
};

function decisionLabelDe(code: string | null | undefined): string {
  if (!code) return "—";
  return DECISION_LABELS[code] ?? code;
}

function asRows(v: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object");
}

function titleFromRow(row: Record<string, unknown>, sourceTitle?: string): string {
  const proposed =
    row.proposed_changes && typeof row.proposed_changes === "object"
      ? (row.proposed_changes as Record<string, unknown>)
      : null;
  const replacement =
    row.replacement && typeof row.replacement === "object"
      ? (row.replacement as Record<string, unknown>)
      : null;
  const fromChange =
    (typeof proposed?.title === "string" && proposed.title.trim()) ||
    (typeof replacement?.title === "string" && replacement.title.trim()) ||
    "";
  if (fromChange) return fromChange;
  if (sourceTitle?.trim()) return sourceTitle.trim();
  if (typeof row.id === "string") return `Objekt ${row.id.slice(0, 8)}…`;
  return "Ohne Titel";
}

export function summarizeStrategyReviewDecisions(
  payload: Record<string, unknown> | null | undefined,
  sources?: {
    challenges?: Array<{ id: string; title?: string }>;
    focusAreas?: Array<{ id: string; title?: string }>;
    objectives?: Array<{ id: string; title?: string }>;
  }
): DecisionSummaryLine[] {
  if (!payload) return [];
  const lines: DecisionSummaryLine[] = [];
  const titleById = (list: Array<{ id: string; title?: string }> | undefined, id: string) =>
    list?.find((x) => x.id === id)?.title;

  for (const row of asRows(payload.challenges)) {
    const id = typeof row.id === "string" ? row.id : "";
    lines.push({
      kindLabel: "Handlungsbedarf",
      title: titleFromRow(row, titleById(sources?.challenges, id)),
      decisionLabel: decisionLabelDe(typeof row.decision === "string" ? row.decision : null),
      comment: typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : null,
    });
  }
  for (const row of asRows(payload.focus_areas)) {
    const id = typeof row.id === "string" ? row.id : "";
    lines.push({
      kindLabel: "Stoßrichtung",
      title: titleFromRow(row, titleById(sources?.focusAreas, id)),
      decisionLabel: decisionLabelDe(typeof row.decision === "string" ? row.decision : null),
      comment: typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : null,
    });
  }
  for (const row of asRows(payload.objectives)) {
    const id = typeof row.id === "string" ? row.id : "";
    lines.push({
      kindLabel: "Ziel",
      title: titleFromRow(row, titleById(sources?.objectives, id)),
      decisionLabel: decisionLabelDe(typeof row.decision === "string" ? row.decision : null),
      comment: typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : null,
    });
  }
  return lines;
}
