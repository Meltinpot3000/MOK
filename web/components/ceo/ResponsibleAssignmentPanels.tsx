"use client";

import { useMemo, useState } from "react";

type AssignmentType = "owner" | "support" | "stakeholder";

type ResponsibleOption = {
  id: string;
  full_name: string;
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
  unit_type_label: string;
};

type ResponsibleAssignmentPanelsProps = {
  canWrite: boolean;
  responsibles: ResponsibleOption[];
  orgUnits: UnitOption[];
  roleOptions: Array<{ value: AssignmentType; label: string }>;
  assignAction: (formData: FormData) => void;
  hierarchyAction: (formData: FormData) => void;
};

export function ResponsibleAssignmentPanels({
  canWrite,
  responsibles,
  orgUnits,
  roleOptions,
  assignAction,
  hierarchyAction,
}: ResponsibleAssignmentPanelsProps) {
  const [assignResponsibleId, setAssignResponsibleId] = useState("");
  const [assignUnitId, setAssignUnitId] = useState("");
  const [assignType, setAssignType] = useState<AssignmentType>("owner");
  const [managerId, setManagerId] = useState("");
  const [reportId, setReportId] = useState("");

  const canSaveAssignment =
    canWrite && assignResponsibleId.trim().length > 0 && assignUnitId.trim().length > 0 && assignType.trim().length > 0;
  const canSaveHierarchy =
    canWrite && managerId.trim().length > 0 && reportId.trim().length > 0 && managerId !== reportId;
  const hierarchyHint = useMemo(() => {
    if (!managerId || !reportId) return null;
    if (managerId === reportId) return "Manager und Report duerfen nicht identisch sein.";
    return null;
  }, [managerId, reportId]);

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Bereichszuordnung</h2>
        <form action={assignAction} className="mt-4 space-y-3">
          <select
            name="responsible_id"
            required
            value={assignResponsibleId}
            onChange={(event) => setAssignResponsibleId(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Verantwortliche auswählen</option>
            {responsibles.map((responsible) => (
              <option key={responsible.id} value={responsible.id}>
                {responsible.full_name}
              </option>
            ))}
          </select>
          <select
            name="organization_unit_id"
            required
            value={assignUnitId}
            onChange={(event) => setAssignUnitId(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Organisationseinheit auswählen</option>
            {orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code} - {unit.name} ({unit.unit_type_label})
              </option>
            ))}
          </select>
          <select
            name="assignment_type"
            required
            value={assignType}
            onChange={(event) => setAssignType(event.target.value as AssignmentType)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!canSaveAssignment}
            className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zuordnung speichern
          </button>
        </form>
      </article>

      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Hierarchie (Manager {"->"} Report)
        </h2>
        <form action={hierarchyAction} className="mt-4 space-y-3">
          <select
            name="manager_responsible_id"
            required
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Manager auswählen</option>
            {responsibles.map((responsible) => (
              <option key={responsible.id} value={responsible.id}>
                {responsible.full_name}
              </option>
            ))}
          </select>
          <select
            name="report_responsible_id"
            required
            value={reportId}
            onChange={(event) => setReportId(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Report auswählen</option>
            {responsibles.map((responsible) => (
              <option key={responsible.id} value={responsible.id}>
                {responsible.full_name}
              </option>
            ))}
          </select>
          {hierarchyHint ? <p className="text-xs text-amber-700">{hierarchyHint}</p> : null}
          <button
            type="submit"
            disabled={!canSaveHierarchy}
            className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hierarchie speichern
          </button>
        </form>
      </article>
    </section>
  );
}

