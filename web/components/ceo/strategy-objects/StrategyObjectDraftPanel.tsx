"use client";

import type { StrategyObjectRevisionRow } from "@/lib/strategy-objects/types";
import type { StrategyObjectType } from "@/lib/strategy-objects/types";

const FORM_INPUT =
  "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 shadow-sm";
const FORM_LABEL = "block text-xs font-medium text-zinc-700";

type StrategyObjectDraftPanelProps = {
  draft: StrategyObjectRevisionRow;
  returnPath: string;
  canWrite: boolean;
  draftFormId: string;
  actions: {
    updateStrategyObjectDraft: (formData: FormData) => Promise<void>;
    promoteStrategyObjectRevision: (formData: FormData) => Promise<void>;
    rejectStrategyObjectRevision: (formData: FormData) => Promise<void>;
  };
  /** Wenn true, werden Speichern/Übernehmen im StrategyObjectRevisionFooter gerendert. */
  externalActions?: boolean;
};

function readPayloadNumber(payload: Record<string, unknown>, key: string, fallback: number): number {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function readPayloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function revisionStateLabel(state: string): string {
  if (state === "draft") return "Entwurf";
  if (state === "pending_approval") return "Freigabe ausstehend";
  return state;
}

function DraftFields({
  objectType,
  payload,
}: {
  objectType: StrategyObjectType;
  payload: Record<string, unknown>;
}) {
  if (objectType === "strategic_objective") {
    return (
      <>
        <label className={FORM_LABEL}>
          Zeithorizont
          <input
            name="time_horizon"
            defaultValue={readPayloadString(payload, "time_horizon")}
            className={FORM_INPUT}
          />
        </label>
        <label className={FORM_LABEL}>
          Wichtigkeit (1–5)
          <input
            name="importance_score"
            type="number"
            min={1}
            max={5}
            defaultValue={readPayloadNumber(payload, "importance_score", 3)}
            className={FORM_INPUT}
          />
        </label>
      </>
    );
  }

  if (objectType === "strategic_challenge") {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["impact_score", "Auswirkung"],
            ["urgency_score", "Dringlichkeit"],
            ["scope_score", "Scope"],
            ["root_cause_score", "Ursache"],
          ] as const
        ).map(([name, label]) => (
          <label key={name} className={FORM_LABEL}>
            {label}
            <input
              name={name}
              type="number"
              min={1}
              max={5}
              defaultValue={readPayloadNumber(payload, name, 3)}
              className={FORM_INPUT}
            />
          </label>
        ))}
        <input type="hidden" name="challenge_score" value={readPayloadNumber(payload, "challenge_score", 3)} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <label className={FORM_LABEL}>
        Priorität
        <input
          name="priority"
          type="number"
          min={1}
          max={5}
          defaultValue={readPayloadNumber(payload, "priority", 3)}
          className={FORM_INPUT}
        />
      </label>
      <label className={FORM_LABEL}>
        Gruppierung
        <input name="grouping" defaultValue={readPayloadString(payload, "grouping")} className={FORM_INPUT} />
      </label>
      <label className={FORM_LABEL}>
        Strategischer Wert
        <input
          name="strategic_value_score"
          type="number"
          min={1}
          max={5}
          defaultValue={readPayloadNumber(payload, "strategic_value_score", 3)}
          className={FORM_INPUT}
        />
      </label>
      <label className={FORM_LABEL}>
        Capability Fit
        <input
          name="capability_fit_score"
          type="number"
          min={1}
          max={5}
          defaultValue={readPayloadNumber(payload, "capability_fit_score", 3)}
          className={FORM_INPUT}
        />
      </label>
      <label className={FORM_LABEL}>
        Machbarkeit
        <input
          name="feasibility_score"
          type="number"
          min={1}
          max={5}
          defaultValue={readPayloadNumber(payload, "feasibility_score", 3)}
          className={FORM_INPUT}
        />
      </label>
      <label className={FORM_LABEL}>
        Risiko
        <input
          name="risk_score"
          type="number"
          min={1}
          max={5}
          defaultValue={readPayloadNumber(payload, "risk_level", 3)}
          className={FORM_INPUT}
        />
      </label>
    </div>
  );
}

export function StrategyObjectDraftPanel({
  draft,
  returnPath,
  canWrite,
  draftFormId,
  actions,
  externalActions = false,
}: StrategyObjectDraftPanelProps) {
  const payload = draft.definition_payload;

  return (
    <article id="strategy-object-draft-panel" className="brand-card mb-4 border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-sky-950">Revisionsentwurf bearbeiten</h3>
          <p className="mt-1 text-xs text-sky-900/80">
            Revision {draft.revision_number} · {revisionStateLabel(draft.revision_state)} · Entwurf-ID{" "}
            {draft.id.slice(0, 8)}…
          </p>
          <p className="mt-1 text-xs text-sky-900/70">
            Die Tabelle zeigt weiterhin die aktive Fassung, bis Sie die Revision übernehmen.
          </p>
        </div>
        <form action={actions.rejectStrategyObjectRevision}>
          <input type="hidden" name="revision_id" value={draft.id} />
          <input type="hidden" name="return_path" value={returnPath} />
          <button
            type="submit"
            disabled={!canWrite}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
          >
            Entwurf verwerfen
          </button>
        </form>
      </div>

      <form
        id={draftFormId}
        action={actions.updateStrategyObjectDraft}
        className="mt-4 space-y-3"
      >
        <input type="hidden" name="revision_id" value={draft.id} />
        <input type="hidden" name="object_type" value={draft.object_type} />
        <input type="hidden" name="return_path" value={returnPath} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className={FORM_LABEL}>
            Titel
            <input name="title" defaultValue={draft.title} required className={FORM_INPUT} />
          </label>
          <label className={`${FORM_LABEL} md:col-span-2`}>
            Beschreibung
            <textarea
              name="description"
              defaultValue={draft.description ?? ""}
              className={`${FORM_INPUT} min-h-[12.5rem]`}
            />
          </label>
        </div>
        <DraftFields objectType={draft.object_type} payload={payload} />
        {!externalActions ? (
          <>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={!canWrite}
                className="brand-btn rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Entwurf speichern
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-sky-200 pt-3">
              <form action={actions.promoteStrategyObjectRevision}>
                <input type="hidden" name="revision_id" value={draft.id} />
                <input type="hidden" name="return_path" value={returnPath} />
                <button
                  type="submit"
                  disabled={!canWrite}
                  className="rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Revision übernehmen
                </button>
              </form>
              <p className="text-xs text-sky-900/70">
                Macht diese Fassung zur aktiven Revision (ersetzt die bisherige current-Version).
              </p>
            </div>
          </>
        ) : null}
      </form>
    </article>
  );
}
