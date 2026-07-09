"use client";

import { SortableTableHeader } from "@/components/table/SortableTableHeader";
import { TableHorizontalScroll } from "@/components/table/TableHorizontalScroll";
import { memberInvitationStatusLabelDe } from "@/lib/member-invitation-status";
import { compareSortKeys } from "@/lib/table/compare-sort-keys";
import { useMemo, useState } from "react";

type ClosedInviteView = {
  id: string;
  invited_email: string;
  invited_display_name: string | null;
  invited_membership_title: string | null;
  role_codes: string[];
  status: string;
  expires_at: string;
  accepted_at: string | null;
};

type Props = {
  invitationViews: ClosedInviteView[];
};

type SortCol = "email" | "displayName" | "membershipTitle" | "role" | "status" | "expiresAt" | "acceptedAt";

export function InvitationsClosedTable({ invitationViews }: Props) {
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
      } else if (sortCol === "acceptedAt") {
        va = a.accepted_at ?? "";
        vb = b.accepted_at ?? "";
      } else {
        va = a.expires_at;
        vb = b.expires_at;
      }
      return compareSortKeys(va, vb) * mul;
    });
  }, [invitationViews, sortCol, sortDir]);

  return (
    <TableHorizontalScroll>
      <table className="w-max min-w-full text-sm">
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
            label="Einladung bis"
            sortDirection={sortCol === "expiresAt" ? sortDir : null}
            onRequestSort={() => requestSort("expiresAt")}
            className="py-2"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
          <SortableTableHeader
            label="Abgeschlossen am"
            sortDirection={sortCol === "acceptedAt" ? sortDir : null}
            onRequestSort={() => requestSort("acceptedAt")}
            className="py-2"
            buttonClassName="hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
          />
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
            <td className="py-3 pr-3">{memberInvitationStatusLabelDe(invite.status)}</td>
            <td className="py-3 pr-3 text-xs text-zinc-600">
              {new Date(invite.expires_at).toLocaleDateString("de-DE")}
            </td>
            <td className="py-3 pr-3 text-xs text-zinc-600">
              {invite.accepted_at ? new Date(invite.accepted_at).toLocaleString("de-DE") : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </TableHorizontalScroll>
  );
}
