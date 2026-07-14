"use client";

import { useMemo, useState } from "react";
import { ExpandableTable, type ColumnDef } from "@/components/ceo/ExpandableTable";
import {
  TableFilterBar,
  TableFilterSearch,
  TableFilterSelect,
} from "@/components/table/TableFilterBar";
import { deriveInitiativeHealth } from "@/lib/review/initiative-health";
import { matchesTableTitleSearch } from "@/lib/table/filter-utils";
import type { ReviewAttentionItem } from "@/lib/review/review-attention-rules";
import type { ReviewCycleData, ReviewCycleAnnualTargetBrief } from "@/lib/review/review-cycle-data";
import type { ReviewStatus } from "@/lib/review/key-result-progress";
import type { ReviewCycleInitiativeInput } from "@/lib/review/review-cycle-view-model";
import { ReviewUpdatePanel } from "./ReviewUpdatePanel";
import { ReviewMeasureDialog } from "./ReviewMeasureDialog";
import { ReviewImpulseDialog } from "./ReviewImpulseDialog";
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
    (row.resolvedDirectionSource === "program" || row.resolvedDirectionSource === "legacy_annual_target")
  ) {
    return directionNameById[row.directionId] ?? row.directionId;
  }
  return directionSourceLabelDe(row.resolvedDirectionSource);
}

function programTargetLabel(row: ReviewCycleInitiativeInput): string {
  if (row.program_title) return `PIP: ${row.program_title}`;
  if (row.legacyNachpflege) return "Legacy — Programm fehlt";
  return "—";
}

function openSignalForInitiative(
  initiativeId: string,
  attentionItems: ReviewAttentionItem[]
): ReviewAttentionItem | undefined {
  return attentionItems.find((a) => a.initiativeId === initiativeId);
}

type ReviewInitiativeListProps = {
  initiativeRows: ReviewCycleInitiativeInput[];
  directionNameById: Record<string, string>;
  attentionItems: ReviewAttentionItem[];
  programs: ReviewCycleData["programs"];
  annualTargetsByDirectionId: Record<string, ReviewCycleAnnualTargetBrief[]>;
  ownerSelectOptions: Array<{ id: string; label: string }>;
  cycleData: ReviewCycleData;
  cycleInstanceId: string;
  canWrite: boolean;
};

export function ReviewInitiativeList({
  initiativeRows,
  directionNameById,
  attentionItems,
  annualTargetsByDirectionId,
  ownerSelectOptions,
  cycleData,
  cycleInstanceId,
  canWrite,
}: ReviewInitiativeListProps) {
  const [directionFilter, setDirectionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [programFilter, setProgramFilter] = useState<string>("");
  const [searchTitle, setSearchTitle] = useState("");
  const [measureContext, setMeasureContext] = useState<{
    directionId: string;
    initiativeId?: string;
    programId?: string;
  } | null>(null);
  const [impulseContext, setImpulseContext] = useState<{
    directionId: string;
    objectType: string;
    objectId: string;
  } | null>(null);

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
      if (!matchesTableTitleSearch(row.title, searchTitle)) return false;
      return true;
    });
  }, [initiativeRows, directionFilter, statusFilter, ownerFilter, programFilter, searchTitle]);

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
        label: "Stoßrichtung",
        sortValue: (r) => directionSortLabel(r, directionNameById),
        render: (r) => (
          <span className="text-zinc-700">{directionSortLabel(r, directionNameById)}</span>
        ),
      },
      {
        id: "programTarget",
        label: "Programm / Jahresziel",
        sortValue: (r) => programTargetLabel(r),
        render: (r) => (
          <span className="text-xs text-zinc-700">
            {programTargetLabel(r)}
            {r.legacyNachpflege ? (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                Nachpflege
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "health",
        label: "Review-Status",
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
        id: "weight",
        label: "Beitrag",
        sortValue: (r) => r.weight,
        render: (r) => `Gew. ${r.weight}`,
      },
      {
        id: "progress",
        label: "Fortschritt",
        sortValue: (r) => r.progress_percent,
        render: (r) => `${r.progress_percent}%`,
      },
      {
        id: "review",
        label: "Letzter Review",
        sortValue: (r) => r.last_review_update_at ?? null,
        render: (r) => (
          <span className="text-zinc-600">{formatDateDe(r.last_review_update_at)}</span>
        ),
      },
      {
        id: "signal",
        label: "Offenes Signal",
        sortValue: (r) => openSignalForInitiative(r.id, attentionItems)?.severity ?? "z",
        render: (r) => {
          const sig = openSignalForInitiative(r.id, attentionItems);
          return sig ? (
            <span className="text-xs text-amber-800">{sig.title}</span>
          ) : (
            <span className="text-zinc-400">—</span>
          );
        },
      },
      {
        id: "actions",
        label: "Aktionen",
        sortValue: () => "",
        render: (r) =>
          canWrite ? (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="text-xs underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setMeasureContext({
                    directionId: r.directionId ?? "",
                    initiativeId: r.id,
                    programId: r.program_id ?? undefined,
                  });
                }}
              >
                Maßnahme
              </button>
            </div>
          ) : (
            "—"
          ),
      },
    ];
  }, [directionNameById, annualTargetsByDirectionId, attentionItems, canWrite]);

  return (
    <section className="brand-card p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Initiativen</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Pflege- und Arbeitsansicht — die primäre Steuerung erfolgt im Umsetzungsnetzwerk.
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">
        Zeile mit «+» aufklappen für Review aktualisieren. Neue Initiativen werden im Strategiezyklus
        erfasst.
      </p>

      <div className="mt-4">
        <TableFilterBar>
          <TableFilterSelect
            label="Stoßrichtung"
            value={directionFilter}
            onChange={setDirectionFilter}
            className="min-w-[140px] flex-1"
            options={directionOptions.map((id) => ({
              value: id,
              label: directionNameById[id] ?? id,
            }))}
          />
          <TableFilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={["draft", "planned", "active", "at_risk", "on_hold", "completed", "archived"].map(
              (s) => ({
                value: s,
                label: initiativeStatusLabelDe(s),
              })
            )}
          />
          <TableFilterSelect
            label="Owner"
            value={ownerFilter}
            onChange={setOwnerFilter}
            className="min-w-[140px] flex-1"
            options={ownerFilterOptions.map((o) => ({ value: o.id, label: o.label }))}
          />
          <TableFilterSelect
            label="Programm"
            value={programFilter}
            onChange={setProgramFilter}
            className="min-w-[140px] flex-1"
            options={programOptions.map(([id, title]) => ({ value: id, label: title }))}
          />
          <TableFilterSearch value={searchTitle} onChange={setSearchTitle} />
        </TableFilterBar>
      </div>

      <div className="mt-4">
        <ExpandableTable<ReviewCycleInitiativeInput>
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          expandLabel="Review aktualisieren"
          emptyMessage="Keine Initiativen für die gewählten Filter."
          renderExpandedContent={(row) => (
            <div className="space-y-3">
              <ReviewUpdatePanel
                initiative={row}
                canWrite={canWrite}
                ownerSelectOptions={ownerSelectOptions}
              />
              {canWrite && row.directionId ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-zinc-600">
                    Strategie-Impuls (sekundär)
                  </summary>
                  <button
                    type="button"
                    className="mt-2 text-xs underline"
                    onClick={() =>
                      setImpulseContext({
                        directionId: row.directionId!,
                        objectType: "initiative",
                        objectId: row.id,
                      })
                    }
                  >
                    Impuls für diese Initiative
                  </button>
                </details>
              ) : null}
            </div>
          )}
        />
      </div>

      {measureContext ? (
        <ReviewMeasureDialog
          open
          context={measureContext}
          cycleData={cycleData}
          cycleInstanceId={cycleInstanceId}
          onClose={() => setMeasureContext(null)}
        />
      ) : null}

      {impulseContext ? (
        <ReviewImpulseDialog
          open
          context={impulseContext}
          cycleInstanceId={cycleInstanceId}
          onClose={() => setImpulseContext(null)}
        />
      ) : null}
    </section>
  );
}
