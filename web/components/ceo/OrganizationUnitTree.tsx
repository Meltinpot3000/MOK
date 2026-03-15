import type { OrganizationUnit, OrganizationUnitType } from "@/lib/phase0/queries";
import { OrganizationUnitNode } from "@/components/ceo/OrganizationUnitNode";

type OrganizationUnitTreeProps = {
  units: OrganizationUnit[];
  unitTypes: OrganizationUnitType[];
  canWrite: boolean;
  updateAction: (formData: FormData) => void;
  createChildAction: (formData: FormData) => void;
  moveAction: (formData: FormData) => void;
  archiveAction: (formData: FormData) => void;
};

function buildChildMap(units: OrganizationUnit[]): Map<string | null, OrganizationUnit[]> {
  const map = new Map<string | null, OrganizationUnit[]>();
  for (const unit of units) {
    const key = unit.parent_id ?? null;
    const existing = map.get(key) ?? [];
    existing.push(unit);
    map.set(key, existing);
  }

  for (const [, children] of map.entries()) {
    children.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  return map;
}

export function OrganizationUnitTree({
  units,
  unitTypes,
  canWrite,
  updateAction,
  createChildAction,
  moveAction,
  archiveAction,
}: OrganizationUnitTreeProps) {
  const childMap = buildChildMap(units);
  const roots = childMap.get(null) ?? [];

  if (roots.length === 0) {
    return <p className="text-sm text-zinc-500">Noch keine Organisationseinheiten angelegt.</p>;
  }

  return (
    <ul className="space-y-3">
      {roots.map((root) => (
        <OrganizationUnitNode
          key={root.id}
          unit={root}
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
  );
}
