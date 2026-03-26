"use client";

import { SortableTableHeader } from "@/components/table/SortableTableHeader";
import { compareSortKeys } from "@/lib/table/compare-sort-keys";
import Image from "next/image";
import { useMemo, useState } from "react";

type InviteView = {
  id: string;
  invited_email: string;
  invited_display_name: string | null;
  invited_membership_title: string | null;
  role_codes: string[];
  status: string;
  expires_at: string;
  loginUrl: string;
  qrDataUrl: string;
};

type Props = {
  invitationViews: InviteView[];
  canWrite: boolean;
  serviceRoleConfigured: boolean;
  resendInvitation: (formData: FormData) => Promise<void>;
  revokeInvitation: (formData: FormData) => Promise<void>;
};

type SortCol = "email" | "name" | "role" | "status" | "expiresAt";

export function InvitationsPendingTable({
  invitationViews,
  canWrite,
  serviceRoleConfigured,
  resendInvitation,
  revokeInvitation,
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
    if (!sortCol) return invitationViews;
    const mul = sortDir === "asc" ? 1 : -1;
    return [...invitationViews].sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      if (sortCol === "email") {
        va = a.invited_email;
        vb = b.invited_email;
      } else if (sortCol === "displayName") {
        va = a.invited_display_name ?? "";
        vb = b.invited_display_name ?? "";
      } else if (sortCol === "membershipTitle") {
        va = a.invited_membership_title ?? "";
        vb = b.invited_membership_title ?? "";
      } else if (sortCol === "role") {
        va = [...a.role_codes].sort().join(", ");
        vb = [...b.role_codes].sort().join(", ");
      } else if (sortCol === "status") {
        va = a.status;
        vb = b.status;
      } else {
        va = a.expires_at;
        vb = b.expires_at;
      }
      return compareSortKeys(va, vb) * mul;
    });
  }, [invitationViews, sortCol, sortDir]);

  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-zinc-500">
          <SortableTableHeader
            label="E-Mail"
            sortDirection={sortCol === "email" ? sortDir : null}
            onRequestSort={() => requestSort("email")}
            className="py-2"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <SortableTableHeader
            label="Anzeigename"
            sortDirection={sortCol === "displayName" ? sortDir : null}
            onRequestSort={() => requestSort("displayName")}
            className="py-2"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <SortableTableHeader
            label="Titel / Funktion"
            sortDirection={sortCol === "membershipTitle" ? sortDir : null}
            onRequestSort={() => requestSort("membershipTitle")}
            className="py-2"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <SortableTableHeader
            label="Rollen"
            sortDirection={sortCol === "role" ? sortDir : null}
            onRequestSort={() => requestSort("role")}
            className="py-2"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <SortableTableHeader
            label="Status"
            sortDirection={sortCol === "status" ? sortDir : null}
            onRequestSort={() => requestSort("status")}
            className="py-2"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <SortableTableHeader
            label="Ablauf"
            sortDirection={sortCol === "expiresAt" ? sortDir : null}
            onRequestSort={() => requestSort("expiresAt")}
            className="py-2"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <th className="py-2">Anmeldelink</th>
          <th className="py-2">QR</th>
          <th className="py-2">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((invite) => (
          <tr key={invite.id} className="border-b border-zinc-100 align-top">
            <td className="py-3 pr-3">{invite.invited_email}</td>
            <td className="py-3 pr-3 text-zinc-700">
              {invite.invited_display_name?.trim() ? invite.invited_display_name : "—"}
            </td>
            <td className="py-3 pr-3 text-zinc-700">
              {invite.invited_membership_title?.trim() ? invite.invited_membership_title : "—"}
            </td>
            <td className="py-3 pr-3">{invite.role_codes.length ? invite.role_codes.join(", ") : "—"}</td>
            <td className="py-3 pr-3">{invite.status}</td>
            <td className="py-3 pr-3 text-xs text-zinc-600">
              {new Date(invite.expires_at).toLocaleDateString("de-DE")}
            </td>
            <td className="py-3 pr-3">
              <a href={invite.loginUrl} className="text-zinc-900 underline underline-offset-2">
                Anmeldelink
              </a>
              <div className="mt-1 break-all text-xs text-zinc-500">{invite.loginUrl}</div>
            </td>
            <td className="py-3 pr-3">
              <Image
                src={invite.qrDataUrl}
                alt={`QR fuer ${invite.invited_email}`}
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 rounded border border-zinc-200"
              />
            </td>
            <td className="py-3">
              <div className="flex flex-col gap-2">
                <form action={resendInvitation}>
                  <input type="hidden" name="invite_id" value={invite.id} />
                  <button
                    type="submit"
                    disabled={invite.status !== "pending" || !serviceRoleConfigured || !canWrite}
                    className="brand-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Erneut senden
                  </button>
                </form>
                <form action={revokeInvitation}>
                  <input type="hidden" name="invite_id" value={invite.id} />
                  <button
                    type="submit"
                    disabled={invite.status !== "pending" || !canWrite}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Widerrufen
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
