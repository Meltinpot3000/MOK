"use client";

import { Suspense, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOkrPlanningDirty } from "@/components/ceo/okr/okr-planning-dirty";
import type { OkrCycleOption } from "@/lib/okr/planning-data";

function formatDeRange(startIso: string, endIso: string): string {
  try {
    const o = { day: "2-digit" as const, month: "2-digit" as const, year: "numeric" as const };
    return `${new Date(startIso).toLocaleDateString("de-DE", o)} – ${new Date(endIso).toLocaleDateString("de-DE", o)}`;
  } catch {
    return "—";
  }
}

type InnerProps = {
  cycles: OkrCycleOption[];
  selectedId: string | null;
};

function OkrCycleCarouselInner({ cycles, selectedId }: InnerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { requestNavigation } = useOkrPlanningDirty();

  const sorted = useMemo(
    () => [...cycles].sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date)),
    [cycles]
  );

  const idx = useMemo(() => {
    if (selectedId == null) return -1;
    return sorted.findIndex((c) => c.id === selectedId);
  }, [sorted, selectedId]);

  const current = idx >= 0 ? sorted[idx] : sorted[0];
  const safeIdx = idx >= 0 ? idx : 0;

  const navigateToIndex = useCallback(
    (nextIdx: number) => {
      if (sorted.length === 0) return;
      const clamped = Math.max(0, Math.min(sorted.length - 1, nextIdx));
      const id = sorted[clamped]?.id;
      if (!id || id === selectedId) return;
      const p = new URLSearchParams(searchParams.toString());
      p.set("okrCycle", id);
      const href = `${pathname}?${p.toString()}`;
      requestNavigation(() => router.push(href));
    },
    [pathname, requestNavigation, router, searchParams, selectedId, sorted]
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-600">
        Kein OKR-Zeitraum für diesen Bereich angelegt.
      </div>
    );
  }

  const canPrev = safeIdx > 0;
  const canNext = safeIdx < sorted.length - 1;

  return (
    <div
      className="overflow-hidden rounded-xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/90 shadow-sm outline-none ring-zinc-900/5 focus-visible:ring-2"
      tabIndex={0}
      role="region"
      aria-label="OKR-Zyklus wechseln. Fokus hier: Pfeiltasten links/rechts."
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" && canPrev) {
          e.preventDefault();
          navigateToIndex(safeIdx - 1);
        } else if (e.key === "ArrowRight" && canNext) {
          e.preventDefault();
          navigateToIndex(safeIdx + 1);
        }
      }}
    >
      <div className="flex items-stretch gap-2 px-2 py-4 sm:gap-4 sm:px-6 sm:py-5">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => navigateToIndex(safeIdx - 1)}
          aria-label="Vorheriger OKR-Zyklus"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35 sm:h-14 sm:w-14"
        >
          <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="min-w-0 flex-1 self-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:text-xs">OKR-Zyklus</p>
          <p className="mt-1 truncate px-1 text-base font-semibold text-zinc-900 sm:text-lg" title={current?.name}>
            {current?.name ?? "—"}
          </p>
          {current ? (
            <p className="mt-1 text-xs text-zinc-600 sm:text-sm">{formatDeRange(current.start_date, current.end_date)}</p>
          ) : null}
          <p className="mt-2 text-[11px] tabular-nums text-zinc-400">
            {safeIdx + 1} / {sorted.length}
          </p>
        </div>

        <button
          type="button"
          disabled={!canNext}
          onClick={() => navigateToIndex(safeIdx + 1)}
          aria-label="Nächster OKR-Zyklus"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35 sm:h-14 sm:w-14"
        >
          <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function OkrCycleCarousel(props: InnerProps) {
  return (
    <Suspense
      fallback={
        <div className="h-[7.5rem] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100/80 sm:h-[8.5rem]" />
      }
    >
      <OkrCycleCarouselInner {...props} />
    </Suspense>
  );
}
