import { NextResponse } from "next/server";

import { getCurrentUserAccessContext } from "@/lib/rbac/user-access-context";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_FIELDS = [
  "ai_enabled",
  "local_llm_enabled",
  "external_models_enabled",
  "web_search_enabled",
  "write_actions_enabled",
  "require_human_approval",
  "default_local_model",
  "default_fast_model",
  "default_frontier_model",
  "max_tool_calls_per_run",
  "max_context_objects",
  "log_prompts",
  "log_responses",
  "log_tool_calls",
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function GET() {
  const access = await getSidebarAccessContext("ai-assistant");
  if (access.state !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const userContext = await getCurrentUserAccessContext();
  if (!userContext) {
    return NextResponse.json({ error: "no_user_context" }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("ai_admin_settings")
    .select("*")
    .eq("organization_id", userContext.organizationId)
    .maybeSingle();
  return NextResponse.json({ settings: data ?? null });
}

export async function PUT(request: Request) {
  const access = await getSidebarAccessContext("ai-assistant");
  if (access.state !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const userContext = await getCurrentUserAccessContext({
    requireCapability: "ai.admin_settings.write",
  });
  if (!userContext) {
    return NextResponse.json({ error: "ai_admin_settings_write_missing" }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      update[field as AllowedField] = body[field];
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("ai_admin_settings")
    .upsert(
      { organization_id: userContext.organizationId, ...update },
      { onConflict: "organization_id" }
    )
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "upsert_failed" }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
