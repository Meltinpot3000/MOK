"use client";

import type { DesignFieldNode } from "@/lib/strategy-cycle/design-fields-treemap";
import type { DesignFieldDirection } from "@/lib/strategy-cycle/design-fields-treemap";
import Link from "next/link";
import {
  DESIGN_TAB_HREF,
  STRATEGY_MATRIX_HREF,
  designFieldStatusBadgeClass,
  designFieldStatusLabelDe,
} from "./design-fields-ui";

type Props = {
  node: DesignFieldNode | null;
  selectedDirection: DesignFieldDirection | null;
};

const MAX_DIRECTIONS = 8;

export function DesignFieldDetailPanel({ node, selectedDirection }: Props) {
  if (!node) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-4 text-sm text-zinc-500">
        Kachel auswählen, um Details zu sehen.
      </div>
    );
  }

  if (selectedDirection) {
    return (
      <div className="flex h-full flex-col rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
        <div className="border-b border-zinc-200 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Stoßrichtung in {node.label}
          </p>
          {node.nodeKind === "ungrouped_backlog" ? (
            <p className="mt-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-900">
              Diese Stoßrichtung ist noch keinem Designfeld zugeordnet.
            </p>
          ) : null}
          <h3 className="mt-1 text-sm font-semibold text-zinc-900">{selectedDirection.title}</h3>
          <p className="mt-0.5 text-xs text-zinc-600">Gewicht {selectedDirection.score.toFixed(1)}</p>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-zinc-200 bg-white px-2 py-1.5">
              <p className="text-[10px] uppercase text-zinc-500">HF-Bezug</p>
              <p className="font-medium tabular-nums text-zinc-900">
                {selectedDirection.challengeImpact.toFixed(1)}
              </p>
            </div>
            <div className="rounded border border-zinc-200 bg-white px-2 py-1.5">
              <p className="text-[10px] uppercase text-zinc-500">Ziel-Bezug</p>
              <p className="font-medium tabular-nums text-zinc-900">
                {selectedDirection.objectiveAlignment.toFixed(1)}
              </p>
            </div>
          </div>

          {selectedDirection.linkedChallengeTitles.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Herausforderungen
              </p>
              <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                {selectedDirection.linkedChallengeTitles.map((t) => (
                  <li key={t} className="rounded border border-zinc-200 bg-white px-2 py-1">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedDirection.linkedObjectiveTitles.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Ziele</p>
              <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                {selectedDirection.linkedObjectiveTitles.map((t) => (
                  <li key={t} className="rounded border border-zinc-200 bg-white px-2 py-1">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t border-zinc-200 pt-3">
          <Link
            href={DESIGN_TAB_HREF}
            className="inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Stoßrichtung pflegen
          </Link>
        </div>
      </div>
    );
  }

  const isBacklog = node.nodeKind === "ungrouped_backlog";
  const directions = isBacklog ? node.directions.slice(0, 5) : node.directions.slice(0, MAX_DIRECTIONS);
  const moreDirections = node.directions.length - directions.length;

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-zinc-200 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900">{node.label}</h3>
          <p className="mt-0.5 text-xs text-zinc-600">
            {node.directionCount} Stoßrichtung{node.directionCount === 1 ? "" : "en"} · Gewicht{" "}
            {node.weight.toFixed(1)}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            isBacklog
              ? "border-amber-500/60 bg-amber-100 text-amber-950"
              : designFieldStatusBadgeClass(node.status)
          }`}
        >
          {isBacklog ? "Bearbeitungsbedarf" : designFieldStatusLabelDe(node.status)}
        </span>
      </div>

      {isBacklog ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-zinc-700">
            {node.structureHint ??
              `${node.directionCount} Stoßrichtungen sind noch keinem Designfeld zugeordnet.`}
          </p>
          <p className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-950">
            Für die Management-Review-Sicht sollten 3–5 Designfelder gebildet werden.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-zinc-700">{node.shortStatus}</p>
          {node.reviewHints.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Review-Hinweise
              </p>
              <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                {node.reviewHints.map((hint) => (
                  <li key={hint} className="rounded border border-zinc-200 bg-white px-2 py-1.5">
                    {hint}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {isBacklog ? "Top-Stoßrichtungen ohne Designfeld" : "Stoßrichtungen"}
          </p>
          <ul className="mt-1 space-y-1">
            {directions.map((d) => (
              <li
                key={d.directionId}
                className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 truncate font-medium text-zinc-900">{d.title}</span>
                <span className="shrink-0 tabular-nums text-zinc-600">{d.score.toFixed(1)}</span>
              </li>
            ))}
          </ul>
          {moreDirections > 0 ? (
            <p className="mt-1 text-[11px] text-zinc-500">+{moreDirections} weitere</p>
          ) : null}
        </div>

        {!isBacklog && node.challengeTitles.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Wichtige Herausforderungen
            </p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {node.challengeTitles.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-700"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!isBacklog && node.objectiveTitles.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Unterstützte Ziele
            </p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {node.objectiveTitles.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-700"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200 pt-3">
        {!isBacklog ? (
          <>
            <Link
              href={DESIGN_TAB_HREF}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Stoßrichtungen pflegen
            </Link>
            {node.status !== "strong" ? (
              <Link
                href={STRATEGY_MATRIX_HREF}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Verknüpfungen prüfen
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
