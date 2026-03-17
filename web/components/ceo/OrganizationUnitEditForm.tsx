"use client";

import { useState } from "react";
import type { OrganizationUnit, OrganizationUnitType } from "@/lib/phase0/queries";

type OrganizationUnitEditFormProps = {
  unit: OrganizationUnit;
  unitTypes: OrganizationUnitType[];
  canWrite: boolean;
  updateAction: (formData: FormData) => void;
};

export function OrganizationUnitEditForm({
  unit,
  unitTypes,
  canWrite,
  updateAction,
}: OrganizationUnitEditFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const isInteractive = canWrite && isEditing;

  return (
    <form action={updateAction} className="space-y-2 rounded-md border border-zinc-200 p-3">
      <input type="hidden" name="id" value={unit.id} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bearbeiten</p>
        {!isEditing ? (
          <span className="text-xs text-zinc-500">Felder gesperrt</span>
        ) : (
          <span className="text-xs text-emerald-700">Bearbeitungsmodus aktiv</span>
        )}
      </div>
      <input
        name="name"
        required
        defaultValue={unit.name}
        disabled={!isInteractive}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
      />
      <input
        name="code"
        required
        defaultValue={unit.code}
        disabled={!isInteractive}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
      />
      <select
        name="organization_unit_type_id"
        required
        defaultValue={unit.organization_unit_type_id}
        disabled={!isInteractive}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
      >
        {unitTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </select>
      <textarea
        name="description"
        defaultValue={unit.description ?? ""}
        rows={2}
        disabled={!isInteractive}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
      />
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-700"
            >
              Abbrechen
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            disabled={!canWrite}
            className="brand-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bearbeiten
          </button>
        )}
      </div>
    </form>
  );
}

