import { redirect } from "next/navigation";

import { AdminSettingsForm } from "@/components/ai/AdminSettingsForm";
import { DEFAULT_AI_ADMIN_SETTINGS } from "@/lib/ai/security/policy-engine";
import { getCurrentUserAccessContext } from "@/lib/rbac/user-access-context";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DbRow = {
  organization_id: string;
  ai_enabled: boolean;
  local_llm_enabled: boolean;
  external_models_enabled: boolean;
  web_search_enabled: boolean;
  write_actions_enabled: boolean;
  require_human_approval: boolean;
  default_local_model: string | null;
  default_fast_model: string | null;
  default_frontier_model: string | null;
  max_tool_calls_per_run: number;
  max_context_objects: number;
  log_prompts: boolean;
  log_responses: boolean;
  log_tool_calls: boolean;
};

export default async function AiAssistantAdminPage() {
  const access = await getSidebarAccessContext("ai-assistant");
  if (access.state === "unauthenticated") redirect("/login");
  if (access.state === "forbidden") redirect("/no-access");

  const userContext = await getCurrentUserAccessContext({
    requireCapability: "ai.admin_settings.write",
  });
  if (!userContext) redirect("/no-access");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("ai_admin_settings")
    .select(
      "organization_id, ai_enabled, local_llm_enabled, external_models_enabled, web_search_enabled, write_actions_enabled, require_human_approval, default_local_model, default_fast_model, default_frontier_model, max_tool_calls_per_run, max_context_objects, log_prompts, log_responses, log_tool_calls"
    )
    .eq("organization_id", userContext.organizationId)
    .maybeSingle();

  const initial = (data as DbRow | null) ?? {
    organization_id: userContext.organizationId,
    ai_enabled: DEFAULT_AI_ADMIN_SETTINGS.aiEnabled,
    local_llm_enabled: DEFAULT_AI_ADMIN_SETTINGS.localLlmEnabled,
    external_models_enabled: DEFAULT_AI_ADMIN_SETTINGS.externalModelsEnabled,
    web_search_enabled: DEFAULT_AI_ADMIN_SETTINGS.webSearchEnabled,
    write_actions_enabled: DEFAULT_AI_ADMIN_SETTINGS.writeActionsEnabled,
    require_human_approval: DEFAULT_AI_ADMIN_SETTINGS.requireHumanApproval,
    default_local_model: DEFAULT_AI_ADMIN_SETTINGS.defaultLocalModel,
    default_fast_model: DEFAULT_AI_ADMIN_SETTINGS.defaultFastModel,
    default_frontier_model: DEFAULT_AI_ADMIN_SETTINGS.defaultFrontierModel,
    max_tool_calls_per_run: DEFAULT_AI_ADMIN_SETTINGS.maxToolCallsPerRun,
    max_context_objects: DEFAULT_AI_ADMIN_SETTINGS.maxContextObjects,
    log_prompts: DEFAULT_AI_ADMIN_SETTINGS.logPrompts,
    log_responses: DEFAULT_AI_ADMIN_SETTINGS.logResponses,
    log_tool_calls: DEFAULT_AI_ADMIN_SETTINGS.logToolCalls,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">Sentinel Assistant – Admin</h1>
        <p className="text-sm text-zinc-600">
          Tenant-spezifische Konfiguration fuer Sentinel Core, externe Modelle, Web-Suche und Logging.
        </p>
      </header>
      <AdminSettingsForm initial={initial} organizationName={userContext.organizationName} />
    </div>
  );
}
