import type { SignatureRequestPayload } from "@/lib/annual-targets/signature/types";

export function buildAnnualTargetDocumentPayload(input: {
  title: string;
  targetYear: number;
  ownerDisplayName: string;
  directionTitle: string;
  strategicObjectiveTitle: string | null;
  programTitle: string | null;
  description: string;
  measurementLogic: string;
  baseline: number | null;
  currentMeasure: number | null;
  progressMode: string;
  annualTargetType: string;
  bonusWeight: number | null;
  derivationNote: string | null;
}): SignatureRequestPayload & Record<string, unknown> {
  return {
    title: input.title,
    targetYear: input.targetYear,
    ownerDisplayName: input.ownerDisplayName,
    directionTitle: input.directionTitle,
    strategicObjectiveTitle: input.strategicObjectiveTitle,
    programTitle: input.programTitle,
    description: input.description,
    measurementLogic: input.measurementLogic,
    derivationNote: input.derivationNote,
    baseline: input.baseline,
    currentMeasure: input.currentMeasure,
    progressMode: input.progressMode,
    annualTargetType: input.annualTargetType,
    bonusWeight: input.bonusWeight,
  };
}
