"use client";

import Link from "next/link";
import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";

type ResponsibleRowEditFormProps = {
  responsible: {
    id: string;
    full_name: string;
    email: string | null;
    role_title: string | null;
  };
  canWrite: boolean;
  deleteAction: (formData: FormData) => void;
};

export function ResponsibleRowEditForm({ responsible, canWrite, deleteAction }: ResponsibleRowEditFormProps) {
  const deleteFormId = `delete-responsible-${responsible.id}`;

  return (
    <>
      <ConfirmBeforeSubmitForm
        id={deleteFormId}
        action={deleteAction}
        className="hidden"
        title="Verantwortlichen löschen?"
        description="Der Datensatz wird dauerhaft entfernt. Zuordnungen in dieser Organisation werden aufgelöst, sofern die Datenbank keine Abhängigkeiten meldet."
        confirmLabel="Löschen"
      >
        <input type="hidden" name="id" value={responsible.id} />
      </ConfirmBeforeSubmitForm>
      <div className="grid min-w-[760px] grid-cols-10 gap-2">
        <div className="col-span-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
          {responsible.full_name}
        </div>
        <div className="col-span-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {responsible.email ?? "—"}
        </div>
        <div className="col-span-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {responsible.role_title ?? "—"}
        </div>
        <div className="col-span-2 flex flex-wrap gap-2">
          <Link
            href="/invitations"
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-100"
          >
            Stammdaten
          </Link>
          <button
            type="submit"
            form={deleteFormId}
            formNoValidate
            disabled={!canWrite}
            className="rounded-md border border-red-300 px-3 py-2 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Löschen
          </button>
        </div>
      </div>
    </>
  );
}
