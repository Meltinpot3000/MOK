import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runDirectorySync } from "@/lib/directory-sync/run-directory-sync";

function isAuthorized(request: Request): boolean {
  const expected =
    process.env.DIRECTORY_SYNC_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  if (!expected) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  return token === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "admin-client-unavailable" }, { status: 503 });
  }

  let body: {
    organizationId?: string;
    mode?: "preview" | "apply";
    previewRunId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const organizationId = body.organizationId?.trim();
  const mode = body.mode ?? "preview";
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "organizationId-required" }, { status: 400 });
  }

  try {
    const result = await runDirectorySync({
      admin,
      organizationId,
      mode,
      previewRunId: body.previewRunId ?? null,
    });
    return NextResponse.json({ ok: result.status === "completed", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
