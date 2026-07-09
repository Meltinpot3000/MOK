"use client";

import { useState, useTransition } from "react";
import type { AnnualTargetSmartResponse } from "@/lib/annual-targets/annual-target-smart-ai";
import { ANNUAL_TARGET_DERIVATION_NOTE_LABEL_DE } from "@/lib/annual-targets/types";

const FORM_ID = "annual-target-form";

type Props = {
  directions: { id: string; title: string }[];
  programs: { id: string; title: string }[];
  strategicObjectives: { id: string; title: string }[];
  initialSmartCheckJson?: string;
  initialAiAssisted?: "0" | "1";
  improveAction: (formData: FormData) => Promise<
    | { ok: true; data: AnnualTargetSmartResponse }
    | { ok: false; error: string }
  >;
};

function readFormContext(
  form: HTMLFormElement,
  directions: Props["directions"],
  programs: Props["programs"],
  strategicObjectives: Props["strategicObjectives"]
): FormData {
  const fd = new FormData(form);
  const dirId = (form.elements.namedItem("strategic_direction_id") as HTMLSelectElement)?.value;
  const objId = (form.elements.namedItem("strategic_objective_id") as HTMLSelectElement)?.value;
  const progId = (form.elements.namedItem("strategy_program_id") as HTMLSelectElement)?.value;
  fd.set(
    "direction_title",
    directions.find((d) => d.id === dirId)?.title ?? ""
  );
  fd.set(
    "strategic_objective_title",
    strategicObjectives.find((o) => o.id === objId)?.title ?? ""
  );
  fd.set("program_title", programs.find((p) => p.id === progId)?.title ?? "");
  return fd;
}

function hasMinimumFormContent(form: HTMLFormElement): boolean {
  const title = (form.elements.namedItem("title") as HTMLInputElement)?.value?.trim() ?? "";
  const description =
    (form.elements.namedItem("description") as HTMLTextAreaElement)?.value?.trim() ?? "";
  const measurement =
    (form.elements.namedItem("measurement_logic") as HTMLTextAreaElement)?.value?.trim() ?? "";
  return Boolean(title || description || measurement);
}

export function AnnualTargetSentinelPanel({
  directions,
  programs,
  strategicObjectives,
  initialSmartCheckJson = "",
  initialAiAssisted = "0",
  improveAction,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AnnualTargetSmartResponse | null>(null);

  const runImprove = () => {
    setError(null);
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) {
      setError("Formular nicht gefunden.");
      return;
    }
    if (!hasMinimumFormContent(form)) {
      setError("Bitte zuerst Titel, Beschreibung oder Messlogik erfassen.");
      return;
    }
    const fd = readFormContext(form, directions, programs, strategicObjectives);
    startTransition(async () => {
      const result = await improveAction(fd);
      if (!result.ok) {
        setError(result.error);
        setProposal(null);
        return;
      }
      setProposal(result.data);
    });
  };

  const applyProposal = () => {
    if (!proposal) return;
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) return;
    const setVal = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) el.value = value;
    };
    setVal("title", proposal.title);
    setVal("description", proposal.description);
    setVal("measurement_logic", proposal.measurement_logic);
    setVal("derivation_note", proposal.derivation_note);
    const smartInput = form.querySelector('input[name="smart_check_json"]') as HTMLInputElement | null;
    if (smartInput) smartInput.value = JSON.stringify(proposal.smart_check);
    const aiFlag = form.querySelector('input[name="ai_assisted"]') as HTMLInputElement | null;
    if (aiFlag) aiFlag.value = "1";
  };

  return (
    <section className="mt-4 rounded-md border border-zinc-200 bg-zinc-50/80 p-3">
      <p className="text-xs text-zinc-600">
        Sentinel optimiert die Formulierung im Formular nach SMART (sprachlich und formell). Die
        Verantwortung für Inhalt und Freigabe bleibt bei Ihnen.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={runImprove}
        className="brand-btn-secondary mt-2 px-3 py-1.5 text-sm"
      >
        {pending ? "Sentinel arbeitet…" : "Sentinel-Ausarbeitung"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {proposal ? (
        <div className="mt-3 space-y-2 rounded border border-zinc-200 bg-white p-3 text-xs">
          <p className="font-medium text-zinc-900">Vorschlag</p>
          <p>
            <span className="font-medium">Titel:</span> {proposal.title}
          </p>
          <p>{proposal.description}</p>
          <p>
            <span className="font-medium">Messlogik:</span> {proposal.measurement_logic}
          </p>
          <p>
            <span className="font-medium">{ANNUAL_TARGET_DERIVATION_NOTE_LABEL_DE}:</span>{" "}
            {proposal.derivation_note}
          </p>
          <p className="text-zinc-600">
            SMART:{" "}
            {[
              proposal.smart_check.specific && "S",
              proposal.smart_check.measurable && "M",
              proposal.smart_check.achievable && "A",
              proposal.smart_check.relevant && "R",
              proposal.smart_check.time_bound && "T",
            ]
              .filter(Boolean)
              .join(" · ") || "noch unvollständig"}
          </p>
          {proposal.improvement_notes.length > 0 ? (
            <ul className="list-disc pl-4 text-zinc-600">
              {proposal.improvement_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="brand-btn px-2 py-1 text-xs" onClick={applyProposal}>
              In Formular übernehmen
            </button>
            <button
              type="button"
              className="text-xs text-zinc-600 hover:underline"
              onClick={() => setProposal(null)}
            >
              Verwerfen
            </button>
          </div>
        </div>
      ) : null}
      <input type="hidden" name="ai_assisted" defaultValue={initialAiAssisted} form={FORM_ID} />
      <input
        type="hidden"
        name="smart_check_json"
        defaultValue={initialSmartCheckJson}
        form={FORM_ID}
      />
    </section>
  );
}
