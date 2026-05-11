import { NextResponse } from "next/server";

import { getCurrentUserAccessContext } from "@/lib/rbac/user-access-context";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const access = await getSidebarAccessContext("ai-assistant");
  if (access.state === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (access.state === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const userContext = await getCurrentUserAccessContext();
  if (!userContext) {
    return NextResponse.json({ error: "no_user_context" }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("ai_conversations")
    .select("id, title, status, visibility, linked_object_type, linked_object_id, created_at, updated_at")
    .eq("organization_id", userContext.organizationId)
    .eq("created_by_user_id", userContext.userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request) {
  const access = await getSidebarAccessContext("ai-assistant");
  if (access.state !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const userContext = await getCurrentUserAccessContext({
    requireCapability: "ai.assistant.use",
  });
  if (!userContext) {
    return NextResponse.json({ error: "ai_assistant_use_missing" }, { status: 403 });
  }
  let body: { title?: string | null; linkedObjectType?: string | null; linkedObjectId?: string | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty body allowed */
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("ai_conversations")
    .insert({
      organization_id: userContext.organizationId,
      created_by_user_id: userContext.userId,
      created_by_membership_id: userContext.membershipId,
      title: body.title ?? null,
      linked_object_type: body.linkedObjectType ?? null,
      linked_object_id: body.linkedObjectId ?? null,
    })
    .select("id, title, status, visibility, linked_object_type, linked_object_id, created_at, updated_at")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ conversation: data });
}
