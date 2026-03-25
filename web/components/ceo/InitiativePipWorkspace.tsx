"use client";

import { useMemo } from "react";
import { InitiativeCreateForm } from "@/components/ceo/InitiativeCreateForm";
import { InitiativesTable, type InitiativeRow } from "@/components/ceo/InitiativesTable";
import type { PipKeyResultOption } from "@/lib/strategy-cycle/queries";

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
  const targetTitleById = useMemo(
    () => Object.fromEntries(annualTargets.map((t) => [t.id, t.title])),
    [annualTargets]
  );

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Initiative erfassen</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Neue Initiativen hier anlegen. Bestehende Initiativen in der Tabelle rechts aufklappen und dort bearbeiten
          (wie bei strategischen Stossrichtungen).
        </p>
        <InitiativeCreateForm
          canWrite={canWrite}
          createAction={createInitiativeAction}
          updateAction={updateInitiativeAction}
          programs={programsOpenForInitiatives}
          ownerOptions={ownerOptions}
          annualTargets={annualTargets}
          keyResultOptions={keyResultOptions}
          selectedInitiative={null}
          targetTitleById={targetTitleById}
          krContextsByKrId={{}}
          onClearSelection={() => {}}
        />
      </article>
      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Initiativen</h3>
        <div className="mt-4">
          <InitiativesTable
            initiatives={initiativeRows}
            programTitleById={programTitleById}
            ownerLabelByMembershipId={ownerLabelByMembershipId}
            canWrite={canWrite}
            createInitiativeAction={createInitiativeAction}
            updateInitiativeAction={updateInitiativeAction}
            programsOpenForInitiatives={programsOpenForInitiatives}
            programsAll={programsAll}
            ownerOptions={ownerOptions}
            annualTargets={annualTargets}
            keyResultOptions={keyResultOptions}
          />
        </div>
      </article>
    </section>
  );
}
