import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

export type OkrContributionJobPollState = "pending" | "completed" | "failed" | "none";

const ACTIVE_STATUSES = ["pending", "running"] as const;
const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

export async function GET(request: Request) {
  const access = await getSidebarAccessContext("okr-workspace");
  if (access.state !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const cycleInstanceId = url.searchParams.get("cycle_instance_id")?.trim() ?? "";
  const okrObjectiveId = url.searchParams.get("okr_objective_id")?.trim() ?? "";
  if (!cycleInstanceId || !okrObjectiveId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const organizationId = access.access.organizationId;

  const { data: objective } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id")
    .eq("id", okrObjectiveId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!objective?.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: jobs, error } = await supabase
    .schema("app")
    .from("analysis_background_jobs")
    .select("id, status, created_at")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("job_type", "okr_contribution_assessment")
    .filter("payload->>okr_objective_id", "eq", okrObjectiveId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const rows = jobs ?? [];
  const hasActive = rows.some((j) =>
    ACTIVE_STATUSES.includes(j.status as (typeof ACTIVE_STATUSES)[number])
  );
  if (hasActive) {
    return NextResponse.json({ state: "pending" satisfies OkrContributionJobPollState });
  }

  const latest = rows[0];
  if (!latest) {
    return NextResponse.json({ state: "none" satisfies OkrContributionJobPollState });
  }

  if (latest.status === "completed") {
    return NextResponse.json({ state: "completed" satisfies OkrContributionJobPollState });
  }
  if (latest.status === "failed") {
    return NextResponse.json({ state: "failed" satisfies OkrContributionJobPollState });
  }
  if (TERMINAL_STATUSES.includes(latest.status as (typeof TERMINAL_STATUSES)[number])) {
    return NextResponse.json({ state: "none" satisfies OkrContributionJobPollState });
  }

  return NextResponse.json({ state: "pending" satisfies OkrContributionJobPollState });
}
