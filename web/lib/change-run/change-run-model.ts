/**
 * Change/Run-Umsetzungsmodell: Klassifikation und Richtungsableitung.
 */

export type AnnualTargetExecutionMode = "run" | "change";

export type ChangeRunMigrationIssueCode =
  | "missing_program_id"
  | "active_initiative_inactive_program"
  | "active_change_target_inactive_program"
  | "no_change_anchor";

export function classifyAnnualTargetExecutionMode(
  strategyProgramId: string | null | undefined
): AnnualTargetExecutionMode {
  return strategyProgramId ? "change" : "run";
}

export function isRunAnnualTarget(strategyProgramId: string | null | undefined): boolean {
  return !strategyProgramId;
}

export function isChangeAnnualTarget(strategyProgramId: string | null | undefined): boolean {
  return Boolean(strategyProgramId);
}

/** Programme wählbar für Planung (draft/planned Initiative oder Change-JZ in Vorbereitung). */
export const PROGRAM_STATUSES_FOR_PLANNING = ["draft", "on_hold", "active"] as const;

/** Programme erforderlich für aktive Change-Umsetzung. */
export const PROGRAM_STATUS_FOR_ACTIVE_CHANGE = "active" as const;

export function isProgramSelectableForPlanning(programStatus: string): boolean {
  return (PROGRAM_STATUSES_FOR_PLANNING as readonly string[]).includes(programStatus);
}

export function isProgramRequiredForActiveChange(programStatus: string): boolean {
  return programStatus === PROGRAM_STATUS_FOR_ACTIVE_CHANGE;
}

export type ProgramGateContext = {
  initiativeStatus?: string;
  annualTargetStatus?: string;
  linkingOkr?: boolean;
};

export function assertProgramGateForInitiative(
  programStatus: string,
  initiativeStatus: string
): string | null {
  if (programStatus === "closed") return "initiative-program-closed";
  if (["active", "at_risk"].includes(initiativeStatus)) {
    if (programStatus !== "active") return "active-initiative-needs-active-program";
  } else if (["draft", "planned"].includes(initiativeStatus)) {
    if (!isProgramSelectableForPlanning(programStatus)) {
      return "planned-initiative-needs-draft-or-active-program";
    }
  }
  return null;
}

export type DerivedStrategicDirection = {
  directionId: string | null;
  source: "change_annual_target" | "initiative_program" | "legacy_direct" | "unresolved";
  warning?: ChangeRunMigrationIssueCode;
};

export type OkrDirectionDerivationInput = {
  leadingStrategicDirectionId: string | null;
  changeAnnualTargetLinks: Array<{
    annualTargetId: string;
    strategicDirectionId: string | null;
    strategyProgramId: string | null;
    programDirectionId: string | null;
  }>;
  krInitiativeLinks: Array<{
    initiativeId: string;
    programDirectionId: string | null;
  }>;
};

/**
 * OKR-Stoßrichtung read-only ableiten:
 * a) Change-JZ → Programm → Stoßrichtung
 * b) KR → Initiative → Programm → Stoßrichtung
 * Legacy: bestehendes leading_strategic_direction_id als Fallback.
 */
export function deriveOkrStrategicDirection(
  input: OkrDirectionDerivationInput
): DerivedStrategicDirection {
  for (const link of input.changeAnnualTargetLinks) {
    if (!link.strategyProgramId) continue;
    const dir = link.programDirectionId ?? link.strategicDirectionId;
    if (dir) {
      return { directionId: dir, source: "change_annual_target" };
    }
  }

  const krDirections = new Set(
    input.krInitiativeLinks
      .map((l) => l.programDirectionId)
      .filter((d): d is string => Boolean(d))
  );
  if (krDirections.size === 1) {
    return { directionId: [...krDirections][0]!, source: "initiative_program" };
  }
  if (krDirections.size > 1) {
    return { directionId: null, source: "unresolved", warning: "no_change_anchor" };
  }

  if (input.leadingStrategicDirectionId) {
    return {
      directionId: input.leadingStrategicDirectionId,
      source: "legacy_direct",
      warning: "no_change_anchor",
    };
  }

  return { directionId: null, source: "unresolved", warning: "no_change_anchor" };
}
