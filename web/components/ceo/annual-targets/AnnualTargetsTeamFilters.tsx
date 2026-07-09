"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ANNUAL_TARGET_LIFECYCLE_STATUSES,
  ANNUAL_TARGET_TYPES,
  ANNUAL_TARGET_TYPE_LABELS_DE,
  LIFECYCLE_STATUS_LABELS_DE,
  type AnnualTargetsFilters,
} from "@/lib/annual-targets/types";

type Props = {
  filters: AnnualTargetsFilters;
  directions: { id: string; title: string }[];
  objectives: { id: string; title: string }[];
  ownerOptions: { membershipId: string; fullName: string }[];
};

export function AnnualTargetsTeamFilters({ filters, directions, objectives, ownerOptions }: Props) {
  const baseHref = useMemo(() => "/annual-targets?tab=team", []);

  return (
    <form className="brand-card grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-4" method="get" action="/annual-targets">
      <input type="hidden" name="tab" value="team" />
      <label className="text-xs text-zinc-600">
        Zieljahr
        <input
          name="target_year"
          type="number"
          defaultValue={filters.targetYear ?? ""}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600">
        Owner
        <select
          name="owner"
          defaultValue={filters.ownerMembershipId ?? ""}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Alle (im Scope)</option>
          {ownerOptions.map((o) => (
            <option key={o.membershipId} value={o.membershipId}>
              {o.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-600">
        Stoßrichtung
        <select
          name="direction"
          defaultValue={filters.strategicDirectionId ?? ""}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Alle</option>
          {directions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-600">
        Strategisches Ziel
        <select
          name="objective"
          defaultValue={filters.strategicObjectiveId ?? ""}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Alle</option>
          {objectives.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-600">
        Status
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Alle</option>
          {ANNUAL_TARGET_LIFECYCLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LIFECYCLE_STATUS_LABELS_DE[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-600">
        Typ
        <select
          name="type"
          defaultValue={filters.annualTargetType ?? ""}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Alle</option>
          {ANNUAL_TARGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {ANNUAL_TARGET_TYPE_LABELS_DE[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-600">
        OKR-Alignment
        <select
          name="okr_alignment"
          defaultValue={filters.okrAlignment ?? "all"}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="all">Alle</option>
          <option value="aligned">Mit OKR-Verknüpfung</option>
          <option value="not_aligned">Ohne OKR-Verknüpfung</option>
        </select>
      </label>
      <div className="flex items-end gap-2 md:col-span-3 lg:col-span-4">
        <button type="submit" className="brand-btn px-4 py-2 text-sm">
          Filtern
        </button>
        <Link href={baseHref} className="text-sm text-zinc-600 hover:underline">
          Filter zurücksetzen
        </Link>
      </div>
    </form>
  );
}
