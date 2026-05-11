import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvValue(key, envRaw) {
  const match = envRaw.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function loadSupabaseConfig() {
  const envPath = path.join(process.cwd(), ".env.local");
  const envRaw = readFileSync(envPath, "utf8");
  const url = loadEnvValue("NEXT_PUBLIC_SUPABASE_URL", envRaw);
  const serviceRoleKey = loadEnvValue("SUPABASE_SERVICE_ROLE_KEY", envRaw);
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt in web/.env.local");
  }
  return { url, serviceRoleKey };
}

async function main() {
  const { url, serviceRoleKey } = loadSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: organizations, error: orgError } = await supabase
    .schema("app")
    .from("organizations")
    .select("id");
  if (orgError) throw orgError;
  if (!organizations?.length) {
    console.log("Keine Organisationen gefunden.");
    return;
  }

  const payload = organizations.map((org) => ({
    organization_id: org.id,
    ai_enabled: true,
    local_llm_enabled: true,
    external_models_enabled: false,
    web_search_enabled: false,
    write_actions_enabled: false,
  }));

  const { error: upsertError } = await supabase
    .schema("app")
    .from("ai_admin_settings")
    .upsert(payload, { onConflict: "organization_id" });
  if (upsertError) throw upsertError;

  console.log(`ai_admin_settings upserted: ${payload.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
