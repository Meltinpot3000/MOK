"use client";

import { useEffect } from "react";
import type {
  DescriptionQualityFilterValue,
  DescriptionQualityViewModel,
} from "@/lib/strategy-cycle/description-quality-view";
import {
  DESCRIPTION_QUALITY_FILTER_OPTIONS,
  matchesDescriptionQualityFilter,
} from "@/lib/strategy-cycle/description-quality-view";

export { DESCRIPTION_QUALITY_FILTER_OPTIONS };

export function useDescriptionQualityTableFocus(
  focusObjectId: string | null | undefined,
  rowIdPrefix: string
) {
  useEffect(() => {
    if (!focusObjectId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`${rowIdPrefix}${focusObjectId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [focusObjectId, rowIdPrefix]);
}

export function resolveInitialDescriptionQualityFilter(
  initialQualityFilter: DescriptionQualityFilterValue | undefined,
  descriptionQualityReview: boolean | undefined
): DescriptionQualityFilterValue {
  if (initialQualityFilter) return initialQualityFilter;
  if (descriptionQualityReview) return "needs_work";
  return "";
}

export function filterRowsByDescriptionQuality<T extends { id: string }>(
  rows: T[],
  descriptionQualityById: Record<string, DescriptionQualityViewModel> | undefined,
  filter: DescriptionQualityFilterValue
): T[] {
  if (!filter || !descriptionQualityById) return rows;
  return rows.filter((row) => {
    const quality = descriptionQualityById[row.id];
    const status = quality?.displayStatus ?? "no_data";
    return matchesDescriptionQualityFilter(status, filter);
  });
}

export function mergeExpandedRowIds(
  ...idLists: Array<string[] | undefined>
): string[] {
  return [...new Set(idLists.flatMap((list) => list ?? []))];
}
