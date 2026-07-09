"use client";

import { SortableColumnHeaderButton } from "@/components/table/SortableTableHeader";
import { TableHorizontalScroll } from "@/components/table/TableHorizontalScroll";
import { SIDEBAR_ITEMS } from "@/lib/sidebar-access";
import { useMemo, useState } from "react";

type Role = { id: string; code: string; name: string };

type Props = {
  roles: Role[];
  matrixMap: Record<string, "none" | "read" | "write">;
  canWrite: boolean;
};

export function RoleAccessMatrixTable({ roles, matrixMap, canWrite }: Props) {
  const [itemSortDir, setItemSortDir] = useState<"asc" | "desc" | null>(null);
  const [roleOrderDir, setRoleOrderDir] = useState<"asc" | "desc" | null>(null);

  const sortedItems = useMemo(() => {
    if (!itemSortDir) return [...SIDEBAR_ITEMS];
    const mul = itemSortDir === "asc" ? 1 : -1;
    return [...SIDEBAR_ITEMS].sort(
      (a, b) => a.label.localeCompare(b.label, "de") * mul
    );
  }, [itemSortDir]);

  const sortedRoles = useMemo(() => {
    if (!roleOrderDir) return roles;
    const mul = roleOrderDir === "asc" ? 1 : -1;
    return [...roles].sort((a, b) => a.name.localeCompare(b.name, "de") * mul);
  }, [roles, roleOrderDir]);

  const toggleItemSort = () => {
    setItemSortDir((d) => {
      if (d === null) return "asc";
      if (d === "asc") return "desc";
      return "asc";
    });
  };

  const toggleRoleOrder = () => {
    setRoleOrderDir((d) => {
      if (d === null) return "asc";
      if (d === "asc") return "desc";
      return "asc";
    });
  };

  const itemAriaSort =
    itemSortDir === "asc" ? "ascending" : itemSortDir === "desc" ? "descending" : "none";
  const roleAriaSort =
    roleOrderDir === "asc" ? "ascending" : roleOrderDir === "desc" ? "descending" : "none";

  return (
    <TableHorizontalScroll>
      <table className="w-max min-w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-zinc-500">
          <th aria-sort={itemAriaSort} className="py-2 pr-3 align-bottom">
            <SortableColumnHeaderButton
              label="Sidebar-Item"
              sortDirection={itemSortDir}
              onRequestSort={toggleItemSort}
              buttonClassName="font-medium text-zinc-700 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
            />
          </th>
          {sortedRoles.map((role) => (
            <th
              key={role.id}
              aria-sort={roleOrderDir ? roleAriaSort : "none"}
              className="py-2 pr-3 align-bottom"
            >
              <SortableColumnHeaderButton
                label={role.name}
                sortDirection={roleOrderDir}
                onRequestSort={toggleRoleOrder}
                buttonClassName="font-semibold text-zinc-700 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <div className="text-xs font-normal text-zinc-500">{role.code}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedItems.map((item) => (
          <tr key={item.id} className="border-b border-zinc-100 align-top">
            <td className="py-3 pr-3">
              <div className="font-medium text-zinc-900">{item.label}</div>
              <div className="text-xs text-zinc-500">{item.href}</div>
            </td>
            {sortedRoles.map((role) => {
              const key = `${role.id}__${item.id}`;
              const level = matrixMap[key] ?? "none";
              return (
                <td key={key} className="py-3 pr-3">
                  <select
                    name={key}
                    defaultValue={level}
                    disabled={!canWrite}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                  >
                    <option value="none">Kein Zugriff</option>
                    <option value="read">Lesen</option>
                    <option value="write">Schreiben</option>
                  </select>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </TableHorizontalScroll>
  );
}
