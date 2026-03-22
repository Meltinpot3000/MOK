"use client";

import { useMemo, useState } from "react";
import { ProgramCreateForm, type ProgramFormSelection } from "@/components/ceo/ProgramCreateForm";
import { ProgramsTable, type ProgramInitiativeRow, type ProgramRow } from "@/components/ceo/ProgramsTable";

type ProgramPipWorkspaceProps = {
  canWrite: boolean;
  createProgramAction: (formData: FormData) => void | Promise<void>;
  updateProgramAction: (formData: FormData) => void | Promise<void>;
  /** Nur «aktiv» im Sinne Programm-Erfassung (Matrix-Regel). */
  strategicDirectionsForPrograms: Array<{ id: string; title: string }>;
  /** Alle Stossrichtungen des Zyklus (Fallback, falls Programm noch alte/inaktive ID hat). */
  strategicDirectionsAll: Array<{ id: string; title: string }>;
  ownerOptions: Array<{ id: string; label: string }>;
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
  programRows,
  directionTitleById,
  initiativesByProgramId,
}: ProgramPipWorkspaceProps) {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  const ownerLabelByMembershipId = useMemo(
    () => Object.fromEntries(ownerOptions.map((o) => [o.id, o.label])),
    [ownerOptions]
  );

  const selectedProgram: ProgramFormSelection | null = useMemo(() => {
    if (!selectedProgramId) return null;
    const row = programRows.find((p) => p.id === selectedProgramId);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      strategic_direction_id: row.strategic_direction_id,
      status: row.status,
      owner_membership_id: row.owner_membership_id,
      start_date: row.start_date,
      end_date: row.end_date,
      budget_total: row.budget_total,
      initiative_active_count: row.initiative_active_count,
    };
  }, [selectedProgramId, programRows]);

  const directionsForForm = useMemo(() => {
    const active = strategicDirectionsForPrograms;
    const sel = selectedProgram?.strategic_direction_id;
    if (!sel || active.some((d) => d.id === sel)) return active;
    const extra = strategicDirectionsAll.find((d) => d.id === sel);
    return extra ? [...active, extra] : active;
  }, [strategicDirectionsForPrograms, strategicDirectionsAll, selectedProgram]);

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          {selectedProgram ? "Programm bearbeiten" : "Programm erfassen"}
        </h2>
        <ProgramCreateForm
          canWrite={canWrite}
          createAction={createProgramAction}
          updateAction={updateProgramAction}
          strategicDirections={directionsForForm}
          ownerOptions={ownerOptions}
          selectedProgram={selectedProgram}
          onClearSelection={() => setSelectedProgramId(null)}
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
            selectedProgramId={selectedProgramId}
            onSelectProgram={setSelectedProgramId}
          />
        </div>
      </article>
    </section>
  );
}
