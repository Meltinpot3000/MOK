"use client";

type PortfolioEvaluation = {
  balance_score?: number | null;
  portfolio_gaps_json?: unknown;
  portfolio_risks_json?: unknown;
  portfolio_recommendation?: string | null;
  portfolio_evaluated_at?: string | null;
};

type PortfolioSummaryViewProps = {
  portfolio: PortfolioEvaluation | null;
};

function getBalanceColor(score: number): string {
  if (score >= 4) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 3) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export function PortfolioSummaryView({ portfolio }: PortfolioSummaryViewProps) {
  if (!portfolio) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        Portfolio-Bewertung noch nicht verfuegbar. Fuehre die Objectives-Bewertung aus.
      </div>
    );
  }

  const balanceScore = portfolio.balance_score ?? 0;
  const gaps = Array.isArray(portfolio.portfolio_gaps_json) ? (portfolio.portfolio_gaps_json as string[]) : [];
  const risks = Array.isArray(portfolio.portfolio_risks_json) ? (portfolio.portfolio_risks_json as string[]) : [];

  return (
    <div className="space-y-4">
      <div className={`rounded-md border p-4 ${getBalanceColor(balanceScore)}`}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Balance Score</p>
        <p className="mt-1 text-2xl font-bold">{balanceScore}</p>
      </div>
      {gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Gaps</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-700">
            {gaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </div>
      )}
      {risks.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Risiken</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-700">
            {risks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
      {portfolio.portfolio_recommendation && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Empfehlung</p>
          <p className="mt-2 text-sm text-zinc-700">{portfolio.portfolio_recommendation}</p>
        </div>
      )}
      {portfolio.portfolio_evaluated_at && (
        <p className="text-xs text-zinc-500">
          Bewertet am: {new Date(portfolio.portfolio_evaluated_at).toLocaleString("de-CH")}
        </p>
      )}
    </div>
  );
}
