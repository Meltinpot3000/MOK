import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { strategyObjectDefinitionHash } from "./definition-hash";
import type { StrategyObjectIdentityLifecycleState, StrategyObjectRevisionState, StrategyObjectType } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const LEGACY_TABLE_BY_TYPE: Record<StrategyObjectType, string> = {
  strategic_challenge: "strategic_challenges",
  strategic_direction: "strategic_directions",
  strategic_objective: "strategy_objectives",
};

type BootstrapRevisionInput = {
  objectType: StrategyObjectType;
  organizationId: string;
  cycleInstanceId: string;
  revisionId: string;
  title: string;
  description: string | null;
  definitionPayload: Record<string, unknown>;
  identityLifecycleState?: StrategyObjectIdentityLifecycleState;
  revisionState?: StrategyObjectRevisionState;
  createdByMembershipId?: string | null;
};

export async function bootstrapStrategyObjectRevision(
  supabase: SupabaseClient,
  input: BootstrapRevisionInput
): Promise<void> {
  const identityLifecycle = input.identityLifecycleState ?? "draft";
  const revisionState = input.revisionState ?? "current";
  const definitionHash = strategyObjectDefinitionHash(
    input.objectType,
    input.title,
    input.description,
    input.definitionPayload
  );

  const { data: identity, error: identityError } = await supabase
    .schema("app")
    .from("strategy_object_identities")
    .insert({
      organization_id: input.organizationId,
      object_type: input.objectType,
      lifecycle_state: identityLifecycle,
      created_by_membership_id: input.createdByMembershipId ?? null,
    })
    .select("id")
    .single();

  if (identityError || !identity?.id) {
    throw new Error(identityError?.message ?? "strategy-object-identity-insert-failed");
  }

  const { error: revisionError } = await supabase.schema("app").from("strategy_object_revisions").insert({
    id: input.revisionId,
    object_identity_id: identity.id,
    organization_id: input.organizationId,
    cycle_instance_id: input.cycleInstanceId,
    revision_number: 1,
    revision_state: revisionState,
    title: input.title,
    description: input.description,
    definition_payload: input.definitionPayload,
    definition_hash: definitionHash,
    legacy_status: null,
    created_by_membership_id: input.createdByMembershipId ?? null,
  });

  if (revisionError) {
    throw new Error(revisionError.message);
  }

  await supabase.schema("app").from("strategy_object_migration_map").insert({
    organization_id: input.organizationId,
    legacy_table: LEGACY_TABLE_BY_TYPE[input.objectType],
    legacy_id: input.revisionId,
    object_identity_id: identity.id,
    revision_id: input.revisionId,
    legacy_id_preserved: true,
  });
}
