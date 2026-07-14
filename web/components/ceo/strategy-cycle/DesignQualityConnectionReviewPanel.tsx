"use client";

import {
  categoryItems,
  categorySummary,
  DESIGN_QUALITY_REVIEW_TOP_N,
  type DesignQualityConnectionReviewResult,
  type ReviewCategory,
  type ReviewCheckpointItem,
  type ReviewSeverity,
} from "@/lib/strategy-cycle/design-quality-connection-review";
import { descriptionQualityListHref, primaryDescriptionQualityListHref } from "@/lib/strategy-cycle/description-quality-view";
import { bandBadgeClass } from "@/components/ceo/strategy-cycle/readiness/readiness-ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  review: DesignQualityConnectionReviewResult;
  openReviewHintsCount: number;
  autoExpandCategory?: ReviewCategory;
};

const CATEGORY_ORDER: ReviewCategory[] = [
  "insufficient_description",
  "missing_connections",
  "questionable_connections",
  "professional_overrides",
];

const SUMMARY_LABELS: Record<ReviewCategory, string> = {
  insufficient_description: "Mangelnde Beschreibung",
  missing_connections: "Fehlende Verbindungen",
  questionable_connections: "Fragwürdige Verbindungen",
  professional_overrides: "Overrides",
};

const SUMMARY_COUNTS: Record<
  ReviewCategory,
  keyof DesignQualityConnectionReviewResult["summary"]
> = {
  insufficient_description: "insufficientDescription",
  missing_connections: "missingConnections",
  questionable_connections: "questionableConnections",
  professional_overrides: "professionalOverrides",
};

function severityStatusLabel(severity: ReviewSeverity | null, count: number): string {
  if (count === 0) return "Ok";
  if (severity === "high") return "Nacharbeiten";
  if (severity === "medium") return "Prüfen";
  return "Hinweis";
}

function severityToBand(
  severity: ReviewSeverity | null,
  count: number
): "high" | "medium" | "low" | "unknown" {
  if (count === 0) return "high";
  if (severity === "high") return "low";
  if (severity === "medium") return "medium";
  return "medium";
}

function CheckpointCard({ item }: { item: ReviewCheckpointItem }) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
          {item.objectTypeDe}
        </span>
        {item.subtypeLabelDe ? (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-900">
            {item.subtypeLabelDe}
          </span>
        ) : null}
        <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500">
          {item.severity === "high" ? "Hoch" : item.severity === "medium" ? "Mittel" : "Niedrig"}
        </span>
      </div>
      {item.relationLabelDe ? (
        <p className="mt-1.5 text-xs text-zinc-500">{item.relationLabelDe}</p>
      ) : null}
      <p className="mt-0.5 font-medium text-zinc-900">{item.titleDe}</p>
      <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{item.hintDe}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={item.actionHref}
          className="text-xs font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
        >
          {item.actionLabelDe}
        </Link>
        {item.score != null ? (
          <span className="text-[10px] font-medium text-zinc-500">Score {item.score}</span>
        ) : null}
      </div>
    </article>
  );
}

function countInsufficientDescriptionByKind(
  items: ReviewCheckpointItem[]
): { challenges: number; directions: number; objectives: number } {
  let challenges = 0;
  let directions = 0;
  let objectives = 0;
  for (const item of items) {
    if (item.id.startsWith("desc:challenge:")) challenges += 1;
    else if (item.id.startsWith("desc:direction:")) directions += 1;
    else if (item.id.startsWith("desc:objective:")) objectives += 1;
  }
  return { challenges, directions, objectives };
}

function CategoryCard({
  category,
  review,
  initiallyExpanded = false,
  forceExpanded = false,
}: {
  category: ReviewCategory;
  review: DesignQualityConnectionReviewResult;
  initiallyExpanded?: boolean;
  forceExpanded?: boolean;
}) {
  const meta = review.categoryMeta[category];
  const items = categoryItems(review, category);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [showAll, setShowAll] = useState(
    initiallyExpanded && items.length > DESIGN_QUALITY_REVIEW_TOP_N
  );

  useEffect(() => {
    if (!forceExpanded) return;
    setExpanded(true);
    if (items.length > DESIGN_QUALITY_REVIEW_TOP_N) setShowAll(true);
  }, [forceExpanded, items.length]);
  const { count, maxSeverity } = categorySummary(review, category);
  const statusLabel = severityStatusLabel(maxSeverity, count);
  const band = severityToBand(maxSeverity, count);
  const visible = showAll ? items : items.slice(0, DESIGN_QUALITY_REVIEW_TOP_N);
  const insufficientByKind =
    category === "insufficient_description"
      ? countInsufficientDescriptionByKind(items)
      : null;

  return (
    <article
      id={`design-quality-${category}`}
      className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-900">{meta.titleDe}</h4>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{count}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${bandBadgeClass(band)}`}
        >
          {statusLabel}
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-600">{meta.explanationDe}</p>
      {count === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">{meta.emptyTextDe}</p>
      ) : (
        <>
          <Link
            href={
              insufficientByKind
                ? primaryDescriptionQualityListHref(insufficientByKind)
                : meta.primaryActionHref
            }
            className="mt-3 inline-block text-xs font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
          >
            {meta.primaryActionLabelDe}
          </Link>
          {insufficientByKind ? (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {insufficientByKind.challenges > 0 ? (
                <Link
                  href={descriptionQualityListHref({
                    l1: "strategic-directions",
                    l2: "challenges",
                    qualityFilter: "needs_work",
                  })}
                  className="font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
                >
                  Herausforderungen ({insufficientByKind.challenges})
                </Link>
              ) : null}
              {insufficientByKind.directions > 0 ? (
                <Link
                  href={descriptionQualityListHref({
                    l1: "strategic-directions",
                    l2: "design",
                    qualityFilter: "needs_work",
                  })}
                  className="font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
                >
                  Stoßrichtungen ({insufficientByKind.directions})
                </Link>
              ) : null}
              {insufficientByKind.objectives > 0 ? (
                <Link
                  href={descriptionQualityListHref({
                    l1: "objectives",
                    qualityFilter: "needs_work",
                  })}
                  className="font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
                >
                  Ziele ({insufficientByKind.objectives})
                </Link>
              ) : null}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 block text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
          >
            {expanded ? "Top-Prüfpunkte ausblenden" : "Top-Prüfpunkte anzeigen"}
          </button>
          {expanded ? (
            <div className="mt-3 space-y-2">
              {visible.map((item) => (
                <CheckpointCard key={item.id} item={item} />
              ))}
              {items.length > DESIGN_QUALITY_REVIEW_TOP_N ? (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
                >
                  {showAll ? "Weniger anzeigen" : `Alle ${items.length} anzeigen`}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

export function DesignQualityConnectionReviewPanel({
  review,
  openReviewHintsCount,
  autoExpandCategory,
}: Props) {
  const { summary } = review;
  const allEmpty = summary.total === 0 && openReviewHintsCount === 0;
  const panelRef = useRef<HTMLElement>(null);
  const [highlightCategory, setHighlightCategory] = useState<ReviewCategory | null>(
    autoExpandCategory ?? null
  );

  useEffect(() => {
    if (!autoExpandCategory) return;
    const target = document.getElementById(`design-quality-${autoExpandCategory}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightCategory(autoExpandCategory);
  }, [autoExpandCategory]);

  const scrollToCategory = (category: ReviewCategory) => {
    document.getElementById(`design-quality-${category}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setHighlightCategory(category);
  };

  return (
    <article ref={panelRef} className="brand-card p-6">
      <h3 className="text-base font-semibold text-zinc-900">Design-Qualität & Verbindungsprüfung</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Zuerst prüfen, ob Strategieobjekte analysefähig beschrieben sind — danach fehlende und
        fragwürdige Verbindungen sowie fachliche Overrides.
      </p>

      {allEmpty ? (
        <p className="mt-4 text-sm text-zinc-600">
          Keine offenen Prüfpunkte — Design wirkt nach aktuellen Schwellen konsistent.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs text-zinc-700">
            {CATEGORY_ORDER.map((category, index) => {
              const count = summary[SUMMARY_COUNTS[category]];
              const label = SUMMARY_LABELS[category];
              return (
                <span key={category}>
                  {index > 0 ? <span className="mx-2 text-zinc-300">·</span> : null}
                  {category === "insufficient_description" && count > 0 ? (
                    <button
                      type="button"
                      onClick={() => scrollToCategory(category)}
                      className="font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
                    >
                      {label}: {count}
                    </button>
                  ) : (
                    <>
                      <span className="font-medium">{label}:</span> {count}
                    </>
                  )}
                </span>
              );
            })}
            <span className="mx-2 text-zinc-300">·</span>
            <span className="font-medium">Gesamt:</span> {summary.total}
          </p>
          {review.snapshotDelta != null && review.snapshotDelta !== 0 ? (
            <p className="mt-1 text-[10px] text-zinc-500">
              {openReviewHintsCount} Hinweise im Snapshot, {summary.total} in dieser Aufschlüsselung.
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {CATEGORY_ORDER.map((category) => (
              <CategoryCard
                key={category}
                category={category}
                review={review}
                initiallyExpanded={autoExpandCategory === category}
                forceExpanded={highlightCategory === category}
              />
            ))}
          </div>
        </>
      )}
    </article>
  );
}
