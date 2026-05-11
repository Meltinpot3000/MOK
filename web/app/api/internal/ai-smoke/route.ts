import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { runChat } from "@/lib/ai/orchestrator";
import type { AiToolDomain, AiUserContext } from "@/lib/ai/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SmokeRequestBody = {
  questions?: string[];
  organizationId?: string;
  membershipId?: string;
  userId?: string;
  userEmail?: string;
  userAccessToken?: string;
  domainHints?: AiToolDomain[];
  bypassPermissions?: boolean;
  cycleInstanceId?: string;
  chatTimeoutMs?: number;
  fastMode?: boolean;
  /** Zweite DB-Abfrage: Histogramm aller Tasks der Membership vs. Filter */
  taskFetchTrace?: boolean;
};

function pickCycleInstanceIdLikeSoftware(rows: Array<{
  cycle_instance_id: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}>): string | null {
  if (rows.length === 0) return null;
  const preferred = rows.find(
    (r) => r.cycle_instance_id && (r.status === "active" || r.status === "in_progress")
  );
  if (preferred?.cycle_instance_id) return preferred.cycle_instance_id;
  const nowMs = Date.now();
  const currentByDate = rows.find((r) => {
    if (!r.cycle_instance_id || !r.start_date || !r.end_date) return false;
    const start = Date.parse(r.start_date);
    const end = Date.parse(r.end_date);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return start <= nowMs && nowMs < end;
  });
  if (currentByDate?.cycle_instance_id) return currentByDate.cycle_instance_id;
  const upcoming = rows
    .filter((r) => r.cycle_instance_id && r.start_date)
    .map((r) => ({ row: r, start: Date.parse(r.start_date as string) }))
    .filter((x) => Number.isFinite(x.start) && x.start > nowMs)
    .sort((a, b) => a.start - b.start);
  if (upcoming[0]?.row.cycle_instance_id) return upcoming[0].row.cycle_instance_id;
  const past = rows
    .filter((r) => r.cycle_instance_id && r.end_date)
    .map((r) => ({ row: r, end: Date.parse(r.end_date as string) }))
    .filter((x) => Number.isFinite(x.end) && x.end <= nowMs)
    .sort((a, b) => b.end - a.end);
  if (past[0]?.row.cycle_instance_id) return past[0].row.cycle_instance_id;
  const fallback = rows.find((r) => r.cycle_instance_id);
  return fallback?.cycle_instance_id ?? null;
}

async function resolveCycleForSmoke(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  organizationId: string,
  explicitCycleInstanceId?: string
): Promise<{ cycleInstanceId: string | null; source: "explicit" | "auto_like_app" }> {
  if (explicitCycleInstanceId) {
    return { cycleInstanceId: explicitCycleInstanceId, source: "explicit" };
  }
  const { data } = await admin
    .schema("app")
    .from("okr_cycles")
    .select("cycle_instance_id,status,start_date,end_date")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false })
    .limit(200);
  const cycleInstanceId = pickCycleInstanceIdLikeSoftware((data ?? []) as Array<{
    cycle_instance_id: string | null;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }>);
  return { cycleInstanceId, source: "auto_like_app" };
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.AI_SMOKE_SECRET ?? process.env.CRON_SECRET ?? "";
  if (!expected) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  return token === expected;
}

async function getPermissionCodesForMembershipAdmin(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  membershipId: string
): Promise<Set<string>> {
  const codes = new Set<string>();
  const { data: memberRoles } = await admin
    .schema("rbac")
    .from("member_roles")
    .select("role_id")
    .eq("membership_id", membershipId);
  const roleIds = [...new Set((memberRoles ?? []).map((row) => row.role_id))];
  if (roleIds.length === 0) return codes;
  const { data: rolePermissions } = await admin
    .schema("rbac")
    .from("role_permissions")
    .select("permission_id")
    .in("role_id", roleIds);
  const permissionIds = [...new Set((rolePermissions ?? []).map((row) => row.permission_id))];
  if (permissionIds.length === 0) return codes;
  const { data: permissions } = await admin
    .schema("rbac")
    .from("permissions")
    .select("code")
    .in("id", permissionIds);
  for (const row of permissions ?? []) {
    if (row.code) codes.add(row.code);
  }
  return codes;
}

async function resolveContextFromBody(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  body: SmokeRequestBody
): Promise<AiUserContext | null> {
  if (body.organizationId && body.membershipId && body.userId) {
    const permissionCodes = await getPermissionCodesForMembershipAdmin(admin, body.membershipId);
    return {
      userId: body.userId,
      organizationId: body.organizationId,
      organizationName: "Smoke Tenant",
      membershipId: body.membershipId,
      roleCodes: [],
      permissionCodes,
    };
  }

  if (body.userEmail) {
    const { data: authUser } = await admin
      .schema("auth")
      .from("users")
      .select("id")
      .ilike("email", body.userEmail.trim())
      .limit(1)
      .maybeSingle();
    const authUserId = authUser?.id as string | undefined;
    if (authUserId) {
      const { data: membershipsForUser } = await admin
        .schema("app")
        .from("organization_memberships")
        .select("id, organization_id, user_id")
        .eq("status", "active")
        .eq("user_id", authUserId)
        .order("created_at", { ascending: true })
        .limit(25);
      if (membershipsForUser?.length) {
        let bestForUser: AiUserContext | null = null;
        let bestForUserScore = -1;
        for (const membership of membershipsForUser) {
          const permissionCodes = await getPermissionCodesForMembershipAdmin(admin, membership.id);
          const score =
            Number(permissionCodes.has("ai.assistant.use")) * 10 +
            Number(permissionCodes.has("nav.okr-workspace.read")) +
            Number(permissionCodes.has("okr.read")) +
            Number(permissionCodes.has("nav.my-tasks.read")) +
            Number(permissionCodes.has("tasks.read"));
          if (score > bestForUserScore) {
            bestForUserScore = score;
            bestForUser = {
              userId: membership.user_id,
              organizationId: membership.organization_id,
              organizationName: "Smoke Tenant",
              membershipId: membership.id,
              roleCodes: [],
              permissionCodes,
            };
          }
        }
        if (bestForUser) return bestForUser;
      }
    }
  }

  const { data: memberships } = await admin
    .schema("app")
    .from("organization_memberships")
    .select("id, organization_id, user_id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(25);
  if (!memberships?.length) return null;

  let best: AiUserContext | null = null;
  let bestScore = -1;
  for (const membership of memberships) {
    const permissionCodes = await getPermissionCodesForMembershipAdmin(admin, membership.id);
    const score =
      Number(permissionCodes.has("ai.assistant.use")) * 10 +
      Number(permissionCodes.has("nav.okr-workspace.read")) +
      Number(permissionCodes.has("okr.read")) +
      Number(permissionCodes.has("nav.my-tasks.read")) +
      Number(permissionCodes.has("tasks.read"));
    if (score > bestScore) {
      bestScore = score;
      best = {
        userId: membership.user_id,
        organizationId: membership.organization_id,
        organizationName: "Smoke Tenant",
        membershipId: membership.id,
        roleCodes: [],
        permissionCodes,
      };
    }
  }
  return best;
}

function createSupabaseUserClient(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function resolveContextFromToken(args: {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  userSupabase: SupabaseClient;
}): Promise<AiUserContext | null> {
  const userResult = await args.userSupabase.auth.getUser();
  const authUserId = userResult.data.user?.id;
  if (!authUserId) return null;
  const { data: membershipsForUser } = await args.userSupabase
    .schema("app")
    .from("organization_memberships")
    .select("id, organization_id, user_id")
    .eq("status", "active")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: true })
    .limit(25);
  if (!membershipsForUser?.length) return null;
  let bestForUser: AiUserContext | null = null;
  let bestForUserScore = -1;
  for (const membership of membershipsForUser) {
    const permissionCodes = await getPermissionCodesForMembershipAdmin(args.admin, membership.id);
    const score =
      Number(permissionCodes.has("ai.assistant.use")) * 10 +
      Number(permissionCodes.has("nav.okr-workspace.read")) +
      Number(permissionCodes.has("okr.read")) +
      Number(permissionCodes.has("nav.my-tasks.read")) +
      Number(permissionCodes.has("tasks.read"));
    if (score > bestForUserScore) {
      bestForUserScore = score;
      bestForUser = {
        userId: membership.user_id,
        organizationId: membership.organization_id,
        organizationName: "Smoke Tenant",
        membershipId: membership.id,
        roleCodes: [],
        permissionCodes,
      };
    }
  }
  return bestForUser;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "admin-client-unavailable" }, { status: 503 });
  }

  const body = ((await request.json().catch(() => ({}))) ?? {}) as SmokeRequestBody;
  const chatTimeoutMs = Math.max(5_000, Number(body.chatTimeoutMs ?? process.env.AI_SMOKE_CHAT_TIMEOUT_MS ?? 90_000));
  const questions =
    body.questions?.filter((q) => typeof q === "string" && q.trim().length > 0) ??
    [
      "Wer in der Organisation hat die meisten OKRs im aktuellen Zyklus?",
      "Wie viele OKRs gibt es im aktuellen Zyklus?",
      "Wie verteilen sich die OKRs im aktuellen Zyklus nach Status?",
      "Welche meiner Aufgaben betreffen mich aktuell?",
      "Welche meiner Aufgaben sind erledigt?",
      "Welche OKRs haben keinen Owner im aktuellen Zyklus?",
    ];

  const userSupabase =
    body.userAccessToken && body.userAccessToken.trim().length > 0
      ? createSupabaseUserClient(body.userAccessToken.trim())
      : null;
  const userContextFromToken = userSupabase
    ? await resolveContextFromToken({ admin, userSupabase })
    : null;
  const userContext = userContextFromToken ?? (await resolveContextFromBody(admin, body));
  if (!userContext) {
    return NextResponse.json({ ok: false, error: "no_active_membership" }, { status: 400 });
  }
  if (body.bypassPermissions === true) {
    userContext.permissionCodes.add("ai.assistant.use");
    userContext.permissionCodes.add("nav.okr-workspace.read");
    userContext.permissionCodes.add("okr.read");
    userContext.permissionCodes.add("nav.my-tasks.read");
    userContext.permissionCodes.add("tasks.read");
  }
  const cycleResolution = await resolveCycleForSmoke(
    userSupabase ?? admin,
    userContext.organizationId,
    body.cycleInstanceId
  );

  const results: Array<Record<string, unknown>> = [];
  for (const question of questions) {
    const supabaseForRun = userSupabase ?? admin;
    const { data: conversation, error: conversationError } = await supabaseForRun
      .schema("app")
      .from("ai_conversations")
      .insert({
        organization_id: userContext.organizationId,
        created_by_user_id: userContext.userId,
        created_by_membership_id: userContext.membershipId,
      })
      .select("id")
      .maybeSingle();
    const conversationId = conversation?.id ?? crypto.randomUUID();
    const events: Record<string, unknown> = {
      question,
      smokeContext: {
        cycleInstanceId: cycleResolution.cycleInstanceId,
        cycleSource: cycleResolution.source,
      },
    };
    if (conversationError) {
      events.error = `conversation_create_failed:${conversationError.message}`;
      results.push(events);
      continue;
    }
    const abortController = new AbortController();
    const iterator = runChat({
      question,
      conversationId,
      recentMessages: [],
      userContext,
      uiContext: cycleResolution.cycleInstanceId
        ? { cycleId: cycleResolution.cycleInstanceId }
        : null,
      supabase: supabaseForRun,
      domainHints: body.domainHints ?? [],
      signal: abortController.signal,
      skipSynthesis: body.fastMode === true,
      taskFetchDiagnostics: body.taskFetchTrace === true,
    });
    let timedOut = false;
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      abortController.abort("smoke_chat_timeout");
    }, chatTimeoutMs);
    try {
      for await (const event of iterator) {
        if (event.type === "diagnostics") events.diagnostics = event.data;
        if (event.type === "structured_contract") events.contract = event.contract;
        if (event.type === "answer") events.answer = event.text;
        if (event.type === "blocked") events.blocked = { reason: event.reason, reasonCode: event.reasonCode };
        if (event.type === "error") events.error = event.message;
      }
      if (timedOut && !events.error) {
        events.error = `chat_timeout_${chatTimeoutMs}ms`;
      }
    } catch (error) {
      if (timedOut) {
        events.error = `chat_timeout_${chatTimeoutMs}ms`;
      } else {
        events.error = error instanceof Error ? error.message : String(error);
      }
    } finally {
      clearTimeout(timeoutHandle);
      if (typeof iterator.return === "function") {
        await iterator.return(undefined);
      }
    }
    results.push(events);
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
