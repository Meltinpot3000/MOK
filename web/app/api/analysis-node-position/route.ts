import { NextResponse } from "next/server";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function clampCoordinate(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function POST(request: Request) {
  const access = await getSidebarAccessContext("strategy-cycle");
  if (access.state !== "ok" || !access.canWrite) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as {
    analysisEntryId?: string;
    x?: number;
    y?: number;
    z?: number;
  };
  const analysisEntryId = String(payload.analysisEntryId ?? "").trim();
  const xRaw = Number(payload.x ?? 0);
  const yRaw = Number(payload.y ?? 0);
  const zRaw = Number(payload.z ?? 0);

  if (!analysisEntryId || !Number.isFinite(xRaw) || !Number.isFinite(yRaw) || !Number.isFinite(zRaw)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const x = Number(clampCoordinate(xRaw, -1200, 1200).toFixed(3));
  const y = Number(clampCoordinate(yRaw, -800, 800).toFixed(3));
  const z = Number(clampCoordinate(zRaw, -600, 600).toFixed(3));

  const supabase = await createSupabaseServerClient();
  const { data: entry, error: entryError } = await supabase
    .schema("app")
    .from("analysis_entries")
    .select("cycle_instance_id")
    .eq("id", analysisEntryId)
    .eq("organization_id", access.access.organizationId)
    .single();
  if (entryError || !entry) {
    return NextResponse.json({ error: "entry_not_found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .schema("app")
    .from("analysis_manual_node_positions")
    .upsert(
      {
        organization_id: access.access.organizationId,
        cycle_instance_id: entry.cycle_instance_id,
        analysis_entry_id: analysisEntryId,
        x,
        y,
        z,
        created_by_membership_id: access.access.membershipId ?? null,
        updated_by_membership_id: access.access.membershipId ?? null,
      },
      { onConflict: "organization_id,cycle_instance_id,analysis_entry_id" }
    )
    .select("analysis_entry_id, x, y, z, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "persist_failed" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    position: {
      analysisEntryId: data.analysis_entry_id,
      x: Number(data.x ?? 0),
      y: Number(data.y ?? 0),
      z: Number(data.z ?? 0),
      updatedAt: data.updated_at ?? null,
    },
  });
}
