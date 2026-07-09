"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isLifecycleTransitionAllowed,
  normalizeLifecycleTarget,
} from "@/lib/strategy-objects/lifecycle";
import { getWorkspaceContextOrRedirectFromActions } from "./action-context";

const LEGACY_TABLE_BY_TYPE: Record<string, string> = {
  strategic_objective: "strategy_objectives",
  strategic_challenge: "strategic_challenges",
  strategic_direction: "strategic_directions",
};

function appendQuery(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

/**
 * Portfolio-Lifecycle wechseln: draft→active, active→inactive, inactive→active|retired.
 * retired ist endgültig. Aktualisiert die Identity und synchronisiert – wo sinnvoll –
 * den Legacy-Status der aktuellen Revision.
 */
export async function setStrategyObjectLifecycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirectFromActions();
  const identityId = String(formData.get("identity_id") ?? "").trim();
  const target = normalizeLifecycleTarget(formData.get("target"));
  const returnPath =
    String(formData.get("return_path") ?? "/strategy-cycle").trim() || "/strategy-cycle";
  const noRedirect = formData.get("_noRedirect") === "1";

  if (!identityId || !target) {
    redirect(appendQuery(returnPath, "error", "lifecycle-invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: identity } = await supabase
    .schema("app")
    .from("strategy_object_identities")
    .select("id, object_type, lifecycle_state")
    .eq("organization_id", context.organizationId)
    .eq("id", identityId)
    .maybeSingle();

  if (!identity) {
    redirect(appendQuery(returnPath, "error", "lifecycle-not-found"));
  }

  if (!isLifecycleTransitionAllowed(identity.lifecycle_state, target)) {
    redirect(appendQuery(returnPath, "error", "lifecycle-transition-invalid"));
  }

  const { error: updateError } = await supabase
    .schema("app")
    .from("strategy_object_identities")
    .update({ lifecycle_state: target })
    .eq("organization_id", context.organizationId)
    .eq("id", identityId);

  if (updateError) {
    redirect(appendQuery(returnPath, "error", "lifecycle-update-failed"));
  }

  const legacyStatus = target === "active" ? "active" : target === "retired" ? "archived" : null;
  const legacyTable = LEGACY_TABLE_BY_TYPE[String(identity.object_type)];
  if (legacyStatus && legacyTable) {
    const { data: current } = await supabase
      .schema("app")
      .from("v_current_strategy_objects")
      .select("revision_id")
      .eq("organization_id", context.organizationId)
      .eq("object_identity_id", identityId)
      .maybeSingle();
    if (current?.revision_id) {
      await supabase
        .schema("app")
        .from(legacyTable)
        .update({ status: legacyStatus })
        .eq("organization_id", context.organizationId)
        .eq("id", current.revision_id);
    }
  }

  revalidatePath("/strategy-cycle");
  revalidatePath("/strategy-matrix");
  if (noRedirect) return;
  redirect(appendQuery(returnPath, "success", `lifecycle-${target}`));
}
