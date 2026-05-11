import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envRaw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    return envRaw.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

const BASE_URL = loadEnv("AI_SMOKE_BASE_URL") || "http://localhost:3000";
const SECRET = loadEnv("AI_SMOKE_SECRET") || loadEnv("CRON_SECRET");
const SUPABASE_URL = loadEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = loadEnv("SUPABASE_SERVICE_ROLE_KEY");
const BYPASS_PERMISSIONS = (loadEnv("AI_SMOKE_BYPASS_PERMISSIONS") || "true").toLowerCase() === "true";
const TASK_FETCH_TRACE = (loadEnv("AI_SMOKE_TASK_FETCH_TRACE") || "false").toLowerCase() === "true";
const TARGET_USER_EMAIL =
  loadEnv("AI_SMOKE_USER_EMAIL") || "carmelo.messina@cabtecgroup.com";
const FORCE_CYCLE_INSTANCE_ID = loadEnv("AI_SMOKE_CYCLE_INSTANCE_ID") || "";
const USER_ACCESS_TOKEN = loadEnv("AI_SMOKE_USER_ACCESS_TOKEN") || "";

async function issueFreshAccessTokenForEmail(email) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) return null;
  const tokenHash = link.data?.properties?.hashed_token;
  if (!tokenHash) return null;
  const anonKey = loadEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!anonKey) return null;
  const anon = createClient(SUPABASE_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await anon.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verified.error) return null;
  return verified.data.session?.access_token ?? null;
}

async function resolveLatestAiContext() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return {};
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: memberships } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id,organization_id,user_id")
    .eq("status", "active")
    .limit(100);
  for (const membership of memberships ?? []) {
    const { data: memberRoles } = await supabase
      .schema("rbac")
      .from("member_roles")
      .select("role_id")
      .eq("membership_id", membership.id);
    const roleIds = [...new Set((memberRoles ?? []).map((x) => x.role_id))];
    if (!roleIds.length) continue;
    const { data: rolePermissions } = await supabase
      .schema("rbac")
      .from("role_permissions")
      .select("permission_id")
      .in("role_id", roleIds);
    const permissionIds = [...new Set((rolePermissions ?? []).map((x) => x.permission_id))];
    if (!permissionIds.length) continue;
    const { data: permissions } = await supabase
      .schema("rbac")
      .from("permissions")
      .select("code")
      .in("id", permissionIds);
    if ((permissions ?? []).some((p) => p.code === "ai.assistant.use")) {
      return {
        organizationId: membership.organization_id,
        membershipId: membership.id,
        userId: membership.user_id,
      };
    }
  }
  const { data } = await supabase
    .schema("app")
    .from("ai_agent_runs")
    .select("organization_id,membership_id,user_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return {};
  return {
    organizationId: data.organization_id,
    membershipId: data.membership_id,
    userId: data.user_id,
  };
}

async function main() {
  const freshToken = await issueFreshAccessTokenForEmail(TARGET_USER_EMAIL);
  const effectiveToken = freshToken || USER_ACCESS_TOKEN;
  const context = await resolveLatestAiContext();
  const questions = [
    "Welche meiner erledigten Aufgaben gibt es?",
    "Welche offenen Aufgaben betreffen mich aktuell?",
    "Welche Approval-Aufgaben habe ich erledigt?",
    "Welche Aufgaben sind mit OKRs verknüpft?",
    "Wie viele meiner offenen Aufgaben sind direkt mit OKRs verknüpft?",
    "Zeige mir meine Aufgaben unabhängig vom Status.",
    "Wie viele OKRs gibt es im aktuellen Zyklus?",
    "Wer in der Organisation hat die meisten OKRs im aktuellen Zyklus?",
  ];
  const results = [];
  for (const question of questions) {
    const response = await fetch(`${BASE_URL}/api/internal/ai-smoke`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(SECRET ? { authorization: `Bearer ${SECRET}` } : {}),
      },
      body: JSON.stringify({
        ...context,
        userEmail: TARGET_USER_EMAIL,
        ...(effectiveToken ? { userAccessToken: effectiveToken } : {}),
        ...(FORCE_CYCLE_INSTANCE_ID ? { cycleInstanceId: FORCE_CYCLE_INSTANCE_ID } : {}),
        fastMode: true,
        bypassPermissions: BYPASS_PERMISSIONS,
        ...(TASK_FETCH_TRACE ? { taskFetchTrace: true } : {}),
        questions: [question],
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Smoke request failed (${response.status}) for '${question}': ${errorText}`);
    }
    const payload = await response.json();
    results.push(payload.results?.[0] ?? { question, error: "no_result" });
  }
  console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
