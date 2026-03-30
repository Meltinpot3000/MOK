"use client";

import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";
import { useState } from "react";

type ResponsibleRowEditFormProps = {
  responsible: {
    id: string;
    full_name: string;
    email: string | null;
    role_title: string | null;
  };
  canWrite: boolean;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
};

export function ResponsibleRowEditForm({
  responsible,
  canWrite,
  updateAction,
  deleteAction,
}: ResponsibleRowEditFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const isInteractive = canWrite && isEditing;
  const deleteFormId = `delete-responsible-${responsible.id}`;

  return (
    <>
    <ConfirmBeforeSubmitForm
      id={deleteFormId}
      action={deleteAction}
      className="hidden"
      title="Verantwortlichen löschen?"
      description="Der Datensatz wird dauerhaft entfernt. Das ist nicht rückgängig zu machen, sofern die Datenbank keine Abhängigkeiten meldet."
      confirmLabel="Löschen"
    >
      <input type="hidden" name="id" value={responsible.id} />
    </ConfirmBeforeSubmitForm>
    <form action={updateAction} className="grid min-w-[760px] grid-cols-10 gap-2">
      <input type="hidden" name="id" value={responsible.id} />
      <input
        name="full_name"
        required
        defaultValue={responsible.full_name}
        disabled={!isInteractive}
        className="col-span-3 rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
      />
      <input
        name="email"
        required
        type="email"
        defaultValue={responsible.email ?? ""}
        disabled={!isInteractive}
        className="col-span-3 rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
      />
      <input
        name="role_title"
        required
        defaultValue={responsible.role_title ?? ""}
        disabled={!isInteractive}
        className="col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
      />
      <div className="col-span-2 flex gap-2">
        {isEditing ? (
          <>
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-700"
            >
              Abbrechen
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            disabled={!canWrite}
            className="brand-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bearbeiten
          </button>
        )}
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
    </form>
    </>
  );
}

