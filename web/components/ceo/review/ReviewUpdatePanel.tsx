"use client";

import { useMemo, useState } from "react";
import { applyInitiativeReviewUpdate } from "@/app/(ceo)/reviews/actions";
import { ALLOWED_INITIATIVE_WEIGHTS } from "@/lib/review/initiative-review-fields";
import { deriveInitiativeHealth } from "@/lib/review/initiative-health";
import type { ReviewCycleInitiativeInput } from "@/lib/review/review-cycle-view-model";
import { healthBadgeClass, healthLabelDe, initiativeStatusLabelDe } from "./review-ui";

type ReviewUpdatePanelProps = {
  initiative: ReviewCycleInitiativeInput;
  canWrite: boolean;
  ownerSelectOptions: Array<{ id: string; label: string }>;
};

function ownerOptionsForInitiative(
  initiative: ReviewCycleInitiativeInput,
  base: Array<{ id: string; label: string }>
): Array<{ id: string; label: string }> {
  const oid = initiative.owner_membership_id;
  if (!oid || base.some((o) => o.id === oid)) return base;
  return [
    ...base,
    { id: oid, label: initiative.owner_display_name ?? "Zugewiesener Owner" },
  ];
}

export function ReviewUpdatePanel({
  initiative,
  canWrite,
  ownerSelectOptions,
}: ReviewUpdatePanelProps) {
  const [weightOpen, setWeightOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(initiative.progress_percent);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const derived = deriveInitiativeHealth(initiative);
  const ownerOptions = useMemo(
    () => ownerOptionsForInitiative(initiative, ownerSelectOptions),
    [initiative, ownerSelectOptions]
  );

  async function onSubmit(formData: FormData) {
    setMessage(null);
    formData.set("initiative_id", initiative.id);
    formData.set("progress_percent", String(progressPercent));
    if (!weightOpen) {
      formData.set("weight", String(initiative.weight));
    }
    const res = await applyInitiativeReviewUpdate(formData);
    if (res.error) {
      setMessage({ type: "err", text: res.error });
    } else {
      setMessage({ type: "ok", text: "Gespeichert." });
    }
  }

  return (
    <div className="brand-surface space-y-4 rounded-md border border-zinc-200 p-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${healthBadgeClass(derived)}`}
        >
          {healthLabelDe(derived)}
        </span>
      </div>

      {message ? (
        <p
          className={`text-sm ${message.type === "err" ? "text-red-700" : "text-emerald-700"}`}
        >
          {message.text}
        </p>
      ) : null}

      <form action={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600" htmlFor={`prog-${initiative.id}`}>
            Umsetzungsfortschritt (%)
          </label>
          <p className="mb-1 text-xs text-zinc-500">
            Regulaer pflegen — rollt in den Stossrichtungsfortschritt ein.
          </p>
          <input
            id={`prog-${initiative.id}`}
            type="range"
            min={0}
            max={100}
            value={progressPercent}
            onChange={(e) => setProgressPercent(Number(e.target.value))}
            disabled={!canWrite}
            className="mt-1 w-full accent-zinc-900 disabled:opacity-50"
          />
          <p className="mt-1 text-sm font-semibold text-zinc-800">{progressPercent}%</p>
        </div>

        <div className="rounded-md border border-dashed border-zinc-200 p-3">
          <button
            type="button"
            onClick={() => setWeightOpen((o) => !o)}
            className="text-left text-sm font-medium text-zinc-800"
          >
            Gewichtung {weightOpen ? "ausblenden" : "anzeigen"} (selten aendern)
          </button>
          {weightOpen ? (
            <div className="mt-2">
              <label className="text-xs text-zinc-600" htmlFor={`w-${initiative.id}`}>
                Relative Bedeutung innerhalb der Stossrichtung
              </label>
              <select
                id={`w-${initiative.id}`}
                name="weight"
                defaultValue={initiative.weight}
                disabled={!canWrite}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              >
                {ALLOWED_INITIATIVE_WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="weight" value={initiative.weight} />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor={`own-${initiative.id}`}>
            Owner
          </label>
          <p className="mb-1 text-xs text-zinc-500">
            Aktives Organisationsmitglied; Anzeige: Name und zugewiesene Rollen im Tenant.
          </p>
          <select
            id={`own-${initiative.id}`}
            name="owner_membership_id"
            defaultValue={initiative.owner_membership_id ?? ""}
            disabled={!canWrite}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Kein Owner</option>
            {ownerOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor={`st-${initiative.id}`}>
              Status
            </label>
            <select
              id={`st-${initiative.id}`}
              name="status"
              defaultValue={initiative.status}
              disabled={!canWrite}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              {(["draft", "planned", "active", "at_risk", "on_hold", "completed", "archived"] as const).map(
                (s) => (
                  <option key={s} value={s}>
                    {initiativeStatusLabelDe(s)}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor={`ov-${initiative.id}`}>
              Ampel-Override
            </label>
            <select
              id={`ov-${initiative.id}`}
              name="execution_health_override"
              defaultValue={initiative.execution_health_override ?? "none"}
              disabled={!canWrite}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="none">Abgeleitet (kein Override)</option>
              <option value="on_track">Auf Kurs</option>
              <option value="at_risk">Auffällig</option>
              <option value="off_track">Kritisch</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor={`ed-${initiative.id}`}>
            Fälligkeit (Enddatum)
          </label>
          <input
            id={`ed-${initiative.id}`}
            name="end_date"
            type="date"
            defaultValue={initiative.end_date ? initiative.end_date.slice(0, 10) : ""}
            disabled={!canWrite}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor={`rc-${initiative.id}`}>
            Review-Kommentar
          </label>
          <textarea
            id={`rc-${initiative.id}`}
            name="review_comment"
            rows={2}
            defaultValue={initiative.review_comment ?? ""}
            disabled={!canWrite}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>

        <button type="submit" disabled={!canWrite} className="brand-btn w-full px-4 py-2 text-sm sm:w-auto">
          Review speichern
        </button>
      </form>
    </div>
  );
}
