"use client";

import type { StrategyObjectRevisionRow } from "@/lib/strategy-objects/types";
import { StrategyObjectActionBar } from "./StrategyObjectActionBar";
import type { ComponentProps } from "react";

type ActionBarProps = ComponentProps<typeof StrategyObjectActionBar>;

type Props = {
  openDraft: StrategyObjectRevisionRow | null;
  draftFormId: string;
  canWrite: boolean;
  returnPath: string;
  revisionActions?: {
    promoteStrategyObjectRevision: (formData: FormData) => Promise<void>;
  } | null;
  actionBarProps: ActionBarProps | null;
};

export function StrategyObjectRevisionFooter({
  openDraft,
  draftFormId,
  canWrite,
  returnPath,
  revisionActions,
  actionBarProps,
}: Props) {
  if (openDraft && revisionActions) {
    return (
      <div className="border-t border-zinc-100 pt-4">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2.5">
          <button
            type="submit"
            form={draftFormId}
            disabled={!canWrite}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            Entwurf speichern
          </button>
          <form action={revisionActions.promoteStrategyObjectRevision} className="inline">
            <input type="hidden" name="revision_id" value={openDraft.id} />
            <input type="hidden" name="return_path" value={returnPath} />
            <button
              type="submit"
              disabled={!canWrite}
              className="rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Revision übernehmen
            </button>
          </form>
          <p className="text-xs text-zinc-600">
            Zuordnungen und Stammdaten des Entwurfs werden mit «Revision übernehmen» aktiv.
          </p>
        </div>
      </div>
    );
  }

  if (!actionBarProps) return null;

  return (
    <div className="border-t border-zinc-100 pt-4">
      <StrategyObjectActionBar {...actionBarProps} />
    </div>
  );
}
