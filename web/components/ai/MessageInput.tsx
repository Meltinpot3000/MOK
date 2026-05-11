"use client";

import { useState, type FormEvent } from "react";

export type MessageInputProps = {
  onSubmit: (text: string) => void | Promise<void>;
  busy: boolean;
  placeholder?: string;
};

export function MessageInput({ onSubmit, busy, placeholder }: MessageInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="text-xs text-zinc-600" htmlFor="ai-assistant-input">
        Frage an Sentinel
      </label>
      <textarea
        id="ai-assistant-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder={
          placeholder ?? "z. B. 'Welche OKRs sind aktuell at-risk?' oder 'Zeige meine offenen Aufgaben'"
        }
        className="mt-1 w-full rounded-md border border-zinc-300 p-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        disabled={busy}
      />
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Antwortet..." : "Senden"}
        </button>
      </div>
    </form>
  );
}
