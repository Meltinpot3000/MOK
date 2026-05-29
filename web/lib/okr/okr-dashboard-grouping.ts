import {
  worstReviewStatus,
  type OkrObjectiveView,
  type ReviewStatus,
} from "@/lib/okr/okr-cycle-view-model";

export type OkrDashboardGroupMode = "none" | "direction" | "owner";

export type OkrDashboardGroupSummary = {
  key: string;
  label: string;
  objectives: OkrObjectiveView[];
  objectiveCount: number;
  keyResultCount: number;
  avgProgressPercent: number;
  rollupStatus: ReviewStatus;
  statusCounts: Record<ReviewStatus, number>;
  warningCount: number;
};

function groupKeyLabel(
  ov: OkrObjectiveView,
  mode: Exclude<OkrDashboardGroupMode, "none">
): { key: string; label: string } {
  if (mode === "direction") {
    return {
      key: ov.objective.leadingStrategicDirectionId ?? "__no_direction__",
      label: ov.objective.leadingStrategicDirectionTitle ?? "Ohne Stoßrichtung",
    };
  }
  return {
    key: ov.objective.ownerMembershipId ?? "__unassigned__",
    label: ov.objective.ownerDisplayName ?? "Nicht zugewiesen",
  };
}

export function summarizeOkrObjectiveGroup(objectives: OkrObjectiveView[]): Omit<
  OkrDashboardGroupSummary,
  "key" | "label" | "objectives"
> {
  const objectiveCount = objectives.length;
  const keyResultCount = objectives.reduce((sum, ov) => sum + ov.keyResults.length, 0);
  const avgProgressPercent =
    objectiveCount > 0
      ? objectives.reduce((sum, ov) => sum + ov.rollupProgressPercent, 0) / objectiveCount
      : 0;
  const rollupStatus = worstReviewStatus(objectives.map((ov) => ov.rollupStatus));
  const statusCounts: Record<ReviewStatus, number> = {
    on_track: 0,
    at_risk: 0,
    off_track: 0,
  };
  for (const ov of objectives) {
    statusCounts[ov.rollupStatus] += 1;
  }
  const warningCount = objectives.reduce((sum, ov) => sum + ov.warnings.length, 0);
  return {
    objectiveCount,
    keyResultCount,
    avgProgressPercent,
    rollupStatus,
    statusCounts,
    warningCount,
  };
}

export function buildOkrDashboardGroups(
  objectiveViews: OkrObjectiveView[],
  mode: OkrDashboardGroupMode
): OkrDashboardGroupSummary[] | null {
  if (mode === "none") return null;

  const buckets = new Map<string, { label: string; objectives: OkrObjectiveView[] }>();
  for (const ov of objectiveViews) {
    const { key, label } = groupKeyLabel(ov, mode);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.objectives.push(ov);
    } else {
      buckets.set(key, { label, objectives: [ov] });
    }
  }

  return [...buckets.entries()]
    .map(([key, { label, objectives }]) => ({
      key,
      label,
      objectives: [...objectives].sort((a, b) => a.objective.title.localeCompare(b.objective.title, "de")),
      ...summarizeOkrObjectiveGroup(objectives),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}
