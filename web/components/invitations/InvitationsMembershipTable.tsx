"use client";

import { SortableTableHeader } from "@/components/table/SortableTableHeader";
import { compareSortKeys } from "@/lib/table/compare-sort-keys";
import { useMemo, useState } from "react";

type MembershipRow = {
  id: string;
  user_id: string;
  status: "active" | "invited" | "suspended";
  title: string | null;
  created_at: string;
  responsible_id: string | null;
  responsible:
    | {
        id: string;
        full_name: string;
        email: string | null;
        role_title: string | null;
      }
    | Array<{
        id: string;
        full_name: string;
        email: string | null;
        role_title: string | null;
      }>
    | null;
};

type UserIdentity = {
  email: string | null;
  name: string | null;
};

type Props = {
  memberships: MembershipRow[];
  identityByUserId: Record<string, UserIdentity>;
  roleCodesByMembership: Record<string, string[]>;
  responsibles: Array<{
    id: string;
    full_name: string;
    email: string | null;
    role_title: string | null;
  }>;
  editableRoles: Array<{ id: string; code: string; name: string }>;
  canWrite: boolean;
  updateMembershipRole: (formData: FormData) => Promise<void>;
  assignResponsibleToMembership: (formData: FormData) => Promise<void>;
};

type SortCol = "user" | "status" | "role" | "responsible";

function displayUser(membership: MembershipRow, identityByUserId: Record<string, UserIdentity>) {
  const responsible = Array.isArray(membership.responsible)
    ? membership.responsible[0]
    : membership.responsible;
  const identity = identityByUserId[membership.user_id];
  const displayEmail = identity?.email ?? responsible?.email ?? null;
  const displayName =
    identity?.name ??
    responsible?.full_name ??
    (displayEmail ? displayEmail.split("@")[0] : "Unbekannter Benutzer");
  return { displayName, displayEmail };
}

export function InvitationsMembershipTable({
  memberships,
  identityByUserId,
  roleCodesByMembership,
  responsibles,
  editableRoles,
  canWrite,
  updateMembershipRole,
  assignResponsibleToMembership,
}: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const requestSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortCol) return memberships;
    const mul = sortDir === "asc" ? 1 : -1;
    return [...memberships].sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      if (sortCol === "user") {
        va = displayUser(a, identityByUserId).displayName;
        vb = displayUser(b, identityByUserId).displayName;
      } else if (sortCol === "status") {
        va = a.status;
        vb = b.status;
      } else if (sortCol === "role") {
        va = (roleCodesByMembership[a.id] ?? [])[0] ?? "";
        vb = (roleCodesByMembership[b.id] ?? [])[0] ?? "";
      } else {
        const ra = Array.isArray(a.responsible) ? a.responsible[0] : a.responsible;
        const rb = Array.isArray(b.responsible) ? b.responsible[0] : b.responsible;
        va = ra ? `${ra.full_name}${ra.role_title ? ` (${ra.role_title})` : ""}` : "";
        vb = rb ? `${rb.full_name}${rb.role_title ? ` (${rb.role_title})` : ""}` : "";
      }
      return compareSortKeys(va, vb) * mul;
    });
  }, [memberships, sortCol, sortDir, identityByUserId, roleCodesByMembership]);

  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-zinc-500">
          <SortableTableHeader
            label="Benutzer"
            sortDirection={sortCol === "user" ? sortDir : null}
            onRequestSort={() => requestSort("user")}
            className="py-2 pr-3"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <SortableTableHeader
            label="Status"
            sortDirection={sortCol === "status" ? sortDir : null}
            onRequestSort={() => requestSort("status")}
            className="py-2 pr-3"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <SortableTableHeader
            label="Rolle"
            sortDirection={sortCol === "role" ? sortDir : null}
            onRequestSort={() => requestSort("role")}
            className="py-2 pr-3"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <SortableTableHeader
            label="Verantwortlicher"
            sortDirection={sortCol === "responsible" ? sortDir : null}
            onRequestSort={() => requestSort("responsible")}
            className="py-2 pr-3"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <th className="py-2 pr-3">Aktion</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((membership) => {
          const roleCodes = roleCodesByMembership[membership.id] ?? [];
          const responsible = Array.isArray(membership.responsible)
            ? membership.responsible[0]
            : membership.responsible;
          const { displayName, displayEmail } = displayUser(membership, identityByUserId);
          return (
            <tr key={membership.id} className="border-b border-zinc-100 align-top">
              <td className="py-3 pr-3">
                <div className="font-medium text-zinc-900">{displayName}</div>
                <div className="text-xs text-zinc-500">{displayEmail ?? "E-Mail nicht verfuegbar"}</div>
              </td>
              <td className="py-3 pr-3">{membership.status}</td>
              <td className="py-3 pr-3">
                <form action={updateMembershipRole} className="flex items-center gap-2">
                  <input type="hidden" name="membership_id" value={membership.id} />
                  <select
                    name="role_code"
                    defaultValue={roleCodes[0] ?? ""}
                    disabled={!canWrite}
                    className="min-w-[200px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                  >
                    <option value="">Rolle waehlen</option>
                    {editableRoles.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.name} ({role.code})
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                    Speichern
                  </button>
                </form>
              </td>
              <td className="py-3 pr-3">
                {responsible
                  ? `${responsible.full_name}${responsible.role_title ? ` (${responsible.role_title})` : ""}`
                  : "-"}
              </td>
              <td className="py-3 pr-3">
                <form action={assignResponsibleToMembership} className="flex items-center gap-2">
                  <input type="hidden" name="membership_id" value={membership.id} />
                  <select
                    name="responsible_id"
                    defaultValue={membership.responsible_id ?? ""}
                    disabled={!canWrite}
                    className="min-w-[260px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                  >
                    <option value="">Keine Zuordnung</option>
                    {responsibles.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.full_name}
                        {entry.role_title ? ` - ${entry.role_title}` : ""}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                    Speichern
                  </button>
                </form>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
