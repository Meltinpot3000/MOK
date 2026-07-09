"use client";

import { useFormStatus } from "react-dom";
import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";
import {
  allowedLifecycleTransitions,
  lifecycleTransitionLabelDe,
  type LifecycleTransitionTarget,
} from "@/lib/strategy-objects/lifecycle";
import type {
  StrategyObjectIdentityLifecycleState,
  StrategyObjectType,
} from "@/lib/strategy-objects/types";

type StrategyObjectActionBarProps = {
  objectType: StrategyObjectType;
  objectId: string;
  identityId?: string | null;
  lifecycleState?: StrategyObjectIdentityLifecycleState | null;
  baseRevisionId: string;
  hasOpenDraft: boolean;
  canWrite: boolean;
  returnPath: string;
  objectNoun: string;
  deleteAction: (formData: FormData) => Promise<void>;
  deleteIdField: string;
  lifecycleAction: (formData: FormData) => Promise<void>;
  proposeAction: (formData: FormData) => Promise<void>;
};

const TARGET_BUTTON_CLASS: Record<LifecycleTransitionTarget, string> = {
  active:
    "rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50",
  inactive:
    "rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50",
  retired:
    "rounded-md border border-zinc-400 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50",
};

const LIFECYCLE_CONFIRM: Partial<
  Record<
    LifecycleTransitionTarget,
    { title: (noun: string) => string; description: (noun: string) => string; confirmLabel: string }
  >
> = {
  inactive: {
    title: (noun) => `${noun} inaktivieren?`,
    description: (noun) =>
      `Das ${noun} wird im Portfolio als inaktiv geführt. Sie können es später wieder reaktivieren oder endgültig stilllegen.`,
    confirmLabel: "Inaktivieren",
  },
  retired: {
    title: (noun) => `${noun} stilllegen?`,
    description: (noun) =>
      `Das ${noun} wird endgültig stillgelegt. Eine Reaktivierung ist danach nicht mehr möglich.`,
    confirmLabel: "Stilllegen",
  },
};

function SubmitButton({
  children,
  className,
  disabled,
  pendingLabel,
  title,
}: {
  children: React.ReactNode;
  className: string;
  disabled?: boolean;
  pendingLabel?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      title={title}
      className={`${className} disabled:cursor-not-allowed`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function StrategyObjectActionBar({
  objectType,
  objectId,
  identityId,
  lifecycleState,
  baseRevisionId,
  hasOpenDraft,
  canWrite,
  returnPath,
  objectNoun,
  deleteAction,
  deleteIdField,
  lifecycleAction,
  proposeAction,
}: StrategyObjectActionBarProps) {
  if (hasOpenDraft) {
    return (
      <div className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs text-sky-900">
        Offener Revisionsentwurf — unten bearbeiten und mit «Revision übernehmen» aktivieren.
      </div>
    );
  }

  const isDraft = lifecycleState === "draft";
  const transitions = allowedLifecycleTransitions(lifecycleState).filter(
    (target) => !(isDraft && target === "active") // Aktivieren wird bei Entwürfen separat gezeigt
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2.5">
      {isDraft ? (
        <>
          {identityId ? (
            <form action={lifecycleAction} className="inline">
              <input type="hidden" name="identity_id" value={identityId} />
              <input type="hidden" name="target" value="active" />
              <input type="hidden" name="return_path" value={returnPath} />
              <SubmitButton
                className={TARGET_BUTTON_CLASS.active}
                disabled={!canWrite}
                pendingLabel="Wird aktiviert…"
                title={`${objectNoun} freigeben und aktiv schalten`}
              >
                Aktivieren
              </SubmitButton>
            </form>
          ) : null}
          <ConfirmBeforeSubmitForm
            action={deleteAction}
            className="inline"
            title={`${objectNoun} löschen?`}
            description="Nur Entwürfe können gelöscht werden. Diese Aktion kann nicht rückgängig gemacht werden."
            confirmLabel="Löschen"
          >
            <input type="hidden" name={deleteIdField} value={objectId} />
            <button
              type="submit"
              disabled={!canWrite}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Löschen
            </button>
          </ConfirmBeforeSubmitForm>
        </>
      ) : (
        <>
          {lifecycleState !== "retired" ? (
            <form action={proposeAction} className="inline">
              <input type="hidden" name="base_revision_id" value={baseRevisionId} />
              <input type="hidden" name="return_path" value={returnPath} />
              <SubmitButton
                className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                disabled={!canWrite}
                pendingLabel="Revision wird erstellt…"
                title="Neue Revision für Definitionsänderungen anlegen"
              >
                Neue Revision
              </SubmitButton>
            </form>
          ) : (
            <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-500">
              Stillgelegt — keine Änderungen mehr möglich.
            </span>
          )}

          {identityId
            ? transitions.map((target) => {
                const label = lifecycleTransitionLabelDe(lifecycleState, target);
                const confirm = LIFECYCLE_CONFIRM[target];
                const fields = (
                  <>
                    <input type="hidden" name="identity_id" value={identityId} />
                    <input type="hidden" name="target" value={target} />
                    <input type="hidden" name="return_path" value={returnPath} />
                    <SubmitButton className={TARGET_BUTTON_CLASS[target]} disabled={!canWrite}>
                      {label}
                    </SubmitButton>
                  </>
                );

                if (confirm) {
                  return (
                    <ConfirmBeforeSubmitForm
                      key={target}
                      action={lifecycleAction}
                      className="inline"
                      title={confirm.title(objectNoun)}
                      description={confirm.description(objectNoun)}
                      confirmLabel={confirm.confirmLabel}
                    >
                      {fields}
                    </ConfirmBeforeSubmitForm>
                  );
                }

                return (
                  <form key={target} action={lifecycleAction} className="inline">
                    {fields}
                  </form>
                );
              })
            : null}
        </>
      )}
    </div>
  );
}
