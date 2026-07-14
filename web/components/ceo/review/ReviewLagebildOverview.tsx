"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { ReviewLagebildSnapshot } from "@/lib/review/review-lagebild";
import type { ReviewAttentionItem } from "@/lib/review/review-attention-rules";
import type {
  ReviewLagebildDrillId,
  ReviewLagebildDrillTables,
} from "@/lib/review/review-lagebild-drill-tables";
import { KPI_ACCENTS } from "@/components/ceo/KpiCards";
import { KpiCardTile } from "@/components/ceo/KpiCardTile";
import { DrillThroughModal } from "@/components/ceo/DrillThroughModal";
import {
  ReviewCyclePulseInfo,
  ReviewCyclePulseRing,
} from "@/components/ceo/review/ReviewCyclePulseCard";
import type { ReviewCyclePulseModel } from "@/lib/review/review-cycle-pulse";

type ReviewLagebildCounts = {
  directions: number;
  programs: number;
  initiatives: number;
  annualTargets: number;
};

type ReviewLagebildOverviewProps = {
  lagebild: ReviewLagebildSnapshot;
  managementInterpretation: string[];
  attentionItems: ReviewAttentionItem[];
  drillTables: ReviewLagebildDrillTables;
  counts: ReviewLagebildCounts;
  cyclePulse: ReviewCyclePulseModel | null;
};

type DrillConfig = {
  label: string;
  href: string;
  hrefLabel: string;
  emptyText: string;
};

const DRILL_CONFIGS: Record<ReviewLagebildDrillId, DrillConfig> = {
  directions: {
    label: "Stoßrichtungen",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Keine aktiven Stoßrichtungen im Zyklus.",
  },
  programs: {
    label: "Programme",
    href: "/strategy-cycle?l1=pips&l2=programme",
    hrefLabel: "Zu den Programmen",
    emptyText: "Keine Programme im Zyklus.",
  },
  "annual-targets": {
    label: "Jahresziele",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Keine Jahresziele im Zyklus.",
  },
  initiatives: {
    label: "Initiativen",
    href: "/reviews?tab=initiativen",
    hrefLabel: "Zur Initiativenliste",
    emptyText: "Keine Initiativen im Zyklus.",
  },
  "content-progress": {
    label: "Umsetzungsfortschritt",
    href: "/reviews?tab=initiativen",
    hrefLabel: "Zur Initiativenliste",
    emptyText: "Keine gewichteten aktiven Initiativen.",
  },
  "time-progress": {
    label: "Zeitfortschritt Zyklus",
    href: "/reviews?tab=lagebild",
    hrefLabel: "Zum Lagebild",
    emptyText: "Zykluszeitraum nicht hinterlegt.",
  },
  delta: {
    label: "Delta Zeit vs. Umsetzung",
    href: "/reviews?tab=initiativen",
    hrefLabel: "Zur Initiativenliste",
    emptyText: "Keine aktiven Initiativen für den Vergleich.",
  },
  "status-on-track": {
    label: "Stoßrichtungen — Auf Kurs",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Keine Stoßrichtungen in diesem Status.",
  },
  "status-at-risk": {
    label: "Stoßrichtungen — Gefährdet",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Keine Stoßrichtungen in diesem Status.",
  },
  "status-off-track": {
    label: "Stoßrichtungen — Kritisch",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Keine Stoßrichtungen in diesem Status.",
  },
  "status-no-coverage": {
    label: "Stoßrichtungen — Keine operative Abdeckung",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Keine Stoßrichtungen in diesem Status.",
  },
  "status-unclear": {
    label: "Stoßrichtungen — Unklar",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Keine Stoßrichtungen in diesem Status.",
  },
  "without-execution": {
    label: "Stoßrichtungen — Keine operative Abdeckung",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Alle aktiven Richtungen haben operative Abdeckung.",
  },
  "open-signals": {
    label: "Handlungsbedarf",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Kein Handlungsbedarf nach aktuellen Regeln.",
  },
  "initiative-signals": {
    label: "Initiativen — Handlungsbedarf",
    href: "/reviews?tab=initiativen",
    hrefLabel: "Zur Initiativenliste",
    emptyText: "Kein Handlungsbedarf an Initiativen.",
  },
  "overdue-reviews": {
    label: "Überfällige Reviews",
    href: "/reviews?tab=initiativen",
    hrefLabel: "Zur Initiativenliste",
    emptyText: "Keine überfälligen Reviews.",
  },
  "strategy-impulses": {
    label: "Strategie-Impulse",
    href: "/reviews?tab=netzwerk",
    hrefLabel: "Zum Umsetzungsnetzwerk",
    emptyText: "Keine Strategie-Impulse (Review-Rückmeldungen) im Zyklus.",
  },
  "overdue-deadlines": {
    label: "Überfällige Termine",
    href: "/reviews?tab=initiativen",
    hrefLabel: "Zur Initiativenliste",
    emptyText: "Keine überfälligen Initiativen- oder Key-Result-Termine.",
  },
};

function readinessBadge(lagebild: ReviewLagebildSnapshot): { label: string; className: string } {
  if (lagebild.directionsOffTrackCount > 0) {
    return { label: "Kritisch", className: "border-red-200 bg-red-50 text-red-800" };
  }
  if (lagebild.directionsAtRiskCount > 0) {
    return { label: "Gefährdet", className: "border-amber-200 bg-amber-50 text-amber-900" };
  }
  if (lagebild.directionsOnTrackCount > 0) {
    return { label: "Auf Kurs", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  }
  return { label: "Prüfen", className: "border-zinc-200 bg-zinc-50 text-zinc-700" };
}

function attentionHref(item: ReviewAttentionItem): string {
  if (item.initiativeId) return "/reviews?tab=initiativen";
  return "/reviews?tab=netzwerk";
}

function ReviewLagebildActionItems({ items }: { items: ReviewAttentionItem[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900">Handlungsbedarf</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Priorisierter Handlungsbedarf — nächste Schritte im Lagebild.
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">Kein unmittelbarer Handlungsbedarf nach aktuellen Regeln.</p>
      ) : (
        <ol className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link
                href={attentionHref(item)}
                className="block rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm hover:border-zinc-300 hover:bg-white"
              >
                <span className="font-medium text-zinc-900">
                  {index + 1}. {item.title}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-600">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const drillFooter = (
  <p className="mt-2 text-[10px] font-medium text-indigo-700 group-hover:underline">Details anzeigen →</p>
);

type LagebildHub = "directions" | "initiatives" | "progress-ratio";

export function ReviewLagebildOverview({
  lagebild,
  managementInterpretation,
  attentionItems,
  drillTables,
  counts,
  cyclePulse,
}: ReviewLagebildOverviewProps) {
  const [activeHub, setActiveHub] = useState<LagebildHub | null>(null);
  const [activeDrill, setActiveDrill] = useState<ReviewLagebildDrillId | null>(null);

  const closeDrill = useCallback(() => {
    setActiveHub(null);
    setActiveDrill(null);
  }, []);

  const openDrill = useCallback((id: ReviewLagebildDrillId) => {
    setActiveHub(null);
    setActiveDrill(id);
  }, []);

  const openDirectionsHub = useCallback(() => {
    setActiveHub("directions");
    setActiveDrill(null);
  }, []);

  const openInitiativesHub = useCallback(() => {
    setActiveHub("initiatives");
    setActiveDrill(null);
  }, []);

  const openFromHub = useCallback((hub: LagebildHub, id: ReviewLagebildDrillId) => {
    setActiveHub(hub);
    setActiveDrill(id);
  }, []);

  const backToHub = useCallback(() => {
    setActiveDrill(null);
  }, []);

  const openProgressRatioHub = useCallback(() => {
    setActiveHub("progress-ratio");
    setActiveDrill(null);
  }, []);

  const badge = readinessBadge(lagebild);
  const deltaLabel =
    lagebild.deltaPp === null
      ? "k. A."
      : lagebild.deltaPp >= 0
        ? `+${lagebild.deltaPp} PP voraus`
        : `${lagebild.deltaPp} PP zurück`;

  const contentPct = lagebild.weightedContentProgress;
  const timePct = lagebild.timeProgressPercent;
  const umsetzungsRatioPercent =
    contentPct !== null && timePct > 0 ? Math.round((contentPct / timePct) * 100) : null;
  const umsetzungsRatioLabel =
    umsetzungsRatioPercent !== null ? `${umsetzungsRatioPercent}%` : "k. A.";
  const umsetzungsRatioHint = [
    contentPct !== null ? `Umsetzung ${contentPct}%` : "Umsetzung k. A.",
    `Zeit ${timePct}%`,
    deltaLabel !== "k. A." ? deltaLabel : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const activeConfig = activeDrill ? DRILL_CONFIGS[activeDrill] : null;
  const showDirectionsHub = activeHub === "directions" && activeDrill === null;
  const showInitiativesHub = activeHub === "initiatives" && activeDrill === null;
  const showProgressRatioHub = activeHub === "progress-ratio" && activeDrill === null;
  const showDetailTable = activeDrill !== null && activeConfig !== null;

  const entityTiles: Array<{
    drillId: ReviewLagebildDrillId;
    label: string;
    value: string;
    hint: string;
    accent: string;
    badge?: string | null;
  }> = [
    {
      drillId: "directions",
      label: "Stoßrichtungen",
      value: String(counts.directions),
      hint:
        lagebild.directionSignalCount > 0
          ? `${lagebild.directionSignalCount} Handlungsbedarf (Richtungs-Ebene)`
          : "Status-Drill: Auf Kurs bis Unklar",
      accent: KPI_ACCENTS[3],
      badge:
        lagebild.directionSignalCount > 0
          ? `${lagebild.directionSignalCount} Handlungsbedarf`
          : null,
    },
    {
      drillId: "programs",
      label: "Programme",
      value: String(counts.programs),
      hint: "PIP / Maßnahmenlandschaft",
      accent: KPI_ACCENTS[4],
    },
    {
      drillId: "annual-targets",
      label: "Jahresziele",
      value: String(counts.annualTargets),
      hint: "Planungsanker L2",
      accent: KPI_ACCENTS[1],
    },
    {
      drillId: "initiatives",
      label: "Initiativen",
      value: String(counts.initiatives),
      hint: (() => {
        const parts: string[] = [];
        if (lagebild.initiativeSignalCount > 0) {
          parts.push(
            `${lagebild.initiativeSignalCount} Handlungsbedarf`
          );
        }
        if (lagebild.overdueReviewCount > 0) {
          parts.push(
            `${lagebild.overdueReviewCount} überfällige Review${lagebild.overdueReviewCount === 1 ? "" : "s"}`
          );
        }
        return parts.length > 0 ? parts.join(" · ") : "Drill: Handlungsbedarf & Reviews";
      })(),
      accent: KPI_ACCENTS[5],
      badge:
        lagebild.initiativeSignalCount > 0
          ? `${lagebild.initiativeSignalCount} Handlungsbedarf`
          : null,
    },
    {
      drillId: "strategy-impulses",
      label: "Strategie-Impulse",
      value: String(lagebild.strategyImpulseCount),
      hint: "Manuelle Rückmeldungen aus dem Review",
      accent: KPI_ACCENTS[0],
    },
  ];

  const directionStatusTiles: Array<{
    drillId: ReviewLagebildDrillId;
    label: string;
    value: string;
    hint: string;
    accent: string;
  }> = [
    {
      drillId: "status-on-track",
      label: "Auf Kurs",
      value: String(lagebild.directionsOnTrackCount),
      hint: "ohne relevanten Handlungsbedarf",
      accent: KPI_ACCENTS[2],
    },
    {
      drillId: "status-at-risk",
      label: "Gefährdet",
      value: String(lagebild.directionsAtRiskCount),
      hint: "Reviews, Owner, Verzüge",
      accent: KPI_ACCENTS[4],
    },
    {
      drillId: "status-off-track",
      label: "Kritisch",
      value: String(lagebild.directionsOffTrackCount),
      hint: "Blocker, Überfälligkeit",
      accent: KPI_ACCENTS[3],
    },
    {
      drillId: "status-no-coverage",
      label: "Keine operative Abdeckung",
      value: String(lagebild.directionsUnsupportedCount),
      hint: "ohne JZ, Programm, Initiative oder OKR/KR",
      accent: KPI_ACCENTS[0],
    },
    {
      drillId: "status-unclear",
      label: "Unklar",
      value: String(lagebild.directionsUnclearCount),
      hint: "keine belastbare Zuordnung",
      accent: KPI_ACCENTS[1],
    },
  ];

  const initiativeHubTiles: Array<{
    drillId: ReviewLagebildDrillId;
    label: string;
    value: string;
    hint: string;
    accent: string;
    badge?: string | null;
  }> = [
    {
      drillId: "initiative-signals",
      label: "Handlungsbedarf",
      value: String(lagebild.initiativeSignalCount),
      hint: "regelbasierte Attention an Initiativen",
      accent: KPI_ACCENTS[1],
      badge:
        lagebild.initiativeSignalCount > 0
          ? `${lagebild.initiativeSignalCount} offen`
          : null,
    },
    {
      drillId: "overdue-reviews",
      label: "Überfällige Reviews",
      value: String(lagebild.overdueReviewCount),
      hint: "nie oder > 30 Tage reviewt",
      accent: KPI_ACCENTS[4],
      badge:
        lagebild.overdueReviewCount > 0
          ? `${lagebild.overdueReviewCount} offen`
          : null,
    },
  ];

  const progressRatioHubTiles: Array<{
    drillId: ReviewLagebildDrillId;
    label: string;
    value: string;
    hint: string;
    accent: string;
  }> = [
    {
      drillId: "content-progress",
      label: "Umsetzungsfortschritt",
      value: contentPct !== null ? `${contentPct}%` : "k. A.",
      hint: "gewichtet über aktive Initiativen",
      accent: KPI_ACCENTS[2],
    },
    {
      drillId: "time-progress",
      label: "Zeitlicher Fortschritt",
      value: `${timePct}%`,
      hint: "linearer Zeitanteil im Reviewzyklus",
      accent: KPI_ACCENTS[1],
    },
    {
      drillId: "delta",
      label: "Delta Zeit vs. Umsetzung",
      value:
        lagebild.deltaPp === null
          ? "k. A."
          : lagebild.deltaPp >= 0
            ? `+${lagebild.deltaPp} PP`
            : `${lagebild.deltaPp} PP`,
      hint: deltaLabel,
      accent:
        lagebild.deltaPp !== null && lagebild.deltaPp < 0
          ? KPI_ACCENTS[3]
          : KPI_ACCENTS[2],
    },
  ];

  return (
    <div className="space-y-6">
      <section className="brand-card p-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-stretch">
          <div className="min-w-0">
            {cyclePulse ? (
              <ReviewCyclePulseRing model={cyclePulse} />
            ) : (
              <p className="text-sm text-zinc-600">Kein Reviewzyklus geladen.</p>
            )}
          </div>

          <div className="flex min-w-0 flex-col border-t border-zinc-200 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900">Management-Lagebild</h2>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              Gewichteter Umsetzungsfortschritt im Vergleich zum Zeitplan des Reviewzyklus.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-zinc-700">
              {managementInterpretation.map((sentence) => (
                <li key={sentence}>{sentence}</li>
              ))}
            </ul>
            <div className="mt-4">
              <Link
                href="/reviews?tab=netzwerk"
                className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Zum Umsetzungsnetzwerk →
              </Link>
            </div>
            <div className="mt-5 min-h-0 flex-1 border-t border-zinc-200 pt-4">
              <ReviewLagebildActionItems items={attentionItems} />
            </div>
          </div>

          <div className="min-w-0 border-t border-zinc-200 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {cyclePulse ? (
              <ReviewCyclePulseInfo model={cyclePulse} />
            ) : (
              <p className="text-sm text-zinc-600">Keine Review-Infos verfügbar.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {entityTiles.map((tile) => (
          <KpiCardTile
            key={tile.drillId}
            accent={tile.accent}
            paddingClass="p-4"
            square
            label={tile.label}
            value={tile.value}
            hint={tile.hint}
            badge={tile.badge}
            interactive
            onClick={() => {
              if (tile.drillId === "directions") openDirectionsHub();
              else if (tile.drillId === "initiatives") openInitiativesHub();
              else openDrill(tile.drillId);
            }}
            footer={drillFooter}
          />
        ))}
        <KpiCardTile
          accent={
            umsetzungsRatioPercent !== null && umsetzungsRatioPercent < 85
              ? KPI_ACCENTS[3]
              : KPI_ACCENTS[2]
          }
          paddingClass="p-4"
          square
          label="Umsetzungsratio Reviewzyklus"
          value={umsetzungsRatioLabel}
          hint={umsetzungsRatioHint}
          badge={
            lagebild.deltaPp !== null && lagebild.deltaPp < 0
              ? deltaLabel
              : lagebild.deltaPp !== null && lagebild.deltaPp > 0
                ? deltaLabel
                : null
          }
          interactive
          onClick={openProgressRatioHub}
          footer={drillFooter}
        />
      </section>

      {showDirectionsHub ? (
        <DrillThroughModal
          open
          title="Stoßrichtungen — Review-Status"
          onClose={closeDrill}
          href="/reviews?tab=netzwerk"
          hrefLabel="Zum Umsetzungsnetzwerk"
          titleId="review-lagebild-directions-hub-title"
        >
          <p className="mb-3 text-sm text-zinc-600">
            Status wählen, um die zugehörigen Stoßrichtungen zu sehen.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {directionStatusTiles.map((tile) => (
              <KpiCardTile
                key={tile.drillId}
                accent={tile.accent}
                paddingClass="p-3 sm:p-4"
                valueSizeClass="text-xl sm:text-2xl"
                label={tile.label}
                value={tile.value}
                hint={tile.hint}
                interactive
                onClick={() => openFromHub("directions", tile.drillId)}
                footer={drillFooter}
              />
            ))}
          </div>
        </DrillThroughModal>
      ) : null}

      {showInitiativesHub ? (
        <DrillThroughModal
          open
          title="Initiativen — Überblick"
          onClose={closeDrill}
          href="/reviews?tab=initiativen"
          hrefLabel="Zur Initiativenliste"
          titleId="review-lagebild-initiatives-hub-title"
        >
          <p className="mb-3 text-sm text-zinc-600">
            Handlungsbedarf oder überfällige Reviews wählen.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {initiativeHubTiles.map((tile) => (
              <KpiCardTile
                key={tile.drillId}
                accent={tile.accent}
                paddingClass="p-3 sm:p-4"
                valueSizeClass="text-xl sm:text-2xl"
                label={tile.label}
                value={tile.value}
                hint={tile.hint}
                badge={tile.badge}
                interactive
                onClick={() => openFromHub("initiatives", tile.drillId)}
                footer={drillFooter}
              />
            ))}
          </div>
        </DrillThroughModal>
      ) : null}

      {showProgressRatioHub ? (
        <DrillThroughModal
          open
          title="Umsetzungsratio Reviewzyklus"
          onClose={closeDrill}
          href="/reviews?tab=initiativen"
          hrefLabel="Zur Initiativenliste"
          titleId="review-lagebild-progress-ratio-hub-title"
        >
          <p className="mb-3 text-sm text-zinc-600">
            Ratio {umsetzungsRatioLabel}
            {contentPct !== null ? ` · Umsetzung ${contentPct}%` : ""} · Zeit {timePct}%
            {deltaLabel !== "k. A." ? ` · ${deltaLabel}` : ""}. Detail wählen.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {progressRatioHubTiles.map((tile) => (
              <KpiCardTile
                key={tile.drillId}
                accent={tile.accent}
                paddingClass="p-3 sm:p-4"
                valueSizeClass="text-xl sm:text-2xl"
                label={tile.label}
                value={tile.value}
                hint={tile.hint}
                interactive
                onClick={() => openFromHub("progress-ratio", tile.drillId)}
                footer={drillFooter}
              />
            ))}
          </div>
        </DrillThroughModal>
      ) : null}

      {showDetailTable ? (
        <DrillThroughModal
          open
          title={activeConfig.label}
          drillTable={drillTables[activeDrill]}
          emptyText={activeConfig.emptyText}
          href={activeConfig.href}
          hrefLabel={activeConfig.hrefLabel}
          onClose={closeDrill}
          onBack={activeHub ? backToHub : undefined}
          backLabel={
            activeHub === "initiatives"
              ? "Zum Initiativen-Überblick"
              : activeHub === "directions"
                ? "Zu den Status-Kacheln"
                : activeHub === "progress-ratio"
                  ? "Zur Umsetzungsratio"
                  : "Zurück"
          }
          titleId="review-lagebild-drill-title"
        />
      ) : null}
    </div>
  );
}
