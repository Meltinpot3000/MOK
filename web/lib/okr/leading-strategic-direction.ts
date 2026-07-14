import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveOkrStrategicDirection } from "@/lib/change-run/change-run-model";

type Supabase = SupabaseClient;

function unwrapJoinedRow<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Führende Stoßrichtung eines OKR-Objectives — abgeleitet über Change-Anker, Legacy-Fallback. */
export async function fetchLeadingStrategicDirectionIdForOkr(
  supabase: Supabase,
  organizationId: string,
  cycleInstanceId: string,
  okrObjectiveId: string
): Promise<string | null> {
  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("leading_strategic_direction_id")
    .eq("id", okrObjectiveId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const { data: atLinks } = await supabase
    .schema("app")
    .from("annual_target_okr_objective_links")
    .select(
      "annual_target_id, annual_targets(strategy_program_id, strategic_direction_id, strategy_programs(strategic_direction_id))"
    )
    .eq("okr_objective_id", okrObjectiveId)
    .eq("organization_id", organizationId);

  const changeAnnualTargetLinks = (atLinks ?? []).map((row) => {
    const at = unwrapJoinedRow(
      row.annual_targets as unknown as
        | {
            strategy_program_id: string | null;
            strategic_direction_id: string | null;
            strategy_programs: { strategic_direction_id: string | null } | null;
          }
        | Array<{
            strategy_program_id: string | null;
            strategic_direction_id: string | null;
            strategy_programs: { strategic_direction_id: string | null } | null;
          }>
        | null
    );
    const program = unwrapJoinedRow(at?.strategy_programs ?? null);
    return {
      annualTargetId: String(row.annual_target_id),
      strategyProgramId: at?.strategy_program_id ?? null,
      strategicDirectionId: at?.strategic_direction_id ?? null,
      programDirectionId: program?.strategic_direction_id ?? null,
    };
  });

  const { data: krLinks } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .select(
      "initiative_id, key_result_id, initiatives(program_id, strategy_programs(strategic_direction_id))"
    )
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId);

  const { data: objectiveKrs } = await supabase
    .schema("app")
    .from("key_results")
    .select("id")
    .eq("okr_objective_id", okrObjectiveId)
    .eq("organization_id", organizationId);

  const krIdSet = new Set((objectiveKrs ?? []).map((r) => String(r.id)));
  const krInitiativeLinks = (krLinks ?? [])
    .filter((row) => krIdSet.has(String(row.key_result_id)))
    .map((row) => {
      const init = unwrapJoinedRow(
        row.initiatives as unknown as
          | {
              program_id: string | null;
              strategy_programs: { strategic_direction_id: string | null } | null;
            }
          | Array<{
              program_id: string | null;
              strategy_programs: { strategic_direction_id: string | null } | null;
            }>
          | null
      );
      const program = unwrapJoinedRow(init?.strategy_programs ?? null);
      return {
        initiativeId: String(row.initiative_id),
        programDirectionId: program?.strategic_direction_id ?? null,
      };
    });

  const derived = deriveOkrStrategicDirection({
    leadingStrategicDirectionId:
      (obj?.leading_strategic_direction_id as string | null | undefined) ?? null,
    changeAnnualTargetLinks,
    krInitiativeLinks,
  });
  if (derived.directionId) return derived.directionId;

  const { data: junctionRows } = await supabase
    .schema("app")
    .from("okr_objective_strategy_objectives")
    .select("strategy_objective_id")
    .eq("okr_objective_id", okrObjectiveId)
    .limit(1);
  const strategyObjectiveId = junctionRows?.[0]?.strategy_objective_id;
  if (!strategyObjectiveId) return null;

  const { data: link } = await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .select("strategic_direction_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("strategy_objective_id", strategyObjectiveId)
    .limit(1)
    .maybeSingle();

  return (link?.strategic_direction_id as string | undefined) ?? null;
}
