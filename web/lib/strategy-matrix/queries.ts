import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MatrixChallenge = {
  id: string;
  title: string;
  priority: number;
  visibility: "internal" | "private" | "public";
};

export type MatrixDirection = {
  id: string;
  title: string;
  owner_membership_id: string | null;
  priority: number;
  status: string;
  grouping: string | null;
};

export type MatrixCell = {
  id: string;
  strategic_direction_id: string;
  strategic_challenge_id: string;
  contribution_level: "low" | "medium" | "high";
  note: string | null;
};

export type MatrixAnnualTarget = {
  id: string;
  strategic_direction_id: string;
  title: string;
  baseline: number | null;
  current_measure: number | null;
  progress_percent: number;
  comment: string | null;
  is_primary: boolean;
  updated_at: string;
};

export type MatrixComment = {
  id: string;
  object_type: "direction" | "challenge" | "cell" | "annual_target";
  object_id: string;
  comment_text: string;
  created_at: string;
};

export type MatrixAnalysisSuggestion = {
  id: string;
  analysis_type: string;
  sub_type: string | null;
  title: string;
  description: string | null;
  impact_level: number | null;
};

export async function getMatrixWorkspaceData(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();

  const [
    challengesResult,
    directionsResult,
    cellsResult,
    targetsResult,
    commentsResult,
    columnOrderResult,
    rowOrderResult,
    ownerOptionsResult,
    analysisEntriesResult,
  ] = await Promise.all([
    supabase
      .schema("app")
      .from("strategic_challenges")
      .select("id, title, priority, visibility, created_at")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title, owner_membership_id, priority, status, grouping, created_at")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("challenge_direction_links")
      .select("id, strategic_direction_id, strategic_challenge_id, contribution_level, note")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("annual_targets")
      .select(
        "id, strategic_direction_id, title, baseline, current_measure, progress_percent, comment, is_primary, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("dashboard_comments")
      .select("id, object_type, object_id, comment_text, created_at")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .schema("app")
      .from("dashboard_column_config")
      .select("challenge_id, display_order")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("dashboard_row_config")
      .select("direction_id, display_order")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("responsibles")
      .select("membership_id, full_name")
      .eq("organization_id", organizationId)
      .not("membership_id", "is", null)
      .order("full_name", { ascending: true }),
    supabase
      .schema("app")
      .from("analysis_entries")
      .select("id, analysis_type, sub_type, title, description, impact_level")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("created_at", { ascending: false }),
  ]);

  const columnOrderById = new Map(
    (columnOrderResult.data ?? []).map((row) => [row.challenge_id, row.display_order])
  );
  const rowOrderById = new Map(
    (rowOrderResult.data ?? []).map((row) => [row.direction_id, row.display_order])
  );
  const hasColumnConfig = (columnOrderResult.data ?? []).length > 0;
  const hasRowConfig = (rowOrderResult.data ?? []).length > 0;

  const challengesRows = (challengesResult.data ?? []) as (MatrixChallenge & { created_at: string })[];
  const sortedChallenges = challengesRows
    .sort((a, b) => {
      const oa = columnOrderById.get(a.id);
      const ob = columnOrderById.get(b.id);
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return a.created_at.localeCompare(b.created_at);
    })
    .map((row) => ({
      id: row.id,
      title: row.title,
      priority: row.priority,
      visibility: row.visibility,
    }));
  const displayedChallenges = hasColumnConfig
    ? sortedChallenges.filter((challenge) => columnOrderById.has(challenge.id))
    : sortedChallenges;
  const hiddenChallenges = sortedChallenges.filter(
    (challenge) => !displayedChallenges.some((item) => item.id === challenge.id)
  );

  const directionsRows = (directionsResult.data ?? []) as (MatrixDirection & { created_at: string })[];
  const sortedDirections = directionsRows
    .sort((a, b) => {
      const oa = rowOrderById.get(a.id);
      const ob = rowOrderById.get(b.id);
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return a.created_at.localeCompare(b.created_at);
    })
    .map((row) => ({
      id: row.id,
      title: row.title,
      owner_membership_id: row.owner_membership_id,
      priority: row.priority,
      status: row.status,
      grouping: row.grouping,
    }));
  const displayedDirections = hasRowConfig
    ? sortedDirections.filter((direction) => rowOrderById.has(direction.id))
    : sortedDirections;
  const hiddenDirections = sortedDirections.filter(
    (direction) => !displayedDirections.some((item) => item.id === direction.id)
  );

  return {
    challenges: displayedChallenges,
    hiddenChallenges,
    directions: displayedDirections,
    hiddenDirections,
    cells: (cellsResult.data ?? []) as MatrixCell[],
    annualTargets: (targetsResult.data ?? []) as MatrixAnnualTarget[],
    comments: (commentsResult.data ?? []) as MatrixComment[],
    ownerOptions: (ownerOptionsResult.data ?? []) as { membership_id: string; full_name: string }[],
    analysisSuggestions: (analysisEntriesResult.data ?? []) as MatrixAnalysisSuggestion[],
    hasColumnConfig,
    hasRowConfig,
  };
}
