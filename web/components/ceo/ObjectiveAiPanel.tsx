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
  return "Nicht ausgefuehrt";
}

export function ObjectiveAiPanel({ objective }: ObjectiveAiPanelProps) {
  const status = objective.ai_evaluation_status ?? "not_run";
  const issues = Array.isArray(objective.ai_issues_json)
    ? (objective.ai_issues_json as string[])
    : [];

  if (status === "not_run") {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        KI-Bewertung noch nicht ausgefuehrt.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          KI-Bewertung
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadge(status)}`}
        >
          {getStatusLabel(status)}
        </span>
      </div>
      {objective.ai_objective_score != null && (
        <div>
          <p className="text-xs text-zinc-600">Objective Score</p>
          <p className="text-2xl font-semibold text-zinc-900">{(objective.ai_objective_score as number).toFixed(1)}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {objective.ai_clarity_score != null && (
          <div>
            <span className="text-zinc-500">Clarity:</span> {objective.ai_clarity_score}
          </div>
        )}
        {objective.ai_strategic_relevance_score != null && (
          <div>
            <span className="text-zinc-500">Strategic Relevance:</span> {objective.ai_strategic_relevance_score}
          </div>
        )}
        {objective.ai_feasibility_score != null && (
          <div>
            <span className="text-zinc-500">Feasibility:</span> {objective.ai_feasibility_score}
          </div>
        )}
        {objective.ai_fit_to_company_score != null && (
          <div>
            <span className="text-zinc-500">Fit to Company:</span> {objective.ai_fit_to_company_score}
          </div>
        )}
      </div>
      {((objective.ai_external_internal_classification ?? objective.ai_short_long_term_classification ?? objective.ai_exploit_explore_classification)) && (
        <div className="flex flex-wrap gap-1">
          {objective.ai_external_internal_classification && (
            <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-800">
              {objective.ai_external_internal_classification}
            </span>
          )}
          {objective.ai_short_long_term_classification && (
            <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-800">
              {objective.ai_short_long_term_classification}
            </span>
          )}
          {objective.ai_exploit_explore_classification && (
            <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-800">
              {objective.ai_exploit_explore_classification}
            </span>
          )}
        </div>
      )}
      {issues.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-600">Issues</p>
          <ul className="mt-1 list-inside list-disc text-sm text-zinc-700">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {objective.ai_improvement_suggestion && (
        <div>
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
