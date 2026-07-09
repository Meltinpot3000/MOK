import { TableHorizontalScroll } from "@/components/table/TableHorizontalScroll";
import { Fragment } from "react";
import {
  OKR_OBJECT_PERMISSION_GROUP_LABEL_DE,
  OKR_OBJECT_PERMISSION_GROUP_ORDER,
  OKR_OBJECT_PERMISSION_UI_ROWS,
  getOkrObjectDefaultCodesForRoleCode,
} from "@/lib/rbac/okr-object-permission-ui";

type Role = { id: string; code: string; name: string };

type Props = {
  roles: Role[];
  cells: Record<string, boolean>;
  canWrite: boolean;
};

const ROLE_PRESET_HINT_DE: Record<string, string> = {
  org_admin: "Vollzugriff auf alle Objectives und Key Results (.all); Review inkl. Facilitator-Zuweisung.",
  executive: "Alle OKRs lesen (.read.all), nicht bearbeiten; Review lesen und Facilitator zuweisen.",
  department_lead: "OKRs im Führungsbereich lesen und bearbeiten; Review-Sessions verwalten, Facilitator durch org_admin/executive.",
  team_member: "Eigene und deputierte OKRs lesen und bearbeiten.",
};

export function OkrObjectPermissionMatrix({ roles, cells, canWrite }: Props) {
  const rowsByGroup = OKR_OBJECT_PERMISSION_GROUP_ORDER.map((gid) =>
    OKR_OBJECT_PERMISSION_UI_ROWS.filter((r) => r.groupId === gid)
  );

  return (
    <div className="space-y-4">
      {roles.some((r) => ROLE_PRESET_HINT_DE[r.code]) ? (
        <ul className="list-inside list-disc text-xs text-zinc-600">
          {roles.map((r) => {
            const hint = ROLE_PRESET_HINT_DE[r.code];
            if (!hint) return null;
            return (
              <li key={r.id}>
                <span className="font-medium text-zinc-800">{r.name}</span> ({r.code}): {hint}
              </li>
            );
          })}
        </ul>
      ) : null}

      <TableHorizontalScroll>
        <table className="w-max min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500">
            <th className="py-2 pr-3 font-medium text-zinc-700">Bereich / Rolle</th>
            {roles.map((role) => (
              <th key={role.id} className="py-2 pr-3">
                <div className="font-semibold text-zinc-700">{role.name}</div>
                <div className="text-xs font-normal text-zinc-500">{role.code}</div>
                {getOkrObjectDefaultCodesForRoleCode(role.code) ? (
                  <div className="mt-0.5 text-[10px] font-normal uppercase tracking-wide text-zinc-400">
                    Standard-Preset verfügbar
                  </div>
                ) : (
                  <div className="mt-0.5 text-[10px] font-normal text-amber-700/90">
                    Kein Standard-Preset
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OKR_OBJECT_PERMISSION_GROUP_ORDER.map((groupId, gi) => (
            <Fragment key={groupId}>
              <tr className="bg-zinc-50">
                <td
                  colSpan={roles.length + 1}
                  className="py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-zinc-600"
                >
                  {OKR_OBJECT_PERMISSION_GROUP_LABEL_DE[groupId]}
                </td>
              </tr>
              {rowsByGroup[gi].map((row) => (
                <tr key={row.code} className="border-b border-zinc-100 align-top">
                  <td className="py-3 pr-3">
                    <div className="font-medium text-zinc-900">{row.labelDe}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-zinc-500">Code: {row.code}</div>
                  </td>
                  {roles.map((role) => {
                    const key = `${role.id}__${row.code}`;
                    const checked = cells[key] ?? false;
                    return (
                      <td key={key} className="py-3 pr-3 text-center">
                        <input
                          type="checkbox"
                          name={key}
                          value="on"
                          defaultChecked={checked}
                          disabled={!canWrite}
                          className="h-4 w-4 rounded border-zinc-300"
                          aria-label={`${role.name}: ${row.code}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      </TableHorizontalScroll>
    </div>
  );
}
