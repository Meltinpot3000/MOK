import type {
  AnnualTargetAnchorFit,
  AnnualTargetSmartCheck,
  AnnualTargetSmartFormulation,
  AnnualTargetSmartProposal,
} from "@/lib/annual-targets/types";
import { emptySmartFormulation, SMART_DIMENSION_KEYS } from "@/lib/annual-targets/types";
import { normalizeOkrContributionTier } from "@/lib/strategy-cycle/coverage-level";

export function parseAnnualTargetSmartCheck(raw: unknown): AnnualTargetSmartCheck | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!SMART_DIMENSION_KEYS.every((k) => typeof o[k] === "boolean")) return null;
  return {
    specific: o.specific as boolean,
    measurable: o.measurable as boolean,
    achievable: o.achievable as boolean,
    relevant: o.relevant as boolean,
    time_bound: o.time_bound as boolean,
  };
}

export function parseAnnualTargetSmartFormulation(
  raw: unknown,
  fallback?: { description?: string | null; measurementLogic?: string | null }
): AnnualTargetSmartFormulation {
  const base = emptySmartFormulation();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of SMART_DIMENSION_KEYS) {
      if (typeof o[key] === "string") base[key] = (o[key] as string).trim();
    }
  }
  if (!base.specific && fallback?.description) {
    base.specific = String(fallback.description).trim();
  }
  if (!base.measurable && fallback?.measurementLogic) {
    base.measurable = String(fallback.measurementLogic).trim();
  }
  return base;
}

export function parseAnnualTargetSmartProposal(raw: unknown): AnnualTargetSmartProposal | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const formulation = parseAnnualTargetSmartFormulation(o.formulation ?? o.smart_formulation);
  const smartCheck = parseAnnualTargetSmartCheck(o.smart_check) ?? {
    specific: false,
    measurable: false,
    achievable: false,
    relevant: false,
    time_bound: false,
  };
  const notes = Array.isArray(o.improvement_notes)
    ? o.improvement_notes.filter((n): n is string => typeof n === "string")
    : [];
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const hasFormulation = SMART_DIMENSION_KEYS.some((k) => formulation[k].trim());
  if (!title && !hasFormulation) return null;
  return {
    title,
    formulation,
    smart_check: smartCheck,
    improvement_notes: notes,
    generated_at:
      typeof o.generated_at === "string" && o.generated_at.trim()
        ? o.generated_at
        : new Date().toISOString(),
  };
}

export function parseAnnualTargetAnchorFit(raw: unknown): AnnualTargetAnchorFit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const anchorType = o.anchor_type;
  if (anchorType !== "strategic_direction" && anchorType !== "strategy_program") return null;
  const anchorId = typeof o.anchor_id === "string" ? o.anchor_id.trim() : "";
  if (!anchorId) return null;
  return {
    anchor_type: anchorType,
    anchor_id: anchorId,
    anchor_title: typeof o.anchor_title === "string" ? o.anchor_title : "",
    overall_level: normalizeOkrContributionTier(String(o.overall_level ?? "")),
    alignment_level: normalizeOkrContributionTier(String(o.alignment_level ?? "")),
    formulation_level: normalizeOkrContributionTier(String(o.formulation_level ?? "")),
    reason: typeof o.reason === "string" ? o.reason.trim() : "",
    improvement_hint:
      typeof o.improvement_hint === "string" && o.improvement_hint.trim()
        ? o.improvement_hint.trim()
        : null,
    assessed_at:
      typeof o.assessed_at === "string" && o.assessed_at.trim()
        ? o.assessed_at
        : new Date().toISOString(),
  };
}

/** description/measurement_logic aus SMART ableiten (Downstream & Aktivierung). */
export function composeDescriptionFromSmart(smart: AnnualTargetSmartFormulation): string {
  return [smart.specific, smart.achievable, smart.relevant, smart.time_bound]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function composeMeasurementLogicFromSmart(smart: AnnualTargetSmartFormulation): string {
  return smart.measurable.trim();
}

export function smartDimensionMark(ok: boolean | undefined): string {
  if (ok === true) return "✓";
  if (ok === false) return "—";
  return "·";
}

export function proposalHasPendingField(
  proposal: AnnualTargetSmartProposal | null | undefined,
  field: "title" | keyof AnnualTargetSmartFormulation
): boolean {
  if (!proposal) return false;
  if (field === "title") return Boolean(proposal.title.trim());
  return Boolean(proposal.formulation[field]?.trim());
}
