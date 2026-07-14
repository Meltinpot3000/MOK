import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

export type StrategicContextRebuildPollState = "pending" | "completed" | "failed" | "none";

const ACTIVE_STATUSES = ["pending", "running"] as const;
const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

export async function GET() {
  const access = await getSidebarAccessContext("strategy-cycle");
  if (access.state !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const organizationId = access.access.organizationId;

  const { data: jobs, error } = await supabase
    .schema("app")
    .from("analysis_background_jobs")
    .select("id, status, created_at")
    .eq("organization_id", organizationId)
    .eq("job_type", "strategic_context_rebuild")
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
    return NextResponse.json({ state: "pending" satisfies StrategicContextRebuildPollState });
  }

  const latest = rows[0];
  if (!latest) {
    return NextResponse.json({ state: "none" satisfies StrategicContextRebuildPollState });
  }

  if (latest.status === "completed") {
    return NextResponse.json({ state: "completed" satisfies StrategicContextRebuildPollState });
  }
  if (latest.status === "failed") {
    return NextResponse.json({ state: "failed" satisfies StrategicContextRebuildPollState });
  }
  if (TERMINAL_STATUSES.includes(latest.status as (typeof TERMINAL_STATUSES)[number])) {
    return NextResponse.json({ state: "none" satisfies StrategicContextRebuildPollState });
  }

  return NextResponse.json({ state: "pending" satisfies StrategicContextRebuildPollState });
}
