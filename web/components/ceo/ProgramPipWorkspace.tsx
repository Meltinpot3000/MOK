"use client";

import { ProgramCreateForm } from "@/components/ceo/ProgramCreateForm";
import { ProgramsTable, type ProgramInitiativeRow, type ProgramRow } from "@/components/ceo/ProgramsTable";

type ProgramPipWorkspaceProps = {
  canWrite: boolean;
  createProgramAction: (formData: FormData) => void | Promise<void>;
  updateProgramAction: (formData: FormData) => void | Promise<void>;
  /** Nur «aktiv» im Sinne Programm-Erfassung (Matrix-Regel). */
  strategicDirectionsForPrograms: Array<{ id: string; title: string }>;
  /** Alle Stossrichtungen des Zyklus (Fallback beim Bearbeiten in der Tabellenzeile). */
  strategicDirectionsAll: Array<{ id: string; title: string }>;
  /** Sponsoren-Auswahl: nur Rolle Executive (Daten aus Workspace). */
  ownerOptions: Array<{ id: string; label: string }>;
  /** Anzeigenamen auch fuer Alt-Sponsoren ohne Executive-Rolle (Tabellenspalte / Zusatzoption). */
  ownerLabelByMembershipId: Record<string, string>;
  programRows: ProgramRow[];
  directionTitleById: Record<string, string>;
  initiativesByProgramId: Record<string, ProgramInitiativeRow[]>;
};

export function ProgramPipWorkspace({
  canWrite,
  createProgramAction,
  updateProgramAction,
  strategicDirectionsForPrograms,
  strategicDirectionsAll,
  ownerOptions,
  ownerLabelByMembershipId,
  programRows,
  directionTitleById,
  initiativesByProgramId,
}: ProgramPipWorkspaceProps) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Programm erfassen</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Neue Programme hier anlegen. Bestehende Programme in der Tabelle rechts aufklappen und dort bearbeiten
          (wie bei strategischen Stossrichtungen).
        </p>
        <ProgramCreateForm
          canWrite={canWrite}
          createAction={createProgramAction}
          updateAction={updateProgramAction}
          strategicDirections={strategicDirectionsForPrograms}
          ownerOptions={ownerOptions}
          selectedProgram={null}
          onClearSelection={() => {}}
        />
      </article>
      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Programme</h3>
        <div className="mt-4">
          <ProgramsTable
            programs={programRows}
            directionTitleById={directionTitleById}
            ownerLabelByMembershipId={ownerLabelByMembershipId}
            initiativesByProgramId={initiativesByProgramId}
            canWrite={canWrite}
            createProgramAction={createProgramAction}
            updateProgramAction={updateProgramAction}
            strategicDirectionsForPrograms={strategicDirectionsForPrograms}
            strategicDirectionsAll={strategicDirectionsAll}
            ownerOptions={ownerOptions}
          />
        </div>
      </article>
    </section>
  );
}
