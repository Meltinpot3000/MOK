"use client";

import { useState } from "react";
import { createReviewMeasureFromContext } from "@/app/(ceo)/reviews/actions";
import type { ReviewCycleData } from "@/lib/review/review-cycle-data";

type ReviewMeasureDialogProps = {
  open: boolean;
  context: {
    directionId: string;
    initiativeId?: string;
    programId?: string;
    annualTargetId?: string;
    signalType?: string;
  };
  cycleData: ReviewCycleData;
  cycleInstanceId: string;
  onClose: () => void;
};

export function ReviewMeasureDialog({
  open,
  context,
  cycleData,
  cycleInstanceId,
  onClose,
}: ReviewMeasureDialogProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const directionPrograms = cycleData.programs.filter(
    (p) => p.strategic_direction_id === context.directionId
  );
  const defaultProgramId = context.programId ?? directionPrograms[0]?.id ?? "";
  const annualTargets = cycleData.annualTargetsByDirectionId[context.directionId] ?? [];
  const defaultTargetId = context.annualTargetId ?? annualTargets[0]?.id ?? "";

  async function onSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    formData.set("cycle_instance_id", cycleInstanceId);
    formData.set("origin_strategic_direction_id", context.directionId);
    if (context.signalType) {
      formData.set("origin_review_signal_type", context.signalType);
    }
    if (context.initiativeId) {
      formData.set("origin_source_object_type", "initiative");
      formData.set("origin_source_object_id", context.initiativeId);
    } else {
      formData.set("origin_source_object_type", "strategic_direction");
      formData.set("origin_source_object_id", context.directionId);
    }
    const res = await createReviewMeasureFromContext(formData);
    setPending(false);
    if ("error" in res && res.error) {
      setMessage(res.error);
      return;
    }
    setMessage("Maßnahme angelegt.");
    setTimeout(onClose, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="brand-card w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-zinc-900">Maßnahme anlegen</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Erstellt eine Initiative mit Review-Herkunft im Umsetzungsnetzwerk.
        </p>
        <form action={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-600" htmlFor="measure-title">
              Titel
            </label>
            <input
              id="measure-title"
              name="title"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-600" htmlFor="measure-program">
              Programm (primärer Pfad)
            </label>
            <select
              id="measure-program"
              name="program_id"
              defaultValue={defaultProgramId}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              {directionPrograms.length === 0 ? (
                <option value="">Kein Programm — bitte im Strategiezyklus anlegen</option>
              ) : (
                directionPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))
              )}
            </select>
          </div>
          {annualTargets.length > 0 ? (
            <div>
              <label className="text-xs text-zinc-600" htmlFor="measure-target">
                Jahresziel (optional)
              </label>
              <select
                id="measure-target"
                name="annual_target_id"
                defaultValue={defaultTargetId}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                {annualTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="text-xs text-zinc-600" htmlFor="measure-note">
              Review-Notiz
            </label>
            <textarea
              id="measure-note"
              name="origin_review_note"
              rows={2}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={pending || directionPrograms.length === 0}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {pending ? "Speichern…" : "Anlegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
