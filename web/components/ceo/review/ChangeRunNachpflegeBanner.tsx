import { CHANGE_RUN_ISSUE_LABELS_DE, type ChangeRunMigrationIssueRow } from "@/lib/change-run/migration-issues";

type ChangeRunNachpflegeBannerProps = {
  issues: ChangeRunMigrationIssueRow[];
};

export function ChangeRunNachpflegeBanner({ issues }: ChangeRunNachpflegeBannerProps) {
  if (issues.length === 0) return null;

  const grouped = new Map<string, number>();
  for (const issue of issues) {
    grouped.set(issue.issue_code, (grouped.get(issue.issue_code) ?? 0) + 1);
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">Change/Run-Nachpflege erforderlich</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
        {[...grouped.entries()].map(([code, count]) => (
          <li key={code}>
            {CHANGE_RUN_ISSUE_LABELS_DE[code] ?? code} ({count})
          </li>
        ))}
      </ul>
    </div>
  );
}
