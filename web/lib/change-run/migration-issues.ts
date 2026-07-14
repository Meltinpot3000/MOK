import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ChangeRunMigrationIssueRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  issue_code: string;
  detail: string | null;
};

export async function fetchChangeRunMigrationIssues(
  organizationId: string,
  cycleInstanceId?: string
): Promise<ChangeRunMigrationIssueRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .schema("app")
    .from("change_run_migration_issues")
    .select("id, entity_type, entity_id, issue_code, detail")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (cycleInstanceId) {
    query = query.eq("cycle_instance_id", cycleInstanceId);
  }
  const { data } = await query;
  return (data ?? []) as ChangeRunMigrationIssueRow[];
}

export const CHANGE_RUN_ISSUE_LABELS_DE: Record<string, string> = {
  missing_program_id: "Initiative ohne Programm — Nachpflege erforderlich",
  active_initiative_inactive_program: "Aktive Initiative an nicht-freigegebenem Programm",
  active_change_target_inactive_program: "Aktives Change-Jahresziel an nicht-freigegebenem Programm",
  no_change_anchor: "OKR ohne Change-Anker (JZ oder Initiative/Programm)",
};
