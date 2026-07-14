import {
  classifyAnnualTargetExecutionMode,
} from "@/lib/change-run/change-run-model";
import type {
  AnnualTargetLifecycleStatus,
  AnnualTargetSmartFormulation,
  AnnualTargetType,
  OrgAnnualTargetSignatureSettings,
  ProgressCalculationMode,
} from "@/lib/annual-targets/types";

export type AnnualTargetFormPayload = {
  title: string;
  targetYear: number;
  ownerMembershipId: string;
  strategicDirectionId: string;
  description: string;
  measurementLogic: string;
  progressPercent: number;
  status: AnnualTargetLifecycleStatus;
  annualTargetType: AnnualTargetType;
  progressCalculationMode: ProgressCalculationMode;
  derivationNote: string;
  strategicObjectiveId: string | null;
  strategyProgramId: string | null;
  bonusWeight: number | null;
  baseline: number | null;
  currentMeasure: number | null;
  smartFormulation: AnnualTargetSmartFormulation;
  executionMode: "run" | "change";
};

export type ValidationIssue = { field: string; message: string; severity: "error" | "warning" };

export function validateAnnualTargetDraft(payload: AnnualTargetFormPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!payload.title.trim()) {
    issues.push({ field: "title", message: "Titel ist erforderlich.", severity: "error" });
  }
  if (!Number.isFinite(payload.targetYear)) {
    issues.push({ field: "targetYear", message: "Zieljahr ist erforderlich.", severity: "error" });
  }
  if (!payload.ownerMembershipId.trim()) {
    issues.push({ field: "ownerMembershipId", message: "Ziel-Owner ist erforderlich.", severity: "error" });
  }

  const mode =
    payload.executionMode ||
    classifyAnnualTargetExecutionMode(payload.strategyProgramId);

  if (mode === "run") {
    if (!payload.strategicDirectionId.trim()) {
      issues.push({
        field: "strategicDirectionId",
        message: "Stoßrichtung ist für Run-Jahresziele erforderlich.",
        severity: "error",
      });
    }
    if (payload.strategyProgramId?.trim()) {
      issues.push({
        field: "strategyProgramId",
        message: "Run-Jahresziele dürfen kein Programm haben.",
        severity: "error",
      });
    }
  } else {
    if (!payload.strategyProgramId?.trim()) {
      issues.push({
        field: "strategyProgramId",
        message: "Programm ist für Change-Jahresziele erforderlich.",
        severity: "error",
      });
    }
    if (!payload.strategicDirectionId.trim()) {
      issues.push({
        field: "strategicDirectionId",
        message: "Stoßrichtung konnte nicht aus dem Programm abgeleitet werden.",
        severity: "error",
      });
    }
  }

  if (mode === "run" && payload.progressCalculationMode === "key_result_based") {
    issues.push({
      field: "progressCalculationMode",
      message: "Run-Jahresziele dürfen nicht OKR-basiert fortgeschrieben werden.",
      severity: "error",
    });
  }

  return issues;
}

export function validateAnnualTargetActivation(
  payload: AnnualTargetFormPayload,
  signatureSettings: OrgAnnualTargetSignatureSettings,
  signatureStatus: string
): ValidationIssue[] {
  const issues = validateAnnualTargetDraft(payload).filter((i) => i.severity === "error");
  if (!payload.measurementLogic.trim() && !payload.smartFormulation.measurable.trim()) {
    issues.push({
      field: "measurementLogic",
      message: "Messbar (M) ist für die Aktivierung erforderlich.",
      severity: "error",
    });
  }
  if (!payload.description.trim() && !payload.smartFormulation.specific.trim()) {
    issues.push({
      field: "description",
      message: "Spezifisch (S) ist für die Aktivierung erforderlich.",
      severity: "error",
    });
  }
  if (
    signatureSettings.requireSignature &&
    signatureSettings.activationRequiresSignedStatus &&
    signatureStatus !== "signed"
  ) {
    issues.push({
      field: "signature_status",
      message: "Signatur muss abgeschlossen sein, bevor das Jahresziel aktiv werden kann.",
      severity: "error",
    });
  }
  if (
    classifyAnnualTargetExecutionMode(payload.strategyProgramId) === "change" &&
    payload.status === "active"
  ) {
    issues.push({
      field: "strategyProgramId",
      message:
        "Aktive Change-Jahresziele benötigen ein freigegebenes (active) Programm — bitte zuerst Programm aktivieren.",
      severity: "warning",
    });
  }
  return issues;
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
