"use client";

import type {
  CorrelationCell,
  CorrelationDirectionDetail,
  CorrelationStatus,
} from "@/lib/strategy-cycle/correlation";

type FocusedCorrelationNetworkProps = {
  cell: CorrelationCell;
  getStatusLabel: (status: CorrelationStatus) => string;
  getStatusBadge: (status: CorrelationStatus) => string;
};

const MAX_VISIBLE_DIRECTIONS = 3;

const NODE_ACCENT = {
  objective: "border-l-violet-500",
  challenge: "border-l-red-500",
  direction: "border-l-blue-500",
} as const;

function directionTone(status: CorrelationStatus): string {
  if (status === "green") return "border-emerald-200 bg-emerald-50";
  if (status === "yellow") return "border-amber-200 bg-amber-50";
  if (status === "red") return "border-red-200 bg-red-50";
  return "border-zinc-200 bg-zinc-50";
}

function ConnectorArrow({ dashed = false, vertical = false }: { dashed?: boolean; vertical?: boolean }) {
  if (vertical) {
    return (
      <svg
        viewBox="0 0 16 32"
        className="mx-auto h-6 w-4 shrink-0 text-zinc-400 md:hidden"
        aria-hidden
      >
        <line
          x1="8"
          y1="0"
          x2="8"
          y2="22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray={dashed ? "4 3" : undefined}
        />
        <path
          d="M4 18 L8 26 L12 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 40 16"
      className="hidden h-4 w-10 shrink-0 text-zinc-400 md:block"
      aria-hidden
    >
      <line
        x1="0"
        y1="8"
        x2="30"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <path
        d="M26 4 L34 8 L26 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NetworkNodeCard({
  kind,
  label,
  title,
  subtitle,
}: {
  kind: "objective" | "challenge";
  label: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-3 shadow-sm ${NODE_ACCENT[kind]} border-l-4`}
    >
      <p
        className="truncate text-[10px] font-semibold uppercase text-zinc-500"
        title={label}
      >
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium leading-snug text-zinc-900">{title}</p>
      {subtitle ? <p className="mt-1 break-words text-xs text-zinc-500">{subtitle}</p> : null}
    </div>
  );
}

function DirectionNodeCard({
  direction,
  index,
  getStatusLabel,
  getStatusBadge,
}: {
  direction: CorrelationDirectionDetail;
  index: number;
  getStatusLabel: (status: CorrelationStatus) => string;
  getStatusBadge: (status: CorrelationStatus) => string;
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-lg border p-2.5 shadow-sm ${NODE_ACCENT.direction} border-l-4 ${directionTone(direction.effectiveStatus)}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[10px] font-semibold uppercase text-zinc-500">
          Stoßrichtung {index + 1}
        </p>
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${getStatusBadge(direction.effectiveStatus)}`}
        >
          {getStatusLabel(direction.effectiveStatus)}
        </span>
      </div>
      <p className="mt-1 break-words text-xs font-medium leading-snug text-zinc-800">
        {direction.directionTitle}
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">
        Auto-Score: {direction.autoScore}
        {direction.hasOverride ? " · Override aktiv" : null}
      </p>
    </div>
  );
}

function EmptyDirectionPlaceholder() {
  return (
    <div className="flex min-h-[88px] min-w-0 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-100/60 px-3 py-4 text-center">
      <svg
        viewBox="0 0 24 24"
        className="mb-2 h-5 w-5 text-zinc-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M12 6v12M6 12h12" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      <p className="text-xs font-medium text-zinc-600">Keine verknüpfte Stoßrichtung</p>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
        Ziel und Herausforderung sind ohne gemeinsame Stoßrichtung verbunden.
      </p>
    </div>
  );
}

export function FocusedCorrelationNetwork({
  cell,
  getStatusLabel,
  getStatusBadge,
}: FocusedCorrelationNetworkProps) {
  const visibleDirections = cell.directions.slice(0, MAX_VISIBLE_DIRECTIONS);
  const hiddenDirectionCount = Math.max(0, cell.directions.length - MAX_VISIBLE_DIRECTIONS);
  const hasDirections = visibleDirections.length > 0;

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-gradient-to-b from-zinc-50/80 to-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border-l-4 border-l-violet-500 bg-white" aria-hidden />
          Ziel
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border-l-4 border-l-blue-500 bg-white" aria-hidden />
          Stoßrichtung
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border-l-4 border-l-red-500 bg-white" aria-hidden />
          Herausforderung
        </span>
        <span className="min-w-0 font-medium text-zinc-600 md:ml-auto">
          Korrelation: {cell.score} ({getStatusLabel(cell.status)})
        </span>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1.1fr)_2.5rem_minmax(0,1fr)] md:gap-1">
        <div className="min-w-0">
          <NetworkNodeCard
            kind="objective"
            label="Ziel"
            title={cell.objectiveTitle}
            subtitle={`${cell.directionCount} Stoßrichtung${cell.directionCount === 1 ? "" : "en"}`}
          />
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <ConnectorArrow dashed={!hasDirections} vertical />
          <ConnectorArrow dashed={!hasDirections} />
        </div>

        <div className="min-w-0 space-y-2">
          {hasDirections ? (
            visibleDirections.map((direction, index) => (
              <DirectionNodeCard
                key={direction.directionId}
                direction={direction}
                index={index}
                getStatusLabel={getStatusLabel}
                getStatusBadge={getStatusBadge}
              />
            ))
          ) : (
            <EmptyDirectionPlaceholder />
          )}
          {hiddenDirectionCount > 0 ? (
            <p className="text-center text-[11px] text-zinc-500">
              +{hiddenDirectionCount} weitere Stoßrichtung{hiddenDirectionCount === 1 ? "" : "en"}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <ConnectorArrow dashed={!hasDirections} vertical />
          <ConnectorArrow dashed={!hasDirections} />
        </div>

        <div className="min-w-0">
          <NetworkNodeCard kind="challenge" label="Herausforderung" title={cell.challengeTitle} />
        </div>
      </div>
    </div>
  );
}
