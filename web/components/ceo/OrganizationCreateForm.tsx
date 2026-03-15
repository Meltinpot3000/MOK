"use client";

import { useMemo, useState } from "react";
import type { OrganizationUnit, OrganizationUnitType } from "@/lib/phase0/queries";

type OrganizationCreateFormProps = {
  units: OrganizationUnit[];
  unitTypes: OrganizationUnitType[];
  canWrite: boolean;
  action: (formData: FormData) => void;
};

export function OrganizationCreateForm({ units, unitTypes, canWrite, action }: OrganizationCreateFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [typeId, setTypeId] = useState(unitTypes[0]?.id ?? "");
  const [description, setDescription] = useState("");

  const availableParents = useMemo(
    () => units.filter((unit) => unit.status === "active"),
    [units]
  );

  const isValid = name.trim().length > 0 && code.trim().length > 0 && typeId.length > 0;

  return (
    <form action={action} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <input
        name="name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        name="code"
        required
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Code"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <select
        name="organization_unit_type_id"
        required
        value={typeId}
        onChange={(event) => setTypeId(event.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="">Organisationstyp auswählen</option>
        {unitTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </select>
      <select
        name="parent_id"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="">Keine übergeordnete Einheit</option>
        {availableParents.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.code} - {unit.name} ({unit.unit_type?.name ?? unit.unit_type?.code ?? "Typ"})
          </option>
        ))}
      </select>
      <textarea
        name="description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Beschreibung"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
        rows={3}
      />
      <button
        type="submit"
        disabled={!canWrite || !isValid}
        className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
      >
        Organisationseinheit speichern
      </button>
    </form>
  );
}
