"use client";

import type {
  DesignReadinessFocus,
  DesignReadinessSnapshotResult,
} from "@/lib/strategy-cycle/design-readiness-snapshot";
import { useState } from "react";
import { ContextCoverageStrip } from "./readiness/ContextCoverageStrip";
import { ContextDistributionSection } from "./readiness/ContextDistributionSection";
import { DerivationQualityStrip } from "./readiness/DerivationQualityStrip";
import { FocusDetailPanel } from "./readiness/FocusDetailPanel";
import { LifecycleMiniBar } from "./readiness/LifecycleMiniBar";
import { ReadinessFlowStageCard } from "./readiness/ReadinessFlowStageCard";
import { ReadinessFocusToggle } from "./readiness/ReadinessFocusToggle";
import { ReadinessOverallStrip } from "./readiness/ReadinessOverallStrip";

type Props = {
  snapshot: DesignReadinessSnapshotResult;
};

function FlowConnector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-0.5 lg:min-w-[5rem]">
      <span className="order-2 mt-1 max-w-[4.5rem] text-center text-[9px] font-medium leading-tight text-zinc-500 lg:order-1 lg:mb-1 lg:mt-0">
        {label}
      </span>
      <svg
        viewBox="0 0 24 16"
        className="order-1 h-4 w-7 shrink-0 rotate-90 text-zinc-600 lg:order-2 lg:rotate-0"
        aria-hidden
      >
        <path
          d="M0 8 H16 M12 4 L18 8 L12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function stageHighlight(
  stage: "analysis" | "challenges" | "directions" | "objectives",
  focus: DesignReadinessFocus
): "primary" | "secondary" | "dimmed" | "normal" {
  if (focus === "challenges") {
    if (stage === "challenges") return "primary";
    if (stage === "analysis") return "secondary";
    if (stage === "objectives") return "dimmed";
    return "normal";
  }
  if (stage === "directions") return "primary";
  if (stage === "objectives") return "secondary";
  if (stage === "analysis") return "dimmed";
  return "normal";
}

export function StrategicDesignReadinessFlow({ snapshot }: Props) {
  const [focus, setFocus] = useState<DesignReadinessFocus>("challenges");
  const { flow, context, contextDistributions, focusDetails } = snapshot;
  const contextFocus =
    focus === "challenges" ? context.challengesFocus : context.directionsFocus;

  const ch = flow.challenges;
  const dir = flow.directions;
  const obj = flow.objectives;

  return (
    <article className="brand-card space-y-5 p-6">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-zinc-900">Design Readiness Snapshot</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Regelbasierte Sicht auf die strategische Ableitungskette — wie tragfähig ist die
            Ableitung von Analyse-Erkenntnissen zu Herausforderungen, Stoßrichtungen und Zielen?
          </p>
        </div>
        <ReadinessOverallStrip overall={snapshot.overall} />
      </div>

      <ReadinessFocusToggle focus={focus} onFocusChange={setFocus} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
            <ReadinessFlowStageCard
              label="Analyse-Einträge"
              mainValue={String(flow.analysis.total)}
              subHint={
                flow.analysis.total > 0
                  ? `${flow.analysis.linkedToActiveChallenges} von ${flow.analysis.total} in aktive Herausforderungen überführt`
                  : flow.analysis.hint
              }
              status={flow.analysis.status}
              highlight={stageHighlight("analysis", focus)}
            />
            <FlowConnector label="verarbeitet in" />
            <ReadinessFlowStageCard
              label="Herausforderungen"
              mainValue={`${ch.readinessRelevant} von ${ch.total}`}
              subHint={`${ch.readinessRelevant} werden im aktuellen Design bewertet`}
              status={ch.status}
              highlight={stageHighlight("challenges", focus)}
              metrics={
                ch.readinessRelevant > 0
                  ? [
                      {
                        label: "Analysebasis",
                        value: `${ch.analysisBasedCount}/${ch.readinessRelevant}`,
                      },
                      {
                        label: "Stoßrichtungsantwort",
                        value: `${ch.withDirectionCount}/${ch.readinessRelevant}`,
                      },
                    ]
                  : undefined
              }
            >
              <LifecycleMiniBar
                counts={ch.lifecycleCounts}
                title="Lifecycle"
                prominent={focus === "challenges"}
              />
            </ReadinessFlowStageCard>
            <FlowConnector label="beantwortet durch" />
            <ReadinessFlowStageCard
              label="Stoßrichtungen"
              mainValue={`${dir.eligible} von ${dir.total}`}
              subHint={`${dir.eligible} wirksam aktiv im Design`}
              status={dir.status}
              highlight={stageHighlight("directions", focus)}
              metrics={
                dir.eligible > 0
                  ? [
                      {
                        label: "Herausforderungen beantwortet",
                        value: `${dir.challengesCoveredCount}/${dir.challengesCoverageTotal}`,
                      },
                      {
                        label: "Ziele unterstützt",
                        value: `${obj.coveredByEligibleDirections}/${obj.totalEligible}`,
                      },
                    ]
                  : undefined
              }
            >
              <LifecycleMiniBar
                counts={dir.lifecycleCounts}
                title="Lifecycle"
                prominent={focus === "directions"}
              />
            </ReadinessFlowStageCard>
            <FlowConnector label="zahlen ein auf" />
            <ReadinessFlowStageCard
              label="Strategische Ziele"
              mainValue={`${obj.coveredByEligibleDirections} von ${obj.totalEligible}`}
              subHint={
                obj.totalEligible === 0
                  ? obj.hint
                  : obj.coveredByEligibleDirections === 0
                    ? "Keine Ziele ausreichend durch wirksame Stoßrichtungen unterstützt."
                    : `${obj.coveredByEligibleDirections} von ${obj.totalEligible} Zielen ausreichend durch wirksame Stoßrichtungen unterstützt.`
              }
              status={obj.status}
              highlight={stageHighlight("objectives", focus)}
            />
          </div>

          <DerivationQualityStrip flow={flow} />

          <ContextCoverageStrip
            focus={focus}
            industries={contextFocus.industries}
            businessModels={contextFocus.businessModels}
          />

          <ContextDistributionSection
            focus={focus}
            contextDistributions={contextDistributions}
          />
        </div>

        <FocusDetailPanel detail={focusDetails[focus]} />
      </div>
    </article>
  );
}
