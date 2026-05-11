import { NextResponse } from "next/server";

import { getCurrentUserAccessContext } from "@/lib/rbac/user-access-context";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
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
  const params = await context.params;
  const supabase = await createSupabaseServerClient();

  const { data: conversation } = await supabase
    .schema("app")
    .from("ai_conversations")
    .select("id, organization_id, created_by_user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!conversation) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }
  if (
    conversation.organization_id !== userContext.organizationId ||
    conversation.created_by_user_id !== userContext.userId
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .schema("app")
    .from("ai_messages")
    .select("id, role, content, metadata, created_at")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ messages: data ?? [] });
}
