"use client";

import type { DesignReadinessSnapshotResult } from "@/lib/strategy-cycle/design-readiness-snapshot";
import type { DesignFieldsTreemapResult } from "@/lib/strategy-cycle/design-fields-treemap";
import { DesignQualityConnectionReviewPanel } from "@/components/ceo/strategy-cycle/DesignQualityConnectionReviewPanel";
import { StrategicDesignReadinessFlow } from "@/components/ceo/strategy-cycle/StrategicDesignReadinessFlow";
import { DesignFieldsSection } from "@/components/ceo/strategy-cycle/design-fields/DesignFieldsSection";
import type { DirectionGroupingPreview } from "@/components/ceo/strategy-cycle/design-fields/design-fields-types";
import type { DesignQualityConnectionReviewResult, ReviewCategory } from "@/lib/strategy-cycle/design-quality-connection-review";
import type { CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";
import type { ImpactPathGraph } from "@/lib/strategy-cycle/impact-path-graph";
import { ImpactPathQualitySection } from "@/components/ceo/strategy-cycle/impact-path/ImpactPathQualitySection";

type Props = {
  readinessSnapshot: DesignReadinessSnapshotResult;
  designFieldsTreemap: DesignFieldsTreemapResult;
  qualityReview: DesignQualityConnectionReviewResult;
  impactPathGraph: ImpactPathGraph;
  correlationSummary: CorrelationSummaryResult;
  canWrite?: boolean;
  llmSuggestionsEnabled?: boolean;
  directionGroupings?: DirectionGroupingPreview[];
  autoExpandQualityCategory?: ReviewCategory;
};

export function StrategicDesignDashboard({
  readinessSnapshot,
  designFieldsTreemap,
  qualityReview,
  impactPathGraph,
  correlationSummary,
  canWrite = false,
  llmSuggestionsEnabled = false,
  directionGroupings = [],
  autoExpandQualityCategory,
}: Props) {
  const openReviewHintsCount = readinessSnapshot.overall.openReviewHintsCount;

  return (
    <div className="space-y-4">
      <StrategicDesignReadinessFlow snapshot={readinessSnapshot} />

      <DesignQualityConnectionReviewPanel
        review={qualityReview}
        openReviewHintsCount={openReviewHintsCount}
        autoExpandCategory={autoExpandQualityCategory}
      />

      <ImpactPathQualitySection
        impactPathGraph={impactPathGraph}
        correlationSummary={correlationSummary}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Design Summary</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Entscheidungsvorbereitung entlang des Designprozesses: Muster verstehen, Qualität und
            Verbindungen prüfen, nächste Schritte festlegen.
          </p>
        </div>
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-700">
          Entscheidungsvorbereitung
        </span>
      </div>

      <DesignFieldsSection
        data={designFieldsTreemap}
        canWrite={canWrite}
        llmSuggestionsEnabled={llmSuggestionsEnabled}
        directionGroupings={directionGroupings}
      />
    </div>
  );
}
