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

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeHistory(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const prev = row.previous as Record<string, unknown> | undefined;
      const next = row.next as Record<string, unknown> | undefined;
      return {
        at: String(row.at ?? ""),
        byMembershipId:
          row.by_membership_id == null ? null : String(row.by_membership_id),
        previous: {
          linkType: String(prev?.link_type ?? prev?.linkType ?? "related_to"),
          strength: Number(prev?.strength ?? 3),
          comment: prev?.comment == null ? null : String(prev.comment),
        },
        next: {
          linkType: String(next?.link_type ?? next?.linkType ?? "related_to"),
          strength: Number(next?.strength ?? 3),
          comment: next?.comment == null ? null : String(next.comment),
        },
      };
    })
    .filter(Boolean);
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await getSidebarAccessContext("strategy-cycle");
  if (access.state !== "ok" || !access.canWrite) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = (await request.json()) as {
    linkType?: string;
    strength?: number;
    comment?: string | null;
  };
  const linkType = String(payload.linkType ?? "").trim();
  const strength = Number(payload.strength ?? 3);
  const comment = payload.comment == null ? null : String(payload.comment).trim();

  if (!ALLOWED_LINK_TYPES.has(linkType)) {
    return NextResponse.json({ error: "invalid_link_type" }, { status: 400 });
  }
  if (!Number.isFinite(strength) || strength < 1 || strength > 5) {
    return NextResponse.json({ error: "invalid_strength" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .schema("app")
    .from("analysis_item_link")
    .select("id, link_type, strength, comment, metadata")
    .eq("id", id)
    .eq("organization_id", access.access.organizationId)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const existingMetadata =
    existing.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};
  const existingChangeLog = Array.isArray(existingMetadata.change_log)
    ? (existingMetadata.change_log as unknown[])
    : [];
  const nextChange = {
    at: new Date().toISOString(),
    by_membership_id: access.access.membershipId ?? null,
    previous: {
      link_type: existing.link_type,
      strength: existing.strength,
      comment: existing.comment ?? null,
    },
    next: {
      link_type: linkType,
      strength: Math.round(strength),
      comment: comment && comment.length > 0 ? comment : null,
    },
  };

  const { data, error } = await supabase
    .schema("app")
    .from("analysis_item_link")
    .update({
      link_type: linkType,
      strength: Math.round(strength),
      comment: comment && comment.length > 0 ? comment : null,
      metadata: {
        ...existingMetadata,
        change_log: [...existingChangeLog, nextChange].slice(-50),
      },
    })
    .eq("id", id)
    .eq("organization_id", access.access.organizationId)
    .select("id, link_type, strength, comment, created_at, updated_at, metadata")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "update_failed" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    edge: {
      id: data.id,
      linkType: data.link_type,
      strength: data.strength,
      comment: data.comment,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      triScores:
        data.metadata && typeof data.metadata === "object"
          ? normalizeTriScores((data.metadata as Record<string, unknown>).triScores)
          : null,
      history:
        data.metadata && typeof data.metadata === "object"
          ? normalizeHistory((data.metadata as Record<string, unknown>).change_log)
          : [],
    },
  });
}

export async function DELETE(_: Request, context: RouteContext) {
  const access = await getSidebarAccessContext("strategy-cycle");
  if (access.state !== "ok" || !access.canWrite) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .schema("app")
    .from("analysis_item_link")
    .delete()
    .eq("id", id)
    .eq("organization_id", access.access.organizationId);

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
