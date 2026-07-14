import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchDirectionsForCycle } from "@/lib/strategy-objects/queries";
import { isStrategyProgramEligibleForAnnualTargetLink } from "@/lib/annual-targets/alignment-eligibility";

/**
 * Alignment-Check analog zur Dropdown-Auswahl:
 * Stoßrichtung/Programm müssen im Zyklus existieren und die gleiche Planungs-Eligibility
 * erfüllen wie in der UI — keine strengere View-only-Prüfung.
 */
export async function assertAnnualTargetAlignmentRefsEligible(params: {
  organizationId: string;
  cycleInstanceId: string;
  strategicDirectionId: string;
  strategyProgramId: string | null;
  strategicObjectiveId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  if (params.strategyProgramId) {
    const { data: program } = await supabase
      .schema("app")
      .from("strategy_programs")
      .select("id, status, strategic_direction_id")
      .eq("id", params.strategyProgramId)
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleInstanceId)
      .maybeSingle();

    if (!program || !isStrategyProgramEligibleForAnnualTargetLink(program.status as string)) {
      return {
        ok: false,
        error: "Programm ist für die Jahresziel-Planung nicht wählbar.",
      };
    }

    // Change: Stoßrichtung folgt dem Programm — Lifecycle der Stoßrichtung nicht zusätzlich sperren.
    const programDirectionId = String(program.strategic_direction_id ?? "").trim();
    if (
      params.strategicDirectionId &&
      programDirectionId &&
      params.strategicDirectionId !== programDirectionId
    ) {
      return {
        ok: false,
        error: "Stoßrichtung stimmt nicht mit dem gewählten Programm überein.",
      };
    }

    return { ok: true };
  }

  if (!params.strategicDirectionId.trim()) {
    return { ok: false, error: "Stoßrichtung ist erforderlich." };
  }

  const directions = await fetchDirectionsForCycle(
    params.organizationId,
    params.cycleInstanceId,
    { supabase }
  );
  const selected = directions.find((d) => d.id === params.strategicDirectionId);
  if (selected) return { ok: true };

  // Fallback: Legacy-Zeile im Zyklus ohne Revisions-View
  const { data: legacyDir } = await supabase
    .schema("app")
    .from("strategic_directions")
    .select("id")
    .eq("id", params.strategicDirectionId)
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleInstanceId)
    .maybeSingle();
  if (legacyDir?.id) return { ok: true };

  return {
    ok: false,
    error: "Stoßrichtung gehört nicht zu diesem Planungszyklus.",
  };
}
