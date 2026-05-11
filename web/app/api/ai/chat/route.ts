import { NextResponse } from "next/server";

import type { OrchestratorEvent } from "@/lib/ai/orchestrator";
import { runChat } from "@/lib/ai/orchestrator";
import type { AssistantUiContext, AiToolDomain } from "@/lib/ai/types";
import { listAllTools } from "@/lib/ai/tools/registry";
import { getCurrentUserAccessContext } from "@/lib/rbac/user-access-context";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatRequestBody = {
  conversationId?: string;
  question?: string;
  uiContext?: AssistantUiContext | null;
  recentMessages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  domainHints?: AiToolDomain[];
};

const PREFERRED_ASSISTANT_CAPABILITIES = Array.from(
  new Set(listAllTools().flatMap((tool) => tool.requiredCapabilities))
);

function encodeSseEvent(event: OrchestratorEvent): string {
  const payload = JSON.stringify(event);
  return `event: ${event.type}\ndata: ${payload}\n\n`;
}

async function ensureConversation(args: {
  conversationId: string | null | undefined;
  userId: string;
  membershipId: string;
  organizationId: string;
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  if (args.conversationId) {
    const { data } = await supabase
      .schema("app")
      .from("ai_conversations")
      .select("id, organization_id, created_by_user_id")
      .eq("id", args.conversationId)
      .maybeSingle();
    if (data && data.organization_id === args.organizationId && data.created_by_user_id === args.userId) {
      return { id: data.id as string };
    }
    return { error: "conversation_not_found" };
  }
  const { data, error } = await supabase
    .schema("app")
    .from("ai_conversations")
    .insert({
      organization_id: args.organizationId,
      created_by_user_id: args.userId,
      created_by_membership_id: args.membershipId,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "conversation_insert_failed" };
  }
  return { id: data.id as string };
}

async function persistUserMessage(args: {
  conversationId: string;
  organizationId: string;
  content: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("ai_messages")
    .insert({
      conversation_id: args.conversationId,
      organization_id: args.organizationId,
      role: "user",
      content: args.content,
    })
    .select("id")
    .maybeSingle();
  return data?.id as string | undefined;
}

async function persistAssistantMessage(args: {
  conversationId: string;
  organizationId: string;
  content: string;
  metadata: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("ai_messages").insert({
    conversation_id: args.conversationId,
    organization_id: args.organizationId,
    role: "assistant",
    content: args.content,
    metadata: args.metadata,
  });
}

export async function POST(request: Request) {
  const access = await getSidebarAccessContext("ai-assistant");
  if (access.state === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (access.state === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const userContext = await getCurrentUserAccessContext({
    requireAllCapabilities: ["ai.assistant.use"],
    preferCapabilities: PREFERRED_ASSISTANT_CAPABILITIES,
  });
  if (!userContext) {
    return NextResponse.json({ error: "ai_assistant_use_missing" }, { status: 403 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "missing_question" }, { status: 400 });
  }

  const conversationResult = await ensureConversation({
    conversationId: body.conversationId,
    userId: userContext.userId,
    membershipId: userContext.membershipId,
    organizationId: userContext.organizationId,
  });
  if ("error" in conversationResult) {
    return NextResponse.json({ error: conversationResult.error }, { status: 400 });
  }

  await persistUserMessage({
    conversationId: conversationResult.id,
    organizationId: userContext.organizationId,
    content: question,
  });

  const supabase = await createSupabaseServerClient();
  const recentMessages = (body.recentMessages ?? []).slice(-5);
  const domainHints = (body.domainHints ?? []).filter((d): d is AiToolDomain => Boolean(d));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: OrchestratorEvent) => {
        controller.enqueue(encoder.encode(encodeSseEvent(event)));
      };
      send({ type: "status", status: "starting" });
      send({ type: "conversation", conversationId: conversationResult.id });
      const finalParts: { answer?: string; provider?: string; model?: string; modelTier?: string } = {};
      try {
        const iterator = runChat({
          question,
          conversationId: conversationResult.id,
          recentMessages,
          userContext,
          uiContext: body.uiContext ?? null,
          supabase,
          domainHints,
        });
        for await (const event of iterator) {
          send(event);
          if (event.type === "answer") {
            finalParts.answer = event.text;
            finalParts.provider = event.provider;
            finalParts.model = event.model;
            finalParts.modelTier = event.modelTier;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", message });
      } finally {
        if (finalParts.answer) {
          await persistAssistantMessage({
            conversationId: conversationResult.id,
            organizationId: userContext.organizationId,
            content: finalParts.answer,
            metadata: {
              provider: finalParts.provider,
              model: finalParts.model,
              modelTier: finalParts.modelTier,
            },
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
