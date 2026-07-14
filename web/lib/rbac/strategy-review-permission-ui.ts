/**
 * Kuratierte UI-Metadaten für Strategie-Review-Capabilities (analog okr.review.*).
 * Speicherung über rbac.role_permissions.
 */

export type StrategyReviewPermissionGroupId = "procedure" | "governance";

export type StrategyReviewPermissionRowMeta = {
  code: string;
  groupId: StrategyReviewPermissionGroupId;
  labelDe: string;
  hintDe: string;
};

export const STRATEGY_REVIEW_PERMISSION_GROUP_ORDER: StrategyReviewPermissionGroupId[] = [
  "procedure",
  "governance",
];

export const STRATEGY_REVIEW_PERMISSION_GROUP_LABEL_DE: Record<
  StrategyReviewPermissionGroupId,
  string
> = {
  procedure: "Strategie-Review – Verfahren",
  governance: "Strategie-Review – Steuerung & Abschluss",
};

export const STRATEGY_REVIEW_PERMISSION_UI_ROWS: StrategyReviewPermissionRowMeta[] = [
  {
    code: "strategy_review.read",
    groupId: "procedure",
    labelDe: "Reviewverfahren einsehen",
    hintDe: "Seite und Status des Strategie-Reviews lesen",
  },
  {
    code: "strategy_review.feedback",
    groupId: "procedure",
    labelDe: "Vorab-Feedback geben",
    hintDe: "Bewertungen und Kommentare in Phase Vorab & Feedback",
  },
  {
    code: "strategy_review.moderate",
    groupId: "procedure",
    labelDe: "Verfahren führen",
    hintDe: "Ankündigung, Vorab aufbereiten, Teilnehmer pflegen, Notizen, Entscheidungen erfassen",
  },
  {
    code: "strategy_review.lead_assign",
    groupId: "governance",
    labelDe: "Review-Leitung zuweisen",
    hintDe: "Teilnehmerrolle «Review-Leitung» setzen (analog Facilitator bei OKR)",
  },
  {
    code: "strategy_review.release",
    groupId: "governance",
    labelDe: "Änderungen bestätigen und abschließen",
    hintDe: "Freigabe: Entscheidungen festschreiben und in die Folgeperiode übernehmen",
  },
  {
    code: "strategy_review.force_ready",
    groupId: "governance",
    labelDe: "Readiness erzwingen",
    hintDe: "Bereitschafts-Gates überschreiben (nur Admin-Fälle)",
  },
];

export const STRATEGY_REVIEW_PERMISSION_CODES: string[] =
  STRATEGY_REVIEW_PERMISSION_UI_ROWS.map((r) => r.code);

export type StrategyReviewPresetRoleCode =
  | "org_admin"
  | "executive"
  | "department_lead"
  | "team_member";

export const STRATEGY_REVIEW_DEFAULT_CODES_BY_ROLE: Record<
  StrategyReviewPresetRoleCode,
  readonly string[]
> = {
  org_admin: [
    "strategy_review.read",
    "strategy_review.feedback",
    "strategy_review.moderate",
    "strategy_review.lead_assign",
    "strategy_review.release",
    "strategy_review.force_ready",
  ],
  executive: [
    "strategy_review.read",
    "strategy_review.feedback",
    "strategy_review.moderate",
    "strategy_review.lead_assign",
    "strategy_review.release",
  ],
  department_lead: ["strategy_review.read", "strategy_review.feedback"],
  team_member: ["strategy_review.read"],
};

export function getStrategyReviewDefaultCodesForRoleCode(
  roleCode: string
): string[] | null {
  if (roleCode in STRATEGY_REVIEW_DEFAULT_CODES_BY_ROLE) {
    return [
      ...STRATEGY_REVIEW_DEFAULT_CODES_BY_ROLE[roleCode as StrategyReviewPresetRoleCode],
    ];
  }
  return null;
}
