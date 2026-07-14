"use client";

import { InitiativeCreateForm } from "@/components/ceo/InitiativeCreateForm";
import { InitiativesTable, type InitiativeRow } from "@/components/ceo/InitiativesTable";
import type { InitiativeProgramOption } from "@/lib/strategy-cycle/initiative-program-budget";

type InitiativePipWorkspaceProps = {
  canWrite: boolean;
  createInitiativeAction: (formData: FormData) => void | Promise<void>;
  updateInitiativeAction: (formData: FormData) => void | Promise<void>;
  programsOpenForInitiatives: InitiativeProgramOption[];
  programsAll: InitiativeProgramOption[];
  ownerOptions: Array<{ id: string; label: string }>;
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
  initiativeRows,
  programTitleById,
  ownerLabelByMembershipId,
}: InitiativePipWorkspaceProps) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Initiative erfassen</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Neue Initiativen hier anlegen. Bestehende Initiativen in der Tabelle rechts aufklappen und dort
          bearbeiten (wie bei strategischen Stoßrichtungen).
        </p>
        <InitiativeCreateForm
          canWrite={canWrite}
          createAction={createInitiativeAction}
          updateAction={updateInitiativeAction}
          programs={programsOpenForInitiatives}
          ownerOptions={ownerOptions}
          selectedInitiative={null}
          onClearSelection={() => {}}
        />
      </article>
      <article className="brand-card min-w-0 p-6">
        <h3 className="text-base font-semibold text-zinc-900">Initiativen</h3>
        <div className="mt-4 min-w-0">
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
          />
        </div>
      </article>
    </section>
  );
}
