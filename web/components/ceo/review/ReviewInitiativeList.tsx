"use client";

import { ExpandableTable, type ColumnDef } from "@/components/ceo/ExpandableTable";
import { deriveInitiativeHealth } from "@/lib/review/initiative-health";
import type { ReviewStatus } from "@/lib/review/key-result-progress";
import type { ReviewCycleInitiativeInput } from "@/lib/review/review-cycle-view-model";
import { useMemo, useState } from "react";
import { ReviewUpdatePanel } from "./ReviewUpdatePanel";
import {
  directionSourceLabelDe,
  formatDateDe,
  healthBadgeClass,
  healthLabelDe,
  initiativeStatusLabelDe,
} from "./review-ui";

const HEALTH_ORDER: Record<ReviewStatus, number> = {
  off_track: 0,
  at_risk: 1,
  on_track: 2,
};

function directionSortLabel(
  row: ReviewCycleInitiativeInput,
  directionNameById: Record<string, string>
): string {
  if (
    row.directionId &&
    (row.resolvedDirectionSource === "program" || row.resolvedDirectionSource === "annual_target")
  ) {
    return directionNameById[row.directionId] ?? row.directionId;
  }
  return directionSourceLabelDe(row.resolvedDirectionSource);
}

type ReviewInitiativeListProps = {
  initiativeRows: ReviewCycleInitiativeInput[];
  directionNameById: Record<string, string>;
  ownerSelectOptions: Array<{ id: string; label: string }>;
  canWrite: boolean;
};

export function ReviewInitiativeList({
  initiativeRows,
  directionNameById,
  ownerSelectOptions,
  canWrite,
}: ReviewInitiativeListProps) {
  const [directionFilter, setDirectionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [programFilter, setProgramFilter] = useState<string>("");

  const directionOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const row of initiativeRows) {
      if (row.directionId) ids.add(row.directionId);
    }
    return [...ids].sort((a, b) =>
      (directionNameById[a] ?? a).localeCompare(directionNameById[b] ?? b, "de")
    );
  }, [initiativeRows, directionNameById]);

  const ownerFilterOptions = useMemo(() => {
    return [...ownerSelectOptions].sort((a, b) =>
      a.label.localeCompare(b.label, "de", { sensitivity: "base" })
    );
  }, [ownerSelectOptions]);

  const programOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of initiativeRows) {
      if (row.program_id && row.program_title) m.set(row.program_id, row.program_title);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"));
  }, [initiativeRows]);

  const filtered = useMemo(() => {
    return initiativeRows.filter((row) => {
      if (directionFilter && row.directionId !== directionFilter) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (ownerFilter && row.owner_membership_id !== ownerFilter) return false;
      if (programFilter && row.program_id !== programFilter) return false;
      return true;
    });
  }, [initiativeRows, directionFilter, statusFilter, ownerFilter, programFilter]);

  const columns = useMemo<ColumnDef<ReviewCycleInitiativeInput>[]>(() => {
    return [
      {
        id: "title",
        label: "Titel",
        sortValue: (r) => r.title,
        render: (r) => <span className="font-medium text-zinc-900">{r.title}</span>,
      },
      {
        id: "direction",
        label: "Stossrichtung",
        sortValue: (r) => directionSortLabel(r, directionNameById),
        render: (r) => (
          <span className="text-zinc-700">{directionSortLabel(r, directionNameById)}</span>
        ),
      },
      {
        id: "owner",
        label: "Owner",
        sortValue: (r) => r.owner_display_name ?? "",
        render: (r) => <span className="text-zinc-700">{r.owner_display_name ?? "—"}</span>,
      },
      {
        id: "status",
        label: "Status",
        sortValue: (r) => r.status,
        render: (r) => initiativeStatusLabelDe(r.status),
      },
      {
        id: "priority",
        label: "Prio",
        sortValue: (r) => r.priority,
        render: (r) => r.priority,
      },
      {
        id: "weight",
        label: "Gew.",
        sortValue: (r) => r.weight,
        render: (r) => r.weight,
      },
      {
        id: "progress",
        label: "Fortschritt",
        sortValue: (r) => r.progress_percent,
        render: (r) => `${r.progress_percent}%`,
      },
      {
        id: "due",
        label: "Fälligkeit",
        sortValue: (r) => r.end_date ?? null,
        render: (r) => formatDateDe(r.end_date),
      },
      {
        id: "health",
        label: "Risiko",
        sortValue: (r) => HEALTH_ORDER[deriveInitiativeHealth(r)],
        render: (r) => {
          const h = deriveInitiativeHealth(r);
          return (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${healthBadgeClass(h)}`}>
              {healthLabelDe(h)}
            </span>
          );
        },
      },
      {
        id: "review",
        label: "Review",
        sortValue: (r) => r.last_review_update_at ?? null,
        render: (r) => (
          <span className="text-zinc-600">{formatDateDe(r.last_review_update_at)}</span>
        ),
      },
      {
        id: "source",
        label: "Herkunft",
        sortValue: (r) => r.resolvedDirectionSource,
        render: (r) => (
          <span className="text-xs text-zinc-500" title={r.resolvedDirectionSource}>
            {directionSourceLabelDe(r.resolvedDirectionSource)}
          </span>
        ),
      },
    ];
  }, [directionNameById]);

  return (
    <section className="brand-card p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Initiativen</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Operative Liste mit Gewichtung, Fortschritt und Review-Aktualitaet.
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">
        Zeile mit «+» aufklappen und dort bearbeiten. Neue Initiativen werden im Strategiezyklus erfasst, nicht hier.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-zinc-600">
          Stossrichtung
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Alle</option>
            {directionOptions.map((id) => (
              <option key={id} value={id}>
                {directionNameById[id] ?? id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Alle</option>
            {["draft", "planned", "active", "at_risk", "on_hold", "completed", "archived"].map((s) => (
              <option key={s} value={s}>
                {initiativeStatusLabelDe(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Owner
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Alle</option>
            {ownerFilterOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Programm
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Alle</option>
            {programOptions.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <ExpandableTable<ReviewCycleInitiativeInput>
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          expandLabel="Details"
          emptyMessage="Keine Initiativen fuer die gewaehlten Filter."
          renderExpandedContent={(row) => (
            <ReviewUpdatePanel
              initiative={row}
              canWrite={canWrite}
              ownerSelectOptions={ownerSelectOptions}
            />
          )}
        />
      </div>
    </section>
  );
}
