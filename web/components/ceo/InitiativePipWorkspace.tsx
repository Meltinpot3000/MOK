"use client";

import { useMemo, useState } from "react";
import {
  InitiativeCreateForm,
  type InitiativeFormSelection,
} from "@/components/ceo/InitiativeCreateForm";
import { InitiativesTable, type InitiativeRow } from "@/components/ceo/InitiativesTable";
import type { InitiativeKrLinkContext, PipKeyResultOption } from "@/lib/strategy-cycle/queries";

type InitiativePipWorkspaceProps = {
  canWrite: boolean;
  createInitiativeAction: (formData: FormData) => void | Promise<void>;
  updateInitiativeAction: (formData: FormData) => void | Promise<void>;
  programsOpenForInitiatives: Array<{ id: string; title: string }>;
  programsAll: Array<{ id: string; title: string; status: string }>;
  ownerOptions: Array<{ id: string; label: string }>;
  annualTargets: Array<{ id: string; title: string }>;
  keyResultOptions: PipKeyResultOption[];
  initiativeRows: InitiativeRow[];
  programTitleById: Record<string, string>;
  ownerLabelByMembershipId: Record<string, string>;
};

export function InitiativePipWorkspace({
  canWrite,
  createInitiativeAction,
  updateInitiativeAction,
  programsOpenForInitiatives,
  programsAll,
  ownerOptions,
  annualTargets,
  keyResultOptions,
  initiativeRows,
  programTitleById,
  ownerLabelByMembershipId,
}: InitiativePipWorkspaceProps) {
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);

  const targetTitleById = useMemo(
    () => Object.fromEntries(annualTargets.map((t) => [t.id, t.title])),
    [annualTargets]
  );

  const selectedInitiative: InitiativeFormSelection | null = useMemo(() => {
    if (!selectedInitiativeId) return null;
    const row = initiativeRows.find((i) => i.id === selectedInitiativeId);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      program_id: row.program_id,
      status: row.status ?? "planned",
      priority: row.priority ?? 3,
      owner_membership_id: row.owner_membership_id,
      progress_percent: row.progress_percent ?? 0,
      description: row.description,
      annualTargetIds: row.annual_target_ids,
      keyResultIds: row.key_result_ids,
    };
  }, [selectedInitiativeId, initiativeRows]);

  const krContextsByKrId = useMemo(() => {
    if (!selectedInitiative) return {};
    const row = initiativeRows.find((i) => i.id === selectedInitiative.id);
    const m: Record<string, InitiativeKrLinkContext> = {};
    for (const c of row?.kr_link_contexts ?? []) {
      m[c.key_result_id] = c;
    }
    return m;
  }, [selectedInitiative, initiativeRows]);

  const programsForForm = useMemo(() => {
    const base = programsOpenForInitiatives;
    const pid = selectedInitiative?.program_id;
    if (!pid || base.some((p) => p.id === pid)) return base;
    const extra = programsAll.find((p) => p.id === pid);
    if (!extra) return base;
    return [
      ...base,
      {
        id: extra.id,
        title: `${extra.title} (Programm: ${extra.status === "closed" ? "Abgeschlossen" : extra.status})`,
      },
    ];
  }, [programsOpenForInitiatives, programsAll, selectedInitiative]);

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          {selectedInitiative ? "Initiative bearbeiten" : "Initiative erfassen"}
        </h2>
        <InitiativeCreateForm
          canWrite={canWrite}
          createAction={createInitiativeAction}
          updateAction={updateInitiativeAction}
          programs={programsForForm}
          ownerOptions={ownerOptions}
          annualTargets={annualTargets}
          keyResultOptions={keyResultOptions}
          selectedInitiative={selectedInitiative}
          targetTitleById={targetTitleById}
          krContextsByKrId={krContextsByKrId}
          onClearSelection={() => setSelectedInitiativeId(null)}
        />
      </article>
      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Initiativen</h3>
        <div className="mt-4">
          <InitiativesTable
            initiatives={initiativeRows}
            programTitleById={programTitleById}
            ownerLabelByMembershipId={ownerLabelByMembershipId}
            selectedInitiativeId={selectedInitiativeId}
            onSelectInitiative={setSelectedInitiativeId}
          />
        </div>
      </article>
    </section>
  );
}
