"use client";

import type { DesignFieldSuggestion } from "@/lib/strategy-cycle/design-field-suggestions-validate";

export type EditableDesignFieldSuggestion = DesignFieldSuggestion & {
  clientId: string;
};

function confidenceBadgeClass(tier: DesignFieldSuggestion["confidenceTier"]): string {
  switch (tier) {
    case "high":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "medium":
      return "border-amber-300 bg-amber-50 text-amber-900";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-700";
  }
}

type Props = {
  suggestion: EditableDesignFieldSuggestion;
  disabled?: boolean;
  onChange: (next: EditableDesignFieldSuggestion) => void;
};

export function SuggestedDesignFieldCard({ suggestion, disabled, onChange }: Props) {
  return (
    <article className="rounded-lg border border-dashed border-teal-300/80 bg-teal-50/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-teal-300 bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-900">
              Sentinel✨ Vorschlag
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${confidenceBadgeClass(suggestion.confidenceTier)}`}
              title={`Konfidenz: ${suggestion.confidence}`}
            >
              Konfidenz {suggestion.confidenceLabelDe}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-zinc-800">Designfeld-Name</label>
          <input
            type="text"
            value={suggestion.label}
            disabled={disabled}
            maxLength={80}
            onChange={(e) => onChange({ ...suggestion, label: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-800">Beschreibung</label>
          <textarea
            value={suggestion.description}
            disabled={disabled}
            maxLength={400}
            rows={2}
            onChange={(e) => onChange({ ...suggestion, description: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-800">Strategischer Intent</label>
          <textarea
            value={suggestion.strategicIntent}
            disabled={disabled}
            maxLength={200}
            rows={2}
            onChange={(e) => onChange({ ...suggestion, strategicIntent: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-zinc-800">Stoßrichtungen</p>
        <ul className="mt-1 space-y-2 text-xs text-zinc-700">
          {suggestion.directionIds.map((directionId) => {
            const title =
              suggestion.directionTitles[suggestion.directionIds.indexOf(directionId)] ?? directionId;
            const assignment = suggestion.directionAssignments[directionId];
            return (
              <li key={directionId} className="rounded border border-zinc-200 bg-white/70 px-2 py-1.5">
                <p className="font-medium text-zinc-900">{title}</p>
                {assignment ? (
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    {assignment.source === "auto"
                      ? "Automatisch vorgeschlagen"
                      : assignment.source === "approved"
                        ? "Bestehende Zuordnung"
                        : "Manuell"}
                    {" · "}
                    {assignment.confidence === "high"
                      ? "hoch"
                      : assignment.confidence === "medium"
                        ? "prüfen"
                        : "niedrig"}
                    {assignment.reasons.length > 0 ? (
                      <span className="mt-0.5 block text-zinc-500">
                        {assignment.reasons.slice(0, 3).join(" · ")}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-3 text-xs text-zinc-600">{suggestion.rationaleDe}</p>
    </article>
  );
}

export function toEditableSuggestions(items: DesignFieldSuggestion[]): EditableDesignFieldSuggestion[] {
  return items.map((s, index) => ({
    ...s,
    clientId: `${s.label}-${s.directionIds.join("-")}-${index}`,
  }));
}
