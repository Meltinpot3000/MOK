import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchVersioningMetaForRevisionId } from "@/lib/strategy-objects/queries";
import {
  isStrategicDirectionEligibleForAnnualTargetLink,
  isStrategicObjectiveEligibleForAnnualTargetLink,
  isStrategyProgramEligibleForAnnualTargetLink,
} from "@/lib/annual-targets/alignment-eligibility";

export async function assertAnnualTargetAlignmentRefsEligible(params: {
  organizationId: string;
  cycleInstanceId: string;
  strategicDirectionId: string;
  strategyProgramId: string | null;
  strategicObjectiveId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const directionVersioning = await fetchVersioningMetaForRevisionId(
    params.organizationId,
    params.cycleInstanceId,
    params.strategicDirectionId,
    { supabase }
  );

  if (!isStrategicDirectionEligibleForAnnualTargetLink(directionVersioning)) {
    return {
      ok: false,
      error: "Stoßrichtung ist nicht aktiv und kann nicht verknüpft werden.",
    };
  }

  if (params.strategyProgramId) {
    const { data: program } = await supabase
      .schema("app")
      .from("strategy_programs")
      .select("status")
      .eq("id", params.strategyProgramId)
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleInstanceId)
      .maybeSingle();

    if (!program || !isStrategyProgramEligibleForAnnualTargetLink(program.status as string)) {
      return {
        ok: false,
        error: "Programm ist nicht aktiv und kann nicht verknüpft werden.",
      };
    }
  }

  if (params.strategicObjectiveId) {
    const objectiveVersioning = await fetchVersioningMetaForRevisionId(
      params.organizationId,
      params.cycleInstanceId,
      params.strategicObjectiveId,
      { supabase }
    );

    if (!isStrategicObjectiveEligibleForAnnualTargetLink(objectiveVersioning)) {
      return {
        ok: false,
        error: "Strategisches Ziel ist nicht aktiv und kann nicht verknüpft werden.",
      };
    }
  }

  return { ok: true };
}
