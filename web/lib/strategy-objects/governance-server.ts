import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertStrategyObjectDefinitionEditableRpc } from "./write";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function assertStrategyObjectDefinitionEditable(
  supabase: SupabaseClient,
  revisionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await assertStrategyObjectDefinitionEditableRpc(supabase, revisionId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
