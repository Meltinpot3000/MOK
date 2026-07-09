"use client";

import { useFormStatus } from "react-dom";

function ProposeDraftSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Revision wird erstellt…" : "Neue Revision"}
    </button>
  );
}

type StrategyObjectProposeDraftFormProps = {
  baseRevisionId: string;
  returnPath: string;
  proposeAction: (formData: FormData) => Promise<void>;
};

export function StrategyObjectProposeDraftForm({
  baseRevisionId,
  returnPath,
  proposeAction,
}: StrategyObjectProposeDraftFormProps) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
      <p className="text-xs font-medium text-amber-900">
        Diese aktuelle Revision ist schreibgeschützt. Für Definitionsänderungen legen Sie eine
        neue Revision an.
      </p>
      <form action={proposeAction} className="mt-2">
        <input type="hidden" name="base_revision_id" value={baseRevisionId} />
        <input type="hidden" name="return_path" value={returnPath} />
        <ProposeDraftSubmitButton />
      </form>
    </div>
  );
}
