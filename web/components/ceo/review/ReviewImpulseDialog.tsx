"use client";

import Link from "next/link";
import { useState } from "react";
import { createReviewImpulseFromContext } from "@/app/(ceo)/reviews/actions";

type ReviewImpulseDialogProps = {
  open: boolean;
  context: {
    directionId: string;
    objectType: string;
    objectId: string;
  };
  cycleInstanceId: string;
  onClose: () => void;
};

const FEEDBACK_OPTIONS = [
  { value: "revisit_direction", label: "Stoßrichtung überarbeiten" },
  { value: "revisit_objective", label: "Ziel überarbeiten" },
  { value: "adjust", label: "Anpassung empfehlen" },
  { value: "escalate", label: "Eskalieren" },
  { value: "stop", label: "Stoppen" },
] as const;

export function ReviewImpulseDialog({
  open,
  context,
  cycleInstanceId,
  onClose,
}: ReviewImpulseDialogProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [strategyHref, setStrategyHref] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function onSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    formData.set("cycle_instance_id", cycleInstanceId);
    formData.set("object_type", context.objectType);
    formData.set("object_id", context.objectId);
    const res = await createReviewImpulseFromContext(formData);
    setPending(false);
    if ("error" in res && res.error) {
      setMessage(res.error);
      return;
    }
    if ("strategyHref" in res && res.strategyHref) {
      setStrategyHref(res.strategyHref);
    }
    setMessage("Strategie-Impuls gespeichert.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="brand-card w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-zinc-900">Strategie-Impuls anlegen</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Sekundäre Aktion: Rückspiegelung ins strategische Design, wenn aus der Reviewlage ein
          Strukturproblem erkennbar ist.
        </p>
        <form action={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-600" htmlFor="impulse-type">
              Impuls-Typ
            </label>
            <select
              id="impulse-type"
              name="feedback_type"
              defaultValue="revisit_direction"
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              {FEEDBACK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-600" htmlFor="impulse-comment">
              Begründung
            </label>
            <textarea
              id="impulse-comment"
              name="comment"
              rows={3}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
          {strategyHref ? (
            <Link href={strategyHref} className="text-sm underline">
              Im Strategiezyklus weiterbearbeiten
            </Link>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm">
              {strategyHref ? "Schließen" : "Abbrechen"}
            </button>
            {!strategyHref ? (
              <button
                type="submit"
                disabled={pending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {pending ? "Speichern…" : "Impuls speichern"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
