"use client";

import { useMemo, useTransition } from "react";
import {
  SMART_DIMENSION_HINTS_DE,
  SMART_DIMENSION_KEYS,
  SMART_DIMENSION_LABELS_DE,
  type AnnualTargetSmartFormulation,
} from "@/lib/annual-targets/types";
import { emptySmartFormulation } from "@/lib/annual-targets/types";

const FORM_ID = "annual-target-form";

type Props = {
  directions: { id: string; title: string }[];
  programs: { id: string; title: string; strategic_direction_id?: string | null }[];
  saveAction: (formData: FormData) => Promise<void>;
  submitLabel: string;
};

function enrichFormData(
  form: HTMLFormElement,
  directions: Props["directions"],
  programs: Props["programs"]
): FormData {
  const fd = new FormData(form);
  const dirId = (form.elements.namedItem("strategic_direction_id") as HTMLInputElement | HTMLSelectElement)
    ?.value;
  const progId = (form.elements.namedItem("strategy_program_id") as HTMLSelectElement | HTMLInputElement)
    ?.value;
  fd.set("direction_title", directions.find((d) => d.id === dirId)?.title ?? "");
  fd.set("program_title", programs.find((p) => p.id === progId)?.title ?? "");
  return fd;
}

export function AnnualTargetSentinelPanel({
  directions,
  programs,
  saveAction,
  submitLabel,
}: Props) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) return;
    if (!form.reportValidity()) return;
    const fd = enrichFormData(form, directions, programs);
    startTransition(async () => {
      await saveAction(fd);
    });
  };

  return (
    <section className="mt-4 space-y-2">
      <p className="text-xs text-zinc-500">
        Speichert den Entwurf und lässt Sentinel SMART-Formulierungen sowie den Fit zum Anker
        (Stoßrichtung oder Programm) bewerten. Vorschläge erscheinen rechts in der Übersicht und
        können einzeln übernommen werden.
      </p>
      <button type="button" disabled={pending} onClick={onClick} className="brand-btn px-4 py-2 text-sm">
        {pending ? "Speichert und Sentinel prüft…" : submitLabel}
      </button>
    </section>
  );
}

export function SmartFormulationFields({
  initial,
}: {
  initial?: AnnualTargetSmartFormulation | null;
}) {
  const values = useMemo(() => initial ?? emptySmartFormulation(), [initial]);
  return (
    <fieldset className="space-y-3 rounded-md border border-zinc-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        SMART-Formulierung
      </legend>
      {SMART_DIMENSION_KEYS.map((key) => (
        <div key={key}>
          <label className="text-xs font-medium text-zinc-600">
            {SMART_DIMENSION_LABELS_DE[key]} ({key === "time_bound" ? "T" : key[0]!.toUpperCase()})
          </label>
          <textarea
            name={`smart_${key}`}
            rows={2}
            defaultValue={values[key]}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder={SMART_DIMENSION_HINTS_DE[key]}
          />
          <p className="mt-1 text-xs text-zinc-500">{SMART_DIMENSION_HINTS_DE[key]}</p>
        </div>
      ))}
    </fieldset>
  );
}
