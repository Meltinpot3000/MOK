import { NextResponse } from "next/server";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_LINK_TYPES = new Set([
  "related_to",
  "causes",
  "supports",
  "contradicts",
  "amplifies",
  "depends_on",
  "duplicates",
]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTriScores(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const tri = raw as Record<string, unknown>;
  const proximityScore = Number(tri.proximityScore ?? 0);
  const supportScore = Number(tri.supportScore ?? 0);
  const repulsionScore = Number(tri.repulsionScore ?? 0);
  if (!Number.isFinite(proximityScore) || !Number.isFinite(supportScore) || !Number.isFinite(repulsionScore)) {
    return null;
  }
  return {
    proximityScore: Number(clamp(proximityScore, 0, 1).toFixed(4)),
    supportScore: Number(clamp(supportScore, 0, 1).toFixed(4)),
    repulsionScore: Number(clamp(repulsionScore, 0, 1).toFixed(4)),
  };
}

export async function POST(request: Request) {
  const access = await getSidebarAccessContext("strategy-cycle");
  if (access.state !== "ok" || !access.canWrite) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as {
    sourceAnalysisItemId?: string;
    targetAnalysisItemId?: string;
    linkType?: string;
    strength?: number;
    confidence?: number;
    comment?: string | null;
    triScores?: { proximityScore?: number; supportScore?: number; repulsionScore?: number } | null;
  };
  const sourceAnalysisItemId = String(payload.sourceAnalysisItemId ?? "").trim();
  const targetAnalysisItemId = String(payload.targetAnalysisItemId ?? "").trim();
  const linkType = String(payload.linkType ?? "").trim();
  const strength = Number(payload.strength ?? 3);
  const confidence = Number(payload.confidence ?? 0.5);
  const comment = payload.comment == null ? null : String(payload.comment).trim();
  const triScores = normalizeTriScores(payload.triScores ?? null);

  if (!sourceAnalysisItemId || !targetAnalysisItemId || !ALLOWED_LINK_TYPES.has(linkType)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!Number.isFinite(strength) || strength < 1 || strength > 5) {
    return NextResponse.json({ error: "invalid_strength" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: sourceEntry } = await supabase
    .schema("app")
    .from("analysis_entries")
    .select("planning_cycle_id")
    .eq("id", sourceAnalysisItemId)
    .eq("organization_id", access.access.organizationId)
    .single();
  if (!sourceEntry) {
    return NextResponse.json({ error: "source_not_found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .schema("app")
    .from("analysis_item_link")
    .upsert(
      {
        organization_id: access.access.organizationId,
        planning_cycle_id: sourceEntry.planning_cycle_id,
        source_analysis_item_id: sourceAnalysisItemId,
        target_analysis_item_id: targetAnalysisItemId,
        link_type: linkType,
        strength: Math.round(strength),
        confidence: Math.max(0, Math.min(1, Number.isFinite(confidence) ? confidence : 0.5)),
        comment: comment && comment.length > 0 ? comment : null,
        metadata: {
          ...(triScores ? { triScores } : {}),
          restored_at: new Date().toISOString(),
          restored_by_membership_id: access.access.membershipId ?? null,
        },
      },
      { onConflict: "planning_cycle_id,source_analysis_item_id,target_analysis_item_id,link_type" }
    )
    .select("id, source_analysis_item_id, target_analysis_item_id, link_type, strength, confidence, comment, created_at, updated_at, metadata")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "restore_failed" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    edge: {
      id: data.id,
      source: data.source_analysis_item_id,
      target: data.target_analysis_item_id,
      linkType: data.link_type,
      strength: data.strength,
      confidence: data.confidence,
      comment: data.comment,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      triScores:
        data.metadata && typeof data.metadata === "object"
          ? normalizeTriScores((data.metadata as Record<string, unknown>).triScores)
          : null,
      history:
        data.metadata && typeof data.metadata === "object" && Array.isArray((data.metadata as Record<string, unknown>).change_log)
          ? ((data.metadata as Record<string, unknown>).change_log as Array<Record<string, unknown>>).map((row) => {
              const prev = (row.previous as Record<string, unknown> | undefined) ?? {};
              const next = (row.next as Record<string, unknown> | undefined) ?? {};
              return {
                at: String(row.at ?? ""),
                byMembershipId: row.by_membership_id == null ? null : String(row.by_membership_id),
                previous: {
                  linkType: String(prev.link_type ?? prev.linkType ?? "related_to"),
                  strength: Number(prev.strength ?? 3),
                  comment: prev.comment == null ? null : String(prev.comment),
                },
                next: {
                  linkType: String(next.link_type ?? next.linkType ?? "related_to"),
                  strength: Number(next.strength ?? 3),
                  comment: next.comment == null ? null : String(next.comment),
                },
              };
            })
          : [],
    },
  });
}
