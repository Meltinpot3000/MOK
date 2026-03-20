import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

const RECENT_MINUTES = 10;

export type RecentJob = {
  id: string;
  job_type: string;
  finished_at: string;
  cycle_instance_id: string;
};

export async function GET() {
  const access = await getSidebarAccessContext("strategy-cycle");
  if (access.state !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - RECENT_MINUTES * 60 * 1000).toISOString();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .schema("app")
    .from("analysis_background_jobs")
    .select("id, job_type, finished_at, cycle_instance_id")
    .eq("organization_id", access.access.organizationId)
    .eq("status", "completed")
    .gte("finished_at", since)
    .order("finished_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const jobs = (data ?? []) as RecentJob[];
  return NextResponse.json({ jobs });
}
