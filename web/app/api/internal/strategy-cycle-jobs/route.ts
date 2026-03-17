import { NextResponse } from "next/server";
import { processPendingBackgroundJobs } from "@/app/(ceo)/strategy-cycle/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request): boolean {
  const expected = process.env.STRATEGY_CYCLE_JOBS_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  if (!expected) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  return token === expected;
}

async function handleWorker(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "admin-client-unavailable" }, { status: 503 });
  }
  const result = await processPendingBackgroundJobs(admin as never);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return handleWorker(request);
}

export async function POST(request: Request) {
  return handleWorker(request);
}
