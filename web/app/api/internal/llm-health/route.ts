import { NextResponse } from "next/server";
import {
  runAndPersistModelHealthChecks,
  type SupabaseClientLike,
} from "@/lib/analysis-network/model-health";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request): boolean {
  const expected = process.env.LLM_HEALTHCHECK_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  if (!expected) return process.env.NODE_ENV !== "production";

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  return token === expected;
}

async function handleCronHealthcheck(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "admin-client-unavailable" }, { status: 503 });
  }

  const { data: organizations, error } = await admin.schema("app").from("organizations").select("id").limit(5000);
  if (error) {
    return NextResponse.json({ ok: false, error: "organizations-query-failed" }, { status: 500 });
  }

  let processed = 0;
  for (const organization of organizations ?? []) {
    if (!organization.id) continue;
    await runAndPersistModelHealthChecks({
      supabase: admin as unknown as SupabaseClientLike,
      organizationId: organization.id,
      trigger: "cron",
    });
    processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}

export async function GET(request: Request) {
  return handleCronHealthcheck(request);
}

export async function POST(request: Request) {
  return handleCronHealthcheck(request);
}
