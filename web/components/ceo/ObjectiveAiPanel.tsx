"use client";

type ObjectiveAiPanelProps = {
  objective: {
    id: string;
    title: string;
    ai_objective_score?: number | null;
    ai_clarity_score?: number | null;
    ai_strategic_relevance_score?: number | null;
    ai_feasibility_score?: number | null;
    ai_fit_to_company_score?: number | null;
    ai_external_internal_classification?: string | null;
    ai_short_long_term_classification?: string | null;
    ai_exploit_explore_classification?: string | null;
    ai_issues_json?: unknown;
    ai_improvement_suggestion?: string | null;
    ai_evaluation_status?: string | null;
    ai_evaluated_at?: string | null;
    ai_manual_override?: boolean | null;
  };
};

function getStatusBadge(status: string | null | undefined): string {
  if (status === "valid") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "outdated") return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "failed") return "border-red-300 bg-red-50 text-red-800";
  return "border-zinc-300 bg-zinc-100 text-zinc-700";
}

function getStatusLabel(status: string | null | undefined): string {
  if (status === "valid") return "Aktuell";
  if (status === "outdated") return "Veraltet";
  if (status === "failed") return "Fehlgeschlagen";
  return "Nicht ausgef\u00FChrt";
}

function deExternalInternal(value: string): string {
  const v = value.toLowerCase();
  if (v === "internal") return "Intern";
  if (v === "external") return "Extern";
  if (v === "balanced") return "Ausgewogen";
  return value;
}

function deShortMidLong(value: string): string {
  const v = value.toLowerCase();
  if (v === "short") return "Kurzfristig";
  if (v === "mid") return "Mittelfristig";
  if (v === "long") return "Langfristig";
  return value;
}

function deExploitExplore(value: string): string {
  const v = value.toLowerCase();
  if (v === "exploit") return "Exploit";
  if (v === "explore") return "Explore";
  if (v === "balanced") return "Ausgewogen";
  return value;
}

export function ObjectiveAiPanel({ objective }: ObjectiveAiPanelProps) {
  const status = objective.ai_evaluation_status ?? "not_run";
  const issues = Array.isArray(objective.ai_issues_json)
    ? (objective.ai_issues_json as string[])
    : [];

  if (status === "not_run") {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Sentinel✨-Bewertung
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          Noch nicht ausgeführt. Die Bewertung erscheint hier nach dem nächsten Sentinel-Lauf.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 border-l-4 border-l-amber-400 bg-zinc-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Sentinel✨-Bewertung
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Nur zur Information — nicht direkt bearbeitbar.</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadge(status)}`}
        >
          {getStatusLabel(status)}
        </span>
      </div>
      {objective.ai_objective_score != null && (
        <div>
          <p className="text-xs text-zinc-600">Sentinel✨ Score</p>
          <p className="text-2xl font-semibold text-zinc-900">{(objective.ai_objective_score as number).toFixed(1)}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {objective.ai_clarity_score != null && (
          <div className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
            <span className="block text-[11px] text-zinc-500">Klarheit</span>
            <span className="font-medium text-zinc-900">{objective.ai_clarity_score}</span>
          </div>
        )}
        {objective.ai_strategic_relevance_score != null && (
          <div className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
            <span className="block text-[11px] text-zinc-500">Strategische Relevanz</span>
            <span className="font-medium text-zinc-900">{objective.ai_strategic_relevance_score}</span>
          </div>
        )}
        {objective.ai_feasibility_score != null && (
          <div className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
            <span className="block text-[11px] text-zinc-500">Machbarkeit</span>
            <span className="font-medium text-zinc-900">{objective.ai_feasibility_score}</span>
          </div>
        )}
        {objective.ai_fit_to_company_score != null && (
          <div className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
            <span className="block text-[11px] text-zinc-500">Passung Unternehmen</span>
            <span className="font-medium text-zinc-900">{objective.ai_fit_to_company_score}</span>
          </div>
        )}
      </div>
      {((objective.ai_external_internal_classification ?? objective.ai_short_long_term_classification ?? objective.ai_exploit_explore_classification)) && (
        <div className="flex flex-wrap gap-1">
          {objective.ai_external_internal_classification && (
            <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-800">
              {deExternalInternal(objective.ai_external_internal_classification)}
            </span>
          )}
          {objective.ai_short_long_term_classification && (
            <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-800">
              {deShortMidLong(objective.ai_short_long_term_classification)}
            </span>
          )}
          {objective.ai_exploit_explore_classification && (
            <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-800">
              {deExploitExplore(objective.ai_exploit_explore_classification)}
            </span>
          )}
        </div>
      )}
      {issues.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-medium text-amber-900">Hinweise</p>
          <ul className="mt-1 list-inside list-disc text-sm text-amber-950">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {objective.ai_improvement_suggestion && (
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <p className="text-xs font-medium text-zinc-600">Verbesserungsvorschlag</p>
          <p className="mt-1 text-sm text-zinc-700">{objective.ai_improvement_suggestion}</p>
        </div>
      )}
      {objective.ai_evaluated_at && (
        <p className="text-xs text-zinc-500">
          Bewertet am: {new Date(objective.ai_evaluated_at).toLocaleString("de-CH")}
        </p>
      )}
    </div>
  );
}
