"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

export type AdminSettingsRow = {
  organization_id: string;
  ai_enabled: boolean;
  local_llm_enabled: boolean;
  external_models_enabled: boolean;
  web_search_enabled: boolean;
  write_actions_enabled: boolean;
  require_human_approval: boolean;
  default_local_model: string | null;
  default_fast_model: string | null;
  default_frontier_model: string | null;
  max_tool_calls_per_run: number;
  max_context_objects: number;
  log_prompts: boolean;
  log_responses: boolean;
  log_tool_calls: boolean;
};

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "ok" } | { kind: "error"; message: string };

export function AdminSettingsForm({
  initial,
  organizationName,
}: {
  initial: AdminSettingsRow;
  organizationName: string;
}) {
  const [form, setForm] = useState<AdminSettingsRow>(initial);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  function setBool(key: keyof AdminSettingsRow) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.checked }));
    };
  }
  function setStr(key: keyof AdminSettingsRow) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value || null }));
    };
  }
  function setNum(key: keyof AdminSettingsRow, min: number, max: number) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const raw = Number(e.target.value);
      const clamped = Math.min(max, Math.max(min, Number.isFinite(raw) ? raw : min));
      setForm((prev) => ({ ...prev, [key]: clamped }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState({ kind: "saving" });
    try {
      const response = await fetch("/api/ai/admin-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const text = await response.text();
        setSaveState({ kind: "error", message: text || `HTTP ${response.status}` });
        return;
      }
      setSaveState({ kind: "ok" });
    } catch (error) {
      setSaveState({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
        Organisation: <span className="font-medium">{organizationName}</span>
      </div>

      <fieldset className="space-y-3 rounded-md border border-zinc-200 p-4">
        <legend className="text-sm font-medium text-zinc-900">Aktivierung</legend>
        <Checkbox
          label="Sentinel Assistant aktivieren"
          checked={form.ai_enabled}
          onChange={setBool("ai_enabled")}
        />
        <Checkbox
          label="Lokales LLM aktivieren"
          checked={form.local_llm_enabled}
          onChange={setBool("local_llm_enabled")}
        />
        <Checkbox
          label="Externe Modelle erlauben"
          checked={form.external_models_enabled}
          onChange={setBool("external_models_enabled")}
        />
        <Checkbox
          label="Web-Suche erlauben (benoetigt externe Modelle)"
          checked={form.web_search_enabled}
          onChange={setBool("web_search_enabled")}
        />
        <Checkbox
          label="Schreibaktionen erlauben (Vorschlaege)"
          checked={form.write_actions_enabled}
          onChange={setBool("write_actions_enabled")}
        />
        <Checkbox
          label="Menschliche Freigabe vor Schreibaktionen"
          checked={form.require_human_approval}
          onChange={setBool("require_human_approval")}
        />
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-zinc-200 p-4">
        <legend className="text-sm font-medium text-zinc-900">Modelle</legend>
        <TextField
          label="Default Local Model"
          value={form.default_local_model ?? ""}
          onChange={setStr("default_local_model")}
          placeholder="z. B. llama3.1:8b-instruct-q4_K_M"
        />
        <TextField
          label="Default Fast Model"
          value={form.default_fast_model ?? ""}
          onChange={setStr("default_fast_model")}
          placeholder="z. B. gemini-2.5-flash"
        />
        <TextField
          label="Default Frontier Model"
          value={form.default_frontier_model ?? ""}
          onChange={setStr("default_frontier_model")}
          placeholder="z. B. claude-3-5-sonnet"
        />
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-zinc-200 p-4">
        <legend className="text-sm font-medium text-zinc-900">Limits</legend>
        <NumberField
          label="Max Tool-Calls pro Run"
          value={form.max_tool_calls_per_run}
          onChange={setNum("max_tool_calls_per_run", 1, 64)}
          min={1}
          max={64}
        />
        <NumberField
          label="Max Context-Objekte"
          value={form.max_context_objects}
          onChange={setNum("max_context_objects", 1, 500)}
          min={1}
          max={500}
        />
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-zinc-200 p-4">
        <legend className="text-sm font-medium text-zinc-900">Logging</legend>
        <Checkbox
          label="Prompts loggen"
          checked={form.log_prompts}
          onChange={setBool("log_prompts")}
        />
        <Checkbox
          label="Antworten loggen"
          checked={form.log_responses}
          onChange={setBool("log_responses")}
        />
        <Checkbox
          label="Tool-Calls loggen"
          checked={form.log_tool_calls}
          onChange={setBool("log_tool_calls")}
        />
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saveState.kind === "saving"}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveState.kind === "saving" ? "Speichern..." : "Speichern"}
        </button>
        {saveState.kind === "ok" ? <span className="text-sm text-emerald-700">Gespeichert.</span> : null}
        {saveState.kind === "error" ? (
          <span className="text-sm text-red-700">Fehler: {saveState.message}</span>
        ) : null}
      </div>
    </form>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-zinc-800">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs text-zinc-600">
      {label}
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block text-xs text-zinc-600">
      {label}
      <input
        type="number"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        className="mt-1 w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}
