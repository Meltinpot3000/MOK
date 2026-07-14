"use client";

import { applyDesignFieldGroupingSuggestion } from "@/app/(ceo)/strategy-cycle/design-field-suggestion-actions";
import { SentinelStatusBanner } from "@/components/ceo/SentinelStatusBanner";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  SuggestedDesignFieldCard,
  type EditableDesignFieldSuggestion,
} from "./SuggestedDesignFieldCard";
import type { DirectionGroupingPreview } from "./design-fields-types";

type ApplyPreviewRow = {
  directionId: string;
  title: string;
  currentGrouping: string | null;
  newGrouping: string;
  hasExistingGrouping: boolean;
};

function buildPreviewRows(
  suggestions: EditableDesignFieldSuggestion[],
  directions: DirectionGroupingPreview[]
): ApplyPreviewRow[] {
  const byId = new Map(directions.map((d) => [d.directionId, d] as const));
  const rows: ApplyPreviewRow[] = [];
  for (const suggestion of suggestions) {
    const label = suggestion.label.trim();
    if (!label) continue;
    for (const directionId of suggestion.directionIds) {
      const dir = byId.get(directionId);
      const currentGrouping = dir?.currentGrouping?.trim() ? dir.currentGrouping.trim() : null;
      rows.push({
        directionId,
        title: dir?.title ?? directionId,
        currentGrouping,
        newGrouping: label,
        hasExistingGrouping: Boolean(currentGrouping),
      });
    }
  }
  return rows;
}

function ApplyDesignFieldConfirmDialog({
  rows,
  overwriteExisting,
  onOverwriteChange,
  onCancel,
  onConfirm,
  pending,
  error,
}: {
  rows: ApplyPreviewRow[];
  overwriteExisting: boolean;
  onOverwriteChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: string | null;
}) {
  const applicableCount = rows.filter((r) => overwriteExisting || !r.hasExistingGrouping).length;
  const hasBlockedRows = rows.some((r) => r.hasExistingGrouping && !overwriteExisting);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-zinc-950/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-design-field-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl"
      >
        <h4 id="apply-design-field-title" className="text-base font-semibold text-zinc-900">
          Gruppierungen übernehmen
        </h4>
        <p className="mt-1 text-sm text-zinc-600">
          Prüfen Sie die Zuordnung vor dem Speichern. Stoßrichtungen mit bestehendem Designfeld
          werden standardmäßig übersprungen.
        </p>

        <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">Stoßrichtung</th>
                <th className="px-3 py-2 font-medium">Aktuelles Designfeld</th>
                <th className="px-3 py-2 font-medium">Neues Designfeld</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.directionId}
                  className={
                    row.hasExistingGrouping
                      ? "border-t border-amber-200 bg-amber-50/60"
                      : "border-t border-zinc-100"
                  }
                >
                  <td className="px-3 py-2 font-medium text-zinc-900">{row.title}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.currentGrouping ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-900">{row.newGrouping}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasBlockedRows ? (
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={overwriteExisting}
              onChange={(e) => onOverwriteChange(e.target.checked)}
            />
            <span>Bestehende Gruppierungen überschreiben</span>
          </label>
        ) : null}

        {error ? (
          <SentinelStatusBanner variant="amber" className="mt-3">
            {error}
          </SentinelStatusBanner>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="brand-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending || applicableCount === 0}
            className="brand-btn px-4 py-2 text-sm disabled:opacity-50"
          >
            {pending ? "Speichern…" : `${applicableCount} Stoßrichtung(en) übernehmen`}
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  suggestions: EditableDesignFieldSuggestion[];
  unassignedDirectionIds: string[];
  warningDe: string | null;
  directions: DirectionGroupingPreview[];
  onSuggestionsChange: (next: EditableDesignFieldSuggestion[]) => void;
  onApplied: () => void;
};

export function SuggestedDesignFieldsEditor({
  suggestions,
  unassignedDirectionIds,
  warningDe,
  directions,
  onSuggestionsChange,
  onApplied,
}: Props) {
  const router = useRouter();
  const [isApplying, startApply] = useTransition();
  const [applyError, setApplyError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const previewRows = buildPreviewRows(suggestions, directions);
  const hasValidSuggestions = suggestions.some((s) => s.label.trim().length > 0);

  function handleConfirmApply() {
    setApplyError(null);
    const toApply = suggestions.filter((s) => s.label.trim().length > 0);
    startApply(async () => {
      for (const suggestion of toApply) {
        const fd = new FormData();
        fd.set("suggestion_label", suggestion.label.trim());
        fd.set("direction_ids", JSON.stringify(suggestion.directionIds));
        fd.set("overwrite_existing", overwriteExisting ? "true" : "false");
        const result = await applyDesignFieldGroupingSuggestion(fd);
        if (!result.ok) {
          setApplyError(result.error);
          return;
        }
      }
      setConfirmOpen(false);
      setOverwriteExisting(false);
      onApplied();
      router.refresh();
    });
  }

  if (suggestions.length === 0) return null;

  return (
    <section className="mt-6 border-t border-zinc-200 pt-6">
      <div>
        <h4 className="text-sm font-semibold text-zinc-900">Sentinel✨ Designfeld-Vorschläge</h4>
        <p className="mt-1 text-sm text-zinc-600">
          Vorschläge anpassen, dann alle Gruppierungen gemeinsam übernehmen. Die Verantwortung für Inhalt und
          Freigabe bleibt bei Ihnen.
        </p>
      </div>

      {isApplying ? (
        <SentinelStatusBanner variant="sky" role="status" aria-live="polite" className="mt-3">
          Sentinel✨ übernimmt die Gruppierungen … Die Treemap wird anschließend neu berechnet.
        </SentinelStatusBanner>
      ) : null}

      {warningDe ? (
        <SentinelStatusBanner variant="amber" className="mt-3">
          {warningDe}
        </SentinelStatusBanner>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {suggestions.map((suggestion) => (
          <SuggestedDesignFieldCard
            key={suggestion.clientId}
            suggestion={suggestion}
            disabled={isApplying}
            onChange={(next) =>
              onSuggestionsChange(
                suggestions.map((s) => (s.clientId === next.clientId ? next : s))
              )
            }
          />
        ))}
      </div>

      {unassignedDirectionIds.length > 0 ? (
        <p className="mt-4 text-xs text-zinc-600">
          Nicht zugeordnet:{" "}
          {unassignedDirectionIds
            .map((id) => directions.find((d) => d.directionId === id)?.title ?? id)
            .join(", ")}
        </p>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          disabled={isApplying || !hasValidSuggestions}
          onClick={() => {
            setApplyError(null);
            setOverwriteExisting(false);
            setConfirmOpen(true);
          }}
          className="brand-btn px-4 py-2 text-sm disabled:opacity-50"
        >
          Gruppierungen übernehmen
        </button>
      </div>

      {confirmOpen ? (
        <ApplyDesignFieldConfirmDialog
          rows={previewRows}
          overwriteExisting={overwriteExisting}
          onOverwriteChange={setOverwriteExisting}
          onCancel={() => {
            if (!isApplying) {
              setConfirmOpen(false);
              setOverwriteExisting(false);
              setApplyError(null);
            }
          }}
          onConfirm={handleConfirmApply}
          pending={isApplying}
          error={applyError}
        />
      ) : null}
    </section>
  );
}
