"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContextOrRedirectFromActions } from "@/app/(ceo)/strategy-cycle/action-context";
import {
  evaluateLlmBudgetStatus,
  type BudgetSupabaseClientLike,
} from "@/lib/analysis-network/budget";
import {
  isLlmFeatureEnabled,
  readAnalysisNetworkLlmPolicy,
  resolveLlmMaxOutputTokens,
} from "@/lib/analysis-network/policy";
import { getTenantBranding } from "@/lib/ceo/queries";
import { readCompanyKennzahlenFromBrandingConfig } from "@/lib/strategy-cycle/company-info";
import { generateDesignFieldSuggestionsWithLlm } from "@/lib/strategy-cycle/design-field-suggestions-ai";
import {
  directionHasExistingGrouping,
  prepareDesignFieldSuggestionsInput,
} from "@/lib/strategy-cycle/design-field-suggestions-prep";
import { validateDesignFieldSuggestions } from "@/lib/strategy-cycle/design-field-suggestions-validate";
import { enrichDesignFieldSuggestionsForCoverage } from "@/lib/strategy-cycle/design-field-suggestions-coverage";
import { getStrategyCycleWorkspaceData } from "@/lib/strategy-cycle/queries";
import {
  buildStrategyReferenceText,
  readStrategyReferenceFieldsFromBrandingConfig,
} from "@/lib/strategy-cycle/strategy-reference";
import { computeDirectionPriorityFromAssessment } from "@/lib/strategy-cycle/scoring";
import { assertStrategyObjectDefinitionEditable } from "@/lib/strategy-objects/governance-server";
import {
  fetchOpenDraftForIdentity,
  fetchRevisionById,
} from "@/lib/strategy-objects/revision-queries";
import {
  buildDirectionDefinitionPayload,
  createStrategyObjectDraft,
  updateStrategyObjectDraftRpc,
} from "@/lib/strategy-objects/write";
import { strategyObjectDefinitionHash } from "@/lib/strategy-objects/definition-hash";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildDirectionGroupingPayload(
  existing: Record<string, unknown>,
  groupingLabel: string
): Record<string, unknown> {
  const strategicValueScore = readNumber(existing.strategic_value_score, 3);
  const capabilityFitScore = readNumber(existing.capability_fit_score, 3);
  const feasibilityScore = readNumber(existing.feasibility_score, 3);
  const riskLevel = readNumber(existing.risk_level, 3);
  const priority = computeDirectionPriorityFromAssessment({
    strategicValueScore,
    capabilityFitScore,
    feasibilityScore,
    riskScore: riskLevel,
  });
  return buildDirectionDefinitionPayload(existing, {
    priority,
    grouping: groupingLabel,
    strategicValueScore,
    capabilityFitScore,
    feasibilityScore,
    riskLevel,
    relevanceLevel: readNumber(existing.relevance_level, strategicValueScore),
  });
}

async function persistDirectionGroupingOnRevision(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  revisionId: string,
  title: string,
  description: string | null,
  revisionState: string,
  definitionPayload: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (revisionState === "draft" || revisionState === "pending_approval") {
    const updateResult = await updateStrategyObjectDraftRpc(
      supabase,
      revisionId,
      title,
      description,
      definitionPayload
    );
    if (!updateResult.ok) {
      return { ok: false, error: updateResult.error ?? "Entwurf konnte nicht aktualisiert werden." };
    }
    return { ok: true };
  }

  const definitionHash = strategyObjectDefinitionHash(
    "strategic_direction",
    title,
    description,
    definitionPayload
  );
  const { error } = await supabase
    .schema("app")
    .from("strategy_object_revisions")
    .update({
      definition_payload: definitionPayload,
      definition_hash: definitionHash,
    })
    .eq("organization_id", organizationId)
    .eq("id", revisionId);
  if (error) return { ok: false, error: error.message ?? "Revision konnte nicht aktualisiert werden." };
  return { ok: true };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function loadDesignFieldSuggestionWorkspace(context: {
  organizationId: string;
  cycleId: string;
}) {
  const workspace = await getStrategyCycleWorkspaceData(context.organizationId, context.cycleId);
  const industries = workspace.availableDimensions?.industries ?? [];
  const businessModels = workspace.availableDimensions?.businessModels ?? [];
  const industryLabelsById = Object.fromEntries(industries.map((i) => [i.id, i.name]));
  const businessModelLabelsById = Object.fromEntries(businessModels.map((b) => [b.id, b.name]));

  const prep = prepareDesignFieldSuggestionsInput({
    strategicDirections: (workspace.strategicDirections ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description ?? null,
      grouping: d.grouping ?? null,
      versioning: d.versioning,
    })),
    challenges: (workspace.challenges ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      challenge_score: (c as { challenge_score?: number | null }).challenge_score ?? null,
    })),
    objectives: (workspace.objectives ?? []).map((o) => ({
      id: o.id,
      title: o.title,
      importance_score: (o as { importance_score?: number | null }).importance_score ?? null,
    })),
    challengeDirectionLinks: (workspace.challengeDirectionLinks ?? []).map((l) => ({
      strategic_challenge_id: l.strategic_challenge_id,
      strategic_direction_id: l.strategic_direction_id,
      contribution_level: (l as { contribution_level?: string | null }).contribution_level ?? "medium",
    })),
    directionObjectiveLinks: workspace.directionObjectiveLinks ?? [],
    directionIndustries: workspace.directionIndustries ?? [],
    directionBusinessModels: workspace.directionBusinessModels ?? [],
    industryLabelsById,
    businessModelLabelsById,
  });

  return { workspace, prep, industryLabelsById, businessModelLabelsById };
}

export async function generateDesignFieldSuggestions() {
  const context = await getWorkspaceContextOrRedirectFromActions();
  const branding = await getTenantBranding(context.organizationId);
  const policy = readAnalysisNetworkLlmPolicy(branding?.branding_config ?? null);
  if (!policy.llmEnabled || !isLlmFeatureEnabled(policy, "design_field_suggestions")) {
    return { ok: false as const, error: "Sentinel✨ für Designfelder ist deaktiviert." };
  }

  const supabase = await createSupabaseServerClient();
  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: supabase as unknown as BudgetSupabaseClientLike,
    organizationId: context.organizationId,
    policy,
  });
  if (!budgetStatus.allowed) {
    return { ok: false as const, error: "Sentinel✨-Budget ausgeschöpft oder gesperrt." };
  }

  const { prep, workspace } = await loadDesignFieldSuggestionWorkspace(context);
  if (prep.activeDirections.length < 2) {
    return {
      ok: false as const,
      error: "Mindestens zwei aktive Stoßrichtungen werden für Vorschläge benötigt.",
    };
  }

  const kennzahlen = readCompanyKennzahlenFromBrandingConfig(branding?.branding_config ?? null);
  const strategyRef = readStrategyReferenceFieldsFromBrandingConfig(branding?.branding_config ?? null);
  const maxTokens = resolveLlmMaxOutputTokens(policy, "design_field_suggestions");

  const llmResult = await generateDesignFieldSuggestionsWithLlm(
    {
      companyKennzahlenJson: JSON.stringify(kennzahlen),
      strategyReferenceText: buildStrategyReferenceText(strategyRef),
      directionSummaries: prep.directionSummaries,
      clusterCandidates: prep.clusterCandidates,
      managementPartitions: prep.managementPartitions,
    },
    maxTokens
  );
  if (!llmResult.ok) return llmResult;

  const titleByDirectionId = Object.fromEntries(
    prep.activeDirections.map((d) => [d.id, d.title] as const)
  );
  const validated = validateDesignFieldSuggestions(
    llmResult.data,
    prep.activeDirections.map((d) => d.id),
    titleByDirectionId
  );
  const enriched = enrichDesignFieldSuggestionsForCoverage(validated, {
    directions: prep.activeDirections,
    challenges: (workspace.challenges ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      challenge_score: (c as { challenge_score?: number | null }).challenge_score ?? null,
    })),
    objectives: (workspace.objectives ?? []).map((o) => ({
      id: o.id,
      title: o.title,
      importance_score: (o as { importance_score?: number | null }).importance_score ?? null,
    })),
    challengeDirectionLinks: (workspace.challengeDirectionLinks ?? []).map((l) => ({
      strategic_challenge_id: l.strategic_challenge_id,
      strategic_direction_id: l.strategic_direction_id,
      contribution_level: (l as { contribution_level?: string | null }).contribution_level ?? "medium",
    })),
    directionObjectiveLinks: workspace.directionObjectiveLinks ?? [],
    managementPartitions: prep.managementPartitions,
    titleByDirectionId,
  });

  return {
    ok: true as const,
    suggestions: enriched.suggestions,
    unassignedDirectionIds: enriched.unassignedDirectionIds,
    warningDe: enriched.warningDe,
    meta: {
      activeDirectionCount: prep.activeDirections.length,
      clusterCandidateCount: prep.clusterCandidates.length,
      managementPartitionCount: prep.managementPartitions.length,
    },
  };
}

async function applyGroupingToDirection(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  context: { organizationId: string; cycleId: string },
  directionId: string,
  groupingLabel: string
): Promise<{ ok: true; draftRevisionId?: string } | { ok: false; error: string }> {
  const currentRevision = await fetchRevisionById(context.organizationId, directionId, { supabase });
  if (!currentRevision) return { ok: false, error: "Stoßrichtung nicht gefunden." };

  const lockCheck = await assertStrategyObjectDefinitionEditable(supabase, directionId);
  if (lockCheck.ok) {
    const definitionPayload = buildDirectionGroupingPayload(
      asRecord(currentRevision.definition_payload),
      groupingLabel
    );
    const revisionResult = await persistDirectionGroupingOnRevision(
      supabase,
      context.organizationId,
      directionId,
      currentRevision.title,
      currentRevision.description,
      currentRevision.revision_state,
      definitionPayload
    );
    if (!revisionResult.ok) return revisionResult;

    const { error } = await supabase
      .schema("app")
      .from("strategic_directions")
      .update({ grouping: groupingLabel })
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId)
      .eq("id", directionId);
    if (error) return { ok: false, error: error.message ?? "Update fehlgeschlagen." };
    return { ok: true };
  }

  let draftRevision =
    (await fetchOpenDraftForIdentity(
      context.organizationId,
      currentRevision.object_identity_id,
      context.cycleId,
      { supabase }
    )) ?? null;

  if (!draftRevision) {
    const created = await createStrategyObjectDraft(supabase, directionId);
    if (!created.ok) {
      return { ok: false, error: created.error ?? "Revision-Entwurf konnte nicht angelegt werden." };
    }
    if (!created.data) {
      return { ok: false, error: "Revision-Entwurf konnte nicht angelegt werden." };
    }
    draftRevision = await fetchRevisionById(context.organizationId, created.data, { supabase });
  }
  if (!draftRevision) return { ok: false, error: "Revision-Entwurf nicht gefunden." };

  const definitionPayload = buildDirectionGroupingPayload(
    asRecord(draftRevision.definition_payload),
    groupingLabel
  );
  const updateResult = await updateStrategyObjectDraftRpc(
    supabase,
    draftRevision.id,
    draftRevision.title,
    draftRevision.description,
    definitionPayload
  );
  if (!updateResult.ok) {
    return { ok: false, error: updateResult.error ?? "Entwurf konnte nicht aktualisiert werden." };
  }

  const { error: legacyError } = await supabase
    .schema("app")
    .from("strategic_directions")
    .update({ grouping: groupingLabel })
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", directionId);
  if (legacyError) {
    return { ok: false, error: legacyError.message ?? "Legacy-Spiegel konnte nicht aktualisiert werden." };
  }

  return { ok: true, draftRevisionId: draftRevision.id };
}

export async function applyDesignFieldGroupingSuggestion(formData: FormData) {
  const context = await getWorkspaceContextOrRedirectFromActions();
  const suggestionLabel = String(formData.get("suggestion_label") ?? "").trim();
  const directionIdsRaw = String(formData.get("direction_ids") ?? "").trim();
  const overwriteExisting = String(formData.get("overwrite_existing") ?? "false") === "true";

  if (!suggestionLabel) {
    return { ok: false as const, error: "Vorschlags-Label fehlt." };
  }

  let directionIds: string[] = [];
  try {
    const parsed = JSON.parse(directionIdsRaw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("invalid");
    directionIds = parsed.map((id) => String(id).trim()).filter(Boolean);
  } catch {
    return { ok: false as const, error: "Stoßrichtungs-IDs ungültig." };
  }
  if (directionIds.length === 0) {
    return { ok: false as const, error: "Keine Stoßrichtungen ausgewählt." };
  }

  const { prep } = await loadDesignFieldSuggestionWorkspace(context);
  const allowedIds = new Set(prep.activeDirections.map((d) => d.id));
  const filteredIds = directionIds.filter((id) => allowedIds.has(id));
  if (filteredIds.length === 0) {
    return { ok: false as const, error: "Keine gültigen aktiven Stoßrichtungen." };
  }

  const applicableIds = filteredIds.filter((id) => {
    if (overwriteExisting) return true;
    return !directionHasExistingGrouping(prep.activeDirections, id);
  });
  if (applicableIds.length === 0) {
    return {
      ok: false as const,
      error:
        "Alle ausgewählten Stoßrichtungen haben bereits ein Designfeld. Aktivieren Sie „Bestehende Gruppierungen überschreiben“.",
    };
  }

  const supabase = await createSupabaseServerClient();
  let appliedCount = 0;
  let skippedExistingCount = filteredIds.length - applicableIds.length;
  const draftRevisionIds: string[] = [];

  for (const directionId of applicableIds) {
    const result = await applyGroupingToDirection(supabase, context, directionId, suggestionLabel);
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    appliedCount += 1;
    if (result.draftRevisionId) draftRevisionIds.push(result.draftRevisionId);
  }

  revalidatePath("/strategy-cycle");
  return {
    ok: true as const,
    appliedCount,
    skippedExistingCount,
    draftRevisionIds,
  };
}

export async function applyDesignFieldGroupingSuggestionAction(formData: FormData) {
  const result = await applyDesignFieldGroupingSuggestion(formData);
  if (!result.ok) return result;
  redirect("/strategy-cycle?l1=strategic-directions&l2=dashboard&success=design-field-applied");
}
