"use client";

import { useState } from "react";

type ResponsibleCreateFormProps = {
  canWrite: boolean;
  action: (formData: FormData) => void;
};

export function ResponsibleCreateForm({ canWrite, action }: ResponsibleCreateFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("");

  const isValid =
    fullName.trim().length > 0 && email.trim().length > 0 && roleTitle.trim().length > 0;

  return (
    <form action={action} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <input
        name="full_name"
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        placeholder="Name"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        name="email"
        required
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="E-Mail"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        name="role_title"
        required
        value={roleTitle}
        onChange={(event) => setRoleTitle(event.target.value)}
        placeholder="Rollenbezeichnung"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={!canWrite || !isValid}
        className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 md:col-span-3"
      >
        Verantwortliche speichern
      </button>
    </form>
  );
}
