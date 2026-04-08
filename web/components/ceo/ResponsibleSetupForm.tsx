"use client";

import { useState } from "react";
import {
  ASSIGNMENT_RANK,
  type ResponsibleAssignmentType,
} from "@/lib/responsibles/assignment-rank";

type AssignmentType = ResponsibleAssignmentType;

export type MembershipOption = {
  id: string;
  label: string;
  email: string | null;
  title: string | null;
  responsibleId: string | null;
};

type ResponsibleOption = { id: string; full_name: string; membership_id: string | null };

type UnitOption = {
  id: string;
  code: string;
  name: string;
  unit_type_label: string;
};

export type ResponsibleUnitAssignmentRow = {
  responsible_id: string;
  organization_unit_id: string;
  assignment_type: AssignmentType;
};

type ResponsibleSetupFormProps = {
  canWrite: boolean;
  action: (formData: FormData) => void;
  memberships: MembershipOption[];
  responsibles: ResponsibleOption[];
  orgUnits: UnitOption[];
  roleOptions: Array<{ value: AssignmentType; label: string }>;
  /** Bereichszuordnungen für Rollenfilter (Manager/Reports nur vergleichbar zur gewählten Einheit). */
  unitAssignments: ResponsibleUnitAssignmentRow[];
  /** Höchste RBAC-Stufe pro Mitgliedschaft (Organisationsrollen: executive, department_lead, team_member, …). */
  rbacMaxRankByMembershipId: Record<string, number>;
};

export function ResponsibleSetupForm({
  canWrite,
  action,
  memberships,
  responsibles,
  orgUnits,
  roleOptions,
  unitAssignments,
  rbacMaxRankByMembershipId,
}: ResponsibleSetupFormProps) {
  const [membershipId, setMembershipId] = useState("");
  const [organizationUnitId, setOrganizationUnitId] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("owner");
  const [managerId, setManagerId] = useState("");
  const [reportById, setReportById] = useState<Record<string, boolean>>({});

  const selected = memberships.find((m) => m.id === membershipId);
  const focalResponsibleId = selected?.responsibleId ?? null;

  const rankMaxByResponsibleAndUnit = new Map<string, number>();
  for (const row of unitAssignments) {
    const key = `${row.responsible_id}\0${row.organization_unit_id}`;
    const r = ASSIGNMENT_RANK[row.assignment_type];
    const prev = rankMaxByResponsibleAndUnit.get(key);
    rankMaxByResponsibleAndUnit.set(key, prev === undefined ? r : Math.max(prev, r));
  }
  const maxRankInUnit = (responsibleId: string, unitId: string): number | null => {
    const v = rankMaxByResponsibleAndUnit.get(`${responsibleId}\0${unitId}`);
    return v === undefined ? null : v;
  };

  const focalRankForFilter = ASSIGNMENT_RANK[assignmentType];
  const unitIdTrimmed = organizationUnitId.trim();
  const focalRbacRank =
    membershipId.trim().length > 0 ? rbacMaxRankByMembershipId[membershipId] ?? 0 : null;

  function candidateRbacRank(r: ResponsibleOption): number {
    if (!r.membership_id) return 0;
    return rbacMaxRankByMembershipId[r.membership_id] ?? 0;
  }

  const basePool = responsibles.filter((r) => r.id !== focalResponsibleId);
  const managerChoices = basePool.filter((r) => {
    if (focalRbacRank !== null && candidateRbacRank(r) < focalRbacRank) return false;
    if (!unitIdTrimmed) return true;
    const rank = maxRankInUnit(r.id, unitIdTrimmed);
    return rank !== null && rank >= focalRankForFilter;
  });
  const reportChoices = basePool.filter((r) => {
    if (focalRbacRank !== null && candidateRbacRank(r) > focalRbacRank) return false;
    if (!unitIdTrimmed) return true;
    const rank = maxRankInUnit(r.id, unitIdTrimmed);
    return rank !== null && rank <= focalRankForFilter;
  });

  const managerSelectValue = managerChoices.some((m) => m.id === managerId) ? managerId : "";

  const canSubmit = Boolean(canWrite && membershipId.trim().length > 0);

  return (
    <form action={action} className="mt-4 space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800">Person (Benutzerkontingent)</h3>
        <p className="text-xs text-zinc-500">
          Name, E-Mail und Rollenbezeichnung kommen aus der Benutzerverwaltung (Mitgliedschaft / Konto) und werden
          hier nur angezeigt — Anpassungen unter „Benutzerliste und Einladungen“.
        </p>
        <label className="block">
          <span className="text-xs text-zinc-600">Mitgliedschaft auswählen</span>
          <select
            name="membership_id"
            required
            value={membershipId}
            onChange={(e) => {
              setMembershipId(e.target.value);
              setManagerId("");
              setReportById({});
            }}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">— auswählen —</option>
            {memberships.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 space-y-1">
            <p>
              <span className="font-medium text-zinc-800">E-Mail:</span> {selected.email ?? "—"}
            </p>
            <p>
              <span className="font-medium text-zinc-800">Rolle (Organisation / Kontingent):</span>{" "}
              {selected.title?.trim() || "—"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-200 pt-6 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800">Organisationseinheit</h3>
        <label className="block">
          <span className="text-xs text-zinc-600">Einheit</span>
          <select
            name="organization_unit_id"
            value={organizationUnitId}
            onChange={(e) => {
              setOrganizationUnitId(e.target.value);
              setManagerId("");
              setReportById({});
            }}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">— optional —</option>
            {orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code} - {unit.name} ({unit.unit_type_label})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-zinc-600">Rolle in der Organisationseinheit</span>
          <select
            name="assignment_type"
            value={assignmentType}
            onChange={(e) => {
              setAssignmentType(e.target.value as AssignmentType);
              setManagerId("");
              setReportById({});
            }}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-amber-800">
          Hinweis: Leeres Einheitfeld speichert keine Bereichszuordnung; bestehende Zuordnungen in der Liste unten
          bleiben unverändert.
        </p>
      </div>

      <div className="border-t border-zinc-200 pt-6 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800">Reporting</h3>
        <p className="text-xs text-zinc-500">
          Manager: eine Person über der gewählten Person. Reports: mehrere direkte Unterstellungen. Leer lassen und
          speichern entfernt die jeweiligen Linien für diese Verantwortliche.
        </p>
        <p className="text-xs text-zinc-600">
          Nach{" "}
          <span className="font-medium text-zinc-800">Organisations-Rollen</span> (executive, department lead, team
          member, …): Manager nur mit gleicher oder höherer Stufe; Reports nur mit gleicher oder niedrigerer Stufe wie die
          ausgewählte Mitgliedschaft.
        </p>
        {organizationUnitId.trim() ? (
          <p className="text-xs text-zinc-600">
            Zusätzlich zur gewählten Organisationseinheit: nur Verantwortliche, die diesem Bereich bereits zugeordnet
            sind — Manager mit gleicher oder höherwertiger Bereichsrolle (Hauptverantwortung &gt; Unterstützung &gt;
            Stakeholder), Reports mit gleicher oder niedrigerer Bereichsrolle.
          </p>
        ) : (
          <p className="text-xs text-zinc-500">
            Ohne gewählte Organisationseinheit entfällt der Filter nach Bereichsrolle; die Filterung nach
            Organisations-Rollen bleibt aktiv, sobald eine Mitgliedschaft gewählt ist.
          </p>
        )}
        <label className="block">
          <span className="text-xs text-zinc-600">Manager</span>
          <select
            name="manager_responsible_id"
            value={managerSelectValue}
            onChange={(e) => setManagerId(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">— kein Manager —</option>
            {managerChoices.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs text-zinc-600">Reports (direkt unterstellt)</legend>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-zinc-200 p-3">
            {reportChoices.length === 0 ? (
              <p className="text-xs text-zinc-500">Keine weiteren Verantwortlichen für Mehrfachauswahl.</p>
            ) : (
              reportChoices.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="report_responsible_ids"
                    value={r.id}
                    checked={Boolean(reportById[r.id])}
                    onChange={(e) => setReportById((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                    className="rounded border-zinc-400"
                  />
                  {r.full_name}
                </label>
              ))
            )}
          </div>
        </fieldset>
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <button
          type="submit"
          disabled={!canSubmit}
          className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}
