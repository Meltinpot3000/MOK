import type { OrganizationUnit, OrganizationUnitType } from "@/lib/phase0/queries";

type OrganizationUnitNodeProps = {
  unit: OrganizationUnit;
  units: OrganizationUnit[];
  unitTypes: OrganizationUnitType[];
  childMap: Map<string | null, OrganizationUnit[]>;
  canWrite: boolean;
  updateAction: (formData: FormData) => void;
  createChildAction: (formData: FormData) => void;
  moveAction: (formData: FormData) => void;
  archiveAction: (formData: FormData) => void;
};

function collectDescendantIds(
  unitId: string,
  childMap: Map<string | null, OrganizationUnit[]>,
  accumulator: Set<string>
): void {
  const children = childMap.get(unitId) ?? [];
  for (const child of children) {
    if (!accumulator.has(child.id)) {
      accumulator.add(child.id);
      collectDescendantIds(child.id, childMap, accumulator);
    }
  }
}

export function OrganizationUnitNode({
  unit,
  units,
  unitTypes,
  childMap,
  canWrite,
  updateAction,
  createChildAction,
  moveAction,
  archiveAction,
}: OrganizationUnitNodeProps) {
  const children = childMap.get(unit.id) ?? [];
  const blockedParentIds = new Set<string>([unit.id]);
  collectDescendantIds(unit.id, childMap, blockedParentIds);
  const availableMoveTargets = units.filter(
    (candidate) => !blockedParentIds.has(candidate.id) && candidate.status === "active"
  );

  return (
    <li className="rounded-md border border-zinc-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {unit.code} - {unit.name}
          </p>
          <p className="text-xs text-zinc-600">
            Typ: {unit.unit_type?.name ?? unit.unit_type?.code ?? "Unbekannt"} | Status: {unit.status}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form action={updateAction} className="space-y-2 rounded-md border border-zinc-200 p-3">
          <input type="hidden" name="id" value={unit.id} />
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bearbeiten</p>
          <input
            name="name"
            required
            defaultValue={unit.name}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="code"
            required
            defaultValue={unit.code}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            name="organization_unit_type_id"
            required
            defaultValue={unit.organization_unit_type_id}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
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
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!canWrite}
            className="brand-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bearbeiten
          </button>
        </form>

        <div className="space-y-3">
          <form action={createChildAction} className="space-y-2 rounded-md border border-zinc-200 p-3">
            <input type="hidden" name="parent_id" value={unit.id} />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Kind anlegen</p>
            <input
              name="name"
              required
              placeholder="Name"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="code"
              required
              placeholder="Code"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              name="organization_unit_type_id"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Organisationstyp auswählen</option>
              {unitTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <textarea
              name="description"
              rows={2}
              placeholder="Beschreibung"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Kind erstellen
            </button>
          </form>

          <form action={moveAction} className="space-y-2 rounded-md border border-zinc-200 p-3">
            <input type="hidden" name="id" value={unit.id} />
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Verschieben</p>
            <select
              name="parent_id"
              defaultValue={unit.parent_id ?? ""}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Keine übergeordnete Einheit</option>
              {availableMoveTargets.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.code} - {candidate.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Verschieben
            </button>
          </form>

          <form action={archiveAction}>
            <input type="hidden" name="id" value={unit.id} />
            <button
              type="submit"
              disabled={!canWrite || unit.status === "archived"}
              className="rounded-md border border-red-300 px-3 py-2 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Archivieren
            </button>
          </form>
        </div>
      </div>

      {children.length > 0 ? (
        <ul className="mt-4 space-y-3 border-l border-zinc-200 pl-4">
          {children.map((child) => (
            <OrganizationUnitNode
              key={child.id}
              unit={child}
              units={units}
              unitTypes={unitTypes}
              childMap={childMap}
              canWrite={canWrite}
              updateAction={updateAction}
              createChildAction={createChildAction}
              moveAction={moveAction}
              archiveAction={archiveAction}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
