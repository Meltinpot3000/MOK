"use client";

import {
  ExpandableTable,
  type ColumnDef,
} from "@/components/ceo/ExpandableTable";
import { useMemo } from "react";

type MembershipRow = {
  id: string;
  user_id: string;
  status: "active" | "invited" | "suspended";
  /** Funktions-/Anzeigetitel (Tabellenspalte app.organization_memberships.title). */
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
  saveMembershipRow: (formData: FormData) => Promise<void>;
};

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

function responsibleSummary(membership: MembershipRow): string {
  const r = Array.isArray(membership.responsible) ? membership.responsible[0] : membership.responsible;
  if (!r) return "";
  return `${r.full_name}${r.role_title ? ` (${r.role_title})` : ""}`;
}

export function InvitationsMembershipTable({
  memberships,
  identityByUserId,
  roleCodesByMembership,
  responsibles,
  editableRoles,
  canWrite,
  saveMembershipRow,
}: Props) {
  const columns: ColumnDef<MembershipRow>[] = useMemo(
    () => [
      {
        id: "user",
        label: "Benutzer",
        sortValue: (row) => displayUser(row, identityByUserId).displayName,
        render: (row) => {
          const { displayName, displayEmail } = displayUser(row, identityByUserId);
          return (
            <div>
              <div className="font-medium text-zinc-900">{displayName}</div>
              <div className="text-zinc-500">{displayEmail ?? "E-Mail nicht verfuegbar"}</div>
              {row.title?.trim() ? (
                <div className="mt-1 text-xs text-zinc-600">
                  Titel: <span className="font-medium text-zinc-800">{row.title}</span>
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "status",
        label: "Status",
        sortValue: (row) => row.status,
        render: (row) => <span className="text-zinc-800">{row.status}</span>,
      },
      {
        id: "roles",
        label: "Rollen",
        sortValue: (row) => [...(roleCodesByMembership[row.id] ?? [])].sort().join(", "),
        render: (row) => {
          const codes = [...(roleCodesByMembership[row.id] ?? [])].sort();
          return (
            <span className="text-zinc-800">
              {codes.length > 0 ? codes.join(", ") : "—"}
            </span>
          );
        },
      },
      {
        id: "responsible",
        label: "Verantwortliche",
        sortValue: (row) => responsibleSummary(row),
        render: (row) => {
          const text = responsibleSummary(row);
          return <span className="text-zinc-800">{text || "—"}</span>;
        },
      },
    ],
    [identityByUserId, roleCodesByMembership]
  );

  return (
    <ExpandableTable<MembershipRow>
      enableColumnPickerUi={false}
      columns={columns}
      rows={memberships}
      getRowId={(row) => row.id}
      expandLabel="Einstellungen"
      emptyMessage="Keine Benutzer-Memberships vorhanden."
      renderExpandedContent={(membership) => {
        const roleCodes = (roleCodesByMembership[membership.id] ?? []).slice().sort();
        const responsible = Array.isArray(membership.responsible)
          ? membership.responsible[0]
          : membership.responsible;
        return (
          <form action={saveMembershipRow} className="mx-auto max-w-3xl space-y-4">
            <input type="hidden" name="membership_id" value={membership.id} />
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Rollen und Verantwortliche bearbeiten
            </p>
            <div className="space-y-4 border-t border-zinc-200 pt-4">
              <div>
                <label className="block text-sm font-medium text-zinc-800">
                  Titel / Funktion in der Organisation
                  <span className="ml-1 font-normal text-zinc-500">(optional)</span>
                </label>
                <input
                  name="membership_title"
                  type="text"
                  defaultValue={membership.title ?? ""}
                  disabled={!canWrite}
                  placeholder="z. B. Fachreferent, Team Lead"
                  className="mt-1 w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Wird in der Benutzerliste angezeigt; unabhaengig vom Namen aus dem Login-Konto.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <fieldset disabled={!canWrite} className="min-w-0 space-y-1.5 border-0 p-0">
                  <legend className="mb-2 text-sm font-medium text-zinc-800">
                    Organisation-Rollen
                  </legend>
                  {editableRoles.map((role) => (
                    <label
                      key={role.id}
                      className={`flex items-start gap-2 text-sm ${canWrite ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                    >
                      <input
                        type="checkbox"
                        name="role_codes"
                        value={role.code}
                        defaultChecked={roleCodes.includes(role.code)}
                        className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-zinc-300 accent-blue-600"
                      />
                      <span className="text-zinc-800">
                        {role.name}{" "}
                        <span className="text-zinc-500">({role.code})</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="md:border-l md:border-zinc-200 md:pl-6">
                  <p className="mb-2 text-sm font-medium text-zinc-800">Verantwortliche Zuordnung</p>
                  <p className="mb-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-600">Aktuell:</span>{" "}
                    {responsible
                      ? `${responsible.full_name}${
                          responsible.role_title ? ` (${responsible.role_title})` : ""
                        }`
                      : "keine Zuordnung"}
                  </p>
                  <select
                    name="responsible_id"
                    defaultValue={membership.responsible_id ?? ""}
                    disabled={!canWrite}
                    className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Keine Zuordnung</option>
                    {responsibles.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.full_name}
                        {entry.role_title ? ` - ${entry.role_title}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-zinc-200 pt-4">
              <button
                type="submit"
                disabled={!canWrite}
                className="brand-btn px-4 py-2 text-sm font-medium"
              >
                Speichern
              </button>
            </div>
          </form>
        );
      }}
    />
  );
}
