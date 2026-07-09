import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatKrPlanningReadOnlyLine } from "@/lib/okr/format-kr-planning-line";
import { fetchMembershipDisplayNames } from "@/lib/tasks/approval-queries";
import {
  formulationTierLabelDe,
  scopeFitTierLabelDe,
} from "@/lib/okr/okr-contribution-direction-labels";
import { OKR_CONTRIBUTION_TIER_META } from "@/lib/strategy-cycle/coverage-level";
import type { OkrContributionTier } from "@/lib/strategy-cycle/coverage-level";

export type OkrApprovalPreviewKeyResult = {
  id: string;
  title: string;
  metricSummary: string;
  ownerDisplayName: string | null;
  linkedInitiativeTitles: string[];
};

export type OkrApprovalPreviewContributionRow = {
  targetTitle: string;
  alignmentLabel: string;
  formulationLabel: string;
  scopeFitLabel: string;
  reason: string | null;
};

export type OkrObjectiveApprovalPreview = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  okrCycleId: string | null;
  ownerDisplayName: string | null;
  deputyDisplayName: string | null;
  leadingStrategicDirectionTitle: string | null;
  keyResults: OkrApprovalPreviewKeyResult[];
  contributionRows: OkrApprovalPreviewContributionRow[];
};

function tierLabel(tier: string | null | undefined): string {
  if (!tier) return "—";
  const meta = OKR_CONTRIBUTION_TIER_META[tier as OkrContributionTier];
  return meta ? `${meta.emoji} ${meta.labelDe}` : tier;
}

export async function fetchOkrObjectiveApprovalPreview(
  organizationId: string,
  objectiveId: string
): Promise<OkrObjectiveApprovalPreview | null> {
  const supabase = await createSupabaseServerClient();

  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select(
      "id, title, description, status, okr_cycle_id, cycle_instance_id, owner_membership_id, deputy_membership_id, leading_strategic_direction_id"
    )
    .eq("id", objectiveId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!obj?.id) return null;

  const membershipIds = [obj.owner_membership_id, obj.deputy_membership_id].filter(
    (id): id is string => Boolean(id)
  );
  const names = await fetchMembershipDisplayNames(membershipIds);

  const leadingDirectionId = (obj.leading_strategic_direction_id as string | null | undefined) ?? null;

  let leadingStrategicDirectionTitle: string | null = null;
  if (leadingDirectionId) {
    const { data: dirRow } = await supabase
      .schema("app")
      .from("strategic_directions")
      .select("title")
      .eq("id", leadingDirectionId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    leadingStrategicDirectionTitle = dirRow?.title?.trim() || null;
  }

  const { data: krRows } = await supabase
    .schema("app")
    .from("key_results")
    .select(
      "id, title, metric_type, start_value, target_value, current_value, measurement_unit, owner_membership_id"
    )
    .eq("organization_id", organizationId)
    .eq("okr_objective_id", objectiveId)
    .order("created_at", { ascending: true });

  const krIds = (krRows ?? []).map((k) => k.id as string);
  const krOwnerIds = (krRows ?? [])
    .map((k) => k.owner_membership_id as string | null)
    .filter((id): id is string => Boolean(id));
  const krNames = await fetchMembershipDisplayNames(krOwnerIds);

  const initiativeTitlesByKrId = new Map<string, string[]>();
  if (krIds.length > 0 && obj.cycle_instance_id) {
    const { data: links } = await supabase
      .schema("app")
      .from("initiative_key_result_links")
      .select("key_result_id, initiative_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", obj.cycle_instance_id)
      .in("key_result_id", krIds);

    const initiativeIds = [...new Set((links ?? []).map((l) => l.initiative_id as string))];
    const initiativeTitleById = new Map<string, string>();
    if (initiativeIds.length > 0) {
      const { data: initRows } = await supabase
        .schema("app")
        .from("initiatives")
        .select("id, title")
        .eq("organization_id", organizationId)
        .in("id", initiativeIds);
      for (const i of initRows ?? []) {
        initiativeTitleById.set(i.id as string, String(i.title ?? i.id));
      }
    }
    for (const link of links ?? []) {
      const krId = link.key_result_id as string;
      const title = initiativeTitleById.get(link.initiative_id as string);
      if (!title) continue;
      const list = initiativeTitlesByKrId.get(krId) ?? [];
      if (!list.includes(title)) list.push(title);
      initiativeTitlesByKrId.set(krId, list);
    }
  }

  const keyResults: OkrApprovalPreviewKeyResult[] = (krRows ?? []).map((kr) => {
    const ownerId = kr.owner_membership_id as string | null;
    return {
      id: kr.id as string,
      title: String(kr.title ?? ""),
      metricSummary: formatKrPlanningReadOnlyLine({
        metricType: String(kr.metric_type ?? "boolean"),
        startValue: kr.start_value != null ? Number(kr.start_value) : null,
        targetValue: kr.target_value != null ? Number(kr.target_value) : null,
        currentValue: kr.current_value != null ? Number(kr.current_value) : null,
        measurementUnit: (kr.measurement_unit as string | null) ?? null,
      }),
      ownerDisplayName: ownerId ? krNames.get(ownerId) ?? null : null,
      linkedInitiativeTitles: initiativeTitlesByKrId.get(kr.id as string) ?? [],
    };
  });

  const { data: edgeRows } = await supabase
    .schema("app")
    .from("okr_contribution_edges")
    .select(
      "target_type, target_id, llm_alignment_level, llm_formulation_level, llm_ambition_level, llm_scope_fit_level, llm_reason, confirmed_level, value_source"
    )
    .eq("organization_id", organizationId)
    .eq("okr_objective_id", objectiveId);

  const directionEdges = (edgeRows ?? []).filter((e) => e.target_type === "strategic_direction");
  const directionIds = [...new Set(directionEdges.map((e) => e.target_id as string))];
  const directionTitleById = new Map<string, string>();
  if (directionIds.length > 0) {
    const { data: dirRows } = await supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title")
      .eq("organization_id", organizationId)
      .in("id", directionIds);
    for (const d of dirRows ?? []) {
      directionTitleById.set(d.id as string, String(d.title ?? "").trim());
    }
  }

  const contributionRows: OkrApprovalPreviewContributionRow[] = directionEdges.map((e) => {
    const formulation =
      (e.llm_formulation_level as string | null) ??
      (e.llm_ambition_level as string | null) ??
      (e.confirmed_level as string | null);

    return {
      targetTitle: directionTitleById.get(e.target_id as string) || "Stoßrichtung",
      alignmentLabel: tierLabel(
        (e.llm_alignment_level as string | null) ?? (e.confirmed_level as string | null)
      ),
      formulationLabel: formulationTierLabelDe(formulation as OkrContributionTier | null),
      scopeFitLabel: scopeFitTierLabelDe(e.llm_scope_fit_level as OkrContributionTier | null),
      reason: (e.llm_reason as string | null)?.trim() || null,
    };
  });

  return {
    id: obj.id,
    title: String(obj.title ?? ""),
    description: (obj.description as string | null)?.trim() || null,
    status: String(obj.status ?? "draft"),
    okrCycleId: (obj.okr_cycle_id as string | null) ?? null,
    ownerDisplayName: obj.owner_membership_id
      ? names.get(obj.owner_membership_id) ?? null
      : null,
    deputyDisplayName: obj.deputy_membership_id
      ? names.get(obj.deputy_membership_id) ?? null
      : null,
    leadingStrategicDirectionTitle,
    keyResults,
    contributionRows,
  };
}
