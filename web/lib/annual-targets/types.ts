import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects";

export const ANNUAL_TARGET_LIFECYCLE_STATUSES = [
  "draft",
  "submitted_for_review",
  "reviewed",
  "approved",
  "sent_for_signature",
  "signed",
  "active",
  "change_requested",
  "superseded",
  "archived",
] as const;

export type AnnualTargetLifecycleStatus = (typeof ANNUAL_TARGET_LIFECYCLE_STATUSES)[number];

export const ANNUAL_TARGET_SIGNATURE_STATUSES = [
  "not_required",
  "pending",
  "sent",
  "partially_signed",
  "signed",
  "rejected",
  "cancelled",
  "expired",
  "failed",
] as const;

export type AnnualTargetSignatureStatus = (typeof ANNUAL_TARGET_SIGNATURE_STATUSES)[number];

export const ANNUAL_TARGET_TYPES = [
  "bonus_relevant",
  "strategic_commitment",
  "operational_target",
  "compliance_target",
  "development_target",
] as const;

export type AnnualTargetType = (typeof ANNUAL_TARGET_TYPES)[number];

export const PROGRESS_CALCULATION_MODES = [
  "manual",
  "key_result_based",
  "initiative_based",
  "hybrid",
] as const;

export type ProgressCalculationMode = (typeof PROGRESS_CALCULATION_MODES)[number];

/** SMART-Bewertung (Sentinel), persistiert in annual_targets.smart_check. */
export type AnnualTargetSmartCheck = {
  specific: boolean;
  measurable: boolean;
  achievable: boolean;
  relevant: boolean;
  time_bound: boolean;
};

export const SMART_DIMENSION_KEYS = [
  "specific",
  "measurable",
  "achievable",
  "relevant",
  "time_bound",
] as const satisfies readonly (keyof AnnualTargetSmartCheck)[];

export const SMART_DIMENSION_LABELS_DE: Record<keyof AnnualTargetSmartCheck, string> = {
  specific: "Spezifisch",
  measurable: "Messbar",
  achievable: "Erreichbar",
  relevant: "Relevant",
  time_bound: "Terminiert",
};

export type AnnualTargetRow = {
  id: string;
  organization_id: string;
  cycle_instance_id: string;
  planning_cycle_id: string | null;
  strategic_direction_id: string;
  strategy_program_id: string | null;
  title: string;
  description: string | null;
  measurement_logic: string;
  baseline: number | null;
  current_measure: number | null;
  progress_percent: number;
  target_year: number | null;
  annual_target_type: AnnualTargetType;
  progress_calculation_mode: ProgressCalculationMode;
  bonus_weight: number | null;
  owner_membership_id: string | null;
  created_by_membership_id: string | null;
  derivation_note: string | null;
  status: AnnualTargetLifecycleStatus;
  signature_status: AnnualTargetSignatureStatus;
  comment: string | null;
  is_primary: boolean;
  ai_assisted: boolean;
  ai_model_provider: string | null;
  ai_generated_at: string | null;
  smart_check: AnnualTargetSmartCheck | null;
  updated_at: string;
};

export type AnnualTargetPlanningRow = AnnualTargetRow & {
  directionTitle: string;
  programTitle: string | null;
  strategicObjectiveTitle: string | null;
  strategicObjectiveId: string | null;
  ownerDisplayName: string;
  okrAlignmentLabel: string;
  okrLinkCount: number;
  initiativeLinkCount: number;
};

export type AnnualTargetWorkspaceContext = {
  directions: { id: string; title: string; versioning?: StrategyObjectVersioningMeta | null }[];
  programs: { id: string; title: string }[];
  strategicObjectives: { id: string; title: string; versioning?: StrategyObjectVersioningMeta | null }[];
  ownerOptions: { membershipId: string; fullName: string }[];
  /** Team-Tab: nur Unterstellte (rekursiv), unabhängig von write.all. */
  teamOwnerOptions: { membershipId: string; fullName: string }[];
  canPickOwner: boolean;
  defaultOwnerMembershipId: string;
  orgSignatureSettings: OrgAnnualTargetSignatureSettings;
};

export type OrgAnnualTargetSignatureSettings = {
  requireSignature: boolean;
  signatureMode: "none" | "internal_acknowledgement" | "external_signature";
  activationRequiresSignedStatus: boolean;
};

export type AnnualTargetsTab = "mine" | "team";

export type AnnualTargetsFilters = {
  targetYear?: number | null;
  ownerMembershipId?: string | null;
  strategicDirectionId?: string | null;
  strategicObjectiveId?: string | null;
  status?: AnnualTargetLifecycleStatus | null;
  annualTargetType?: AnnualTargetType | null;
  okrAlignment?: "aligned" | "not_aligned" | "all";
};

/** Kurzlabels fürs Dropdown «Fortschrittsmodus». */
export const PROGRESS_CALCULATION_MODE_LABELS_DE: Record<ProgressCalculationMode, string> = {
  manual: "Manuell am Jahresziel",
  key_result_based: "Aus verknüpften OKR-Key Results",
  initiative_based: "Aus verknüpften Initiativen",
  hybrid: "Kombination (manuell + OKR/Initiativen)",
};

/** Erläuterung: was «Anker» im Dashboard/Strategieprofil meint — messbare Umsetzungsquellen. */
export const PROGRESS_CALCULATION_MODE_HINTS_DE: Record<ProgressCalculationMode, string> = {
  manual:
    "Sie pflegen den Fortschritt (%) direkt am Jahresziel — unabhängig von OKRs und Initiativen.",
  key_result_based:
    "Fortschritt soll aus OKR-Key Results stammen, die per Traceability mit diesem Jahresziel verknüpft sind.",
  initiative_based:
    "Fortschritt soll aus Initiativen stammen, die zur Stoßrichtung bzw. zum Programm des Jahresziels gehören.",
  hybrid:
    "Teils manuell am Jahresziel, teils aus verknüpften OKR-Key Results und/oder Initiativen (gewichteter Mix in Auswertungen).",
};

/** Freitext: wie das Jahresziel aus Strategieelementen folgt (Feld derivation_note). */
export const ANNUAL_TARGET_DERIVATION_NOTE_LABEL_DE = "Strategische Herleitung";
export const ANNUAL_TARGET_DERIVATION_NOTE_HINT_DE =
  "Kurz erklären, wie dieses Jahresziel aus der gewählten Stoßrichtung bzw. dem strategischen Ziel folgt.";

export const ANNUAL_TARGET_BASELINE_LABEL_DE = "Ausgangswert";
export const ANNUAL_TARGET_BASELINE_HINT_DE =
  "Numerischer Startwert der Kennzahl zu Beginn des Jahresziels (z. B. Umsatzstand zu Jahresstart).";

export const ANNUAL_TARGET_CURRENT_MEASURE_LABEL_DE = "Aktueller Ist-Wert";
export const ANNUAL_TARGET_CURRENT_MEASURE_HINT_DE =
  "Zuletzt gemessener Wert derselben Kennzahl — Grundlage für die Fortschrittsbewertung.";

export const ANNUAL_TARGET_TYPE_LABELS_DE: Record<AnnualTargetType, string> = {
  bonus_relevant: "Bonusrelevant",
  strategic_commitment: "Strategisches Commitment",
  operational_target: "Operatives Ziel",
  compliance_target: "Compliance-Ziel",
  development_target: "Entwicklungsziel",
};

export const LIFECYCLE_STATUS_LABELS_DE: Record<AnnualTargetLifecycleStatus, string> = {
  draft: "Entwurf",
  submitted_for_review: "Zur Prüfung",
  reviewed: "Geprüft",
  approved: "Freigegeben",
  sent_for_signature: "Zur Signatur",
  signed: "Signiert",
  active: "Aktiv",
  change_requested: "Änderung angefordert",
  superseded: "Ersetzt",
  archived: "Archiviert",
};
