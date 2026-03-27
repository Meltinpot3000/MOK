/**
 * Kuratierte UI-Metadaten fuer OKR-Objektrechte (okr.objective.* / okr.key_result.*) und OKR-Review.
 * Speicherung bleibt generisch ueber rbac.role_permissions.
 */

export type OkrObjectPermissionGroupId =
  | "objective_read"
  | "objective_update"
  | "key_result_read"
  | "key_result_update"
  | "review_workspace";

export type OkrObjectScopeId = "own" | "deputy" | "department" | "all";

export type OkrObjectPermissionRowMeta = {
  code: string;
  groupId: OkrObjectPermissionGroupId;
  scopeId: OkrObjectScopeId;
  labelDe: string;
};

const G: OkrObjectPermissionGroupId[] = [
  "objective_read",
  "objective_update",
  "key_result_read",
  "key_result_update",
  "review_workspace",
];

export const OKR_OBJECT_PERMISSION_GROUP_ORDER: OkrObjectPermissionGroupId[] = G;

export const OKR_OBJECT_PERMISSION_GROUP_LABEL_DE: Record<OkrObjectPermissionGroupId, string> = {
  objective_read: "Objectives – Lesen",
  objective_update: "Objectives – Bearbeiten",
  key_result_read: "Key Results – Lesen",
  key_result_update: "Key Results – Bearbeiten",
  review_workspace: "OKR-Review und Sessions",
};

const SCOPE_LABEL_DE: Record<OkrObjectScopeId, string> = {
  own: "eigen (Owner)",
  deputy: "Stellvertretung (Deputy)",
  department: "Führungsbereich (direkte Linie)",
  all: "alle in der Organisation",
};

function row(
  code: string,
  groupId: OkrObjectPermissionGroupId,
  scopeId: OkrObjectScopeId
): OkrObjectPermissionRowMeta {
  return {
    code,
    groupId,
    scopeId,
    labelDe: SCOPE_LABEL_DE[scopeId],
  };
}

function rowReview(code: string, labelDe: string): OkrObjectPermissionRowMeta {
  return { code, groupId: "review_workspace", scopeId: "all", labelDe };
}

export const OKR_OBJECT_PERMISSION_UI_ROWS: OkrObjectPermissionRowMeta[] = [
  row("okr.objective.read.own", "objective_read", "own"),
  row("okr.objective.read.deputy", "objective_read", "deputy"),
  row("okr.objective.read.department", "objective_read", "department"),
  row("okr.objective.read.all", "objective_read", "all"),
  row("okr.objective.update.own", "objective_update", "own"),
  row("okr.objective.update.deputy", "objective_update", "deputy"),
  row("okr.objective.update.department", "objective_update", "department"),
  row("okr.objective.update.all", "objective_update", "all"),
  row("okr.key_result.read.own", "key_result_read", "own"),
  row("okr.key_result.read.deputy", "key_result_read", "deputy"),
  row("okr.key_result.read.department", "key_result_read", "department"),
  row("okr.key_result.read.all", "key_result_read", "all"),
  row("okr.key_result.update.own", "key_result_update", "own"),
  row("okr.key_result.update.deputy", "key_result_update", "deputy"),
  row("okr.key_result.update.department", "key_result_update", "department"),
  row("okr.key_result.update.all", "key_result_update", "all"),
  rowReview("okr.review.workspace.read", "Review-Bereich lesen (Workspace)"),
  rowReview("okr.review.session.manage", "Review-Sessions anlegen und verwalten (Manage)"),
  rowReview("okr.review.facilitator.assign", "Facilitator (OKR Process Owner) zuweisen"),
];

export const OKR_OBJECT_PERMISSION_CODES: string[] = OKR_OBJECT_PERMISSION_UI_ROWS.map((r) => r.code);

export type PresetRoleCode = "org_admin" | "executive" | "department_lead" | "team_member";

export const OKR_OBJECT_DEFAULT_CODES_BY_ROLE: Record<PresetRoleCode, readonly string[]> = {
  org_admin: [
    "okr.objective.read.all",
    "okr.objective.update.all",
    "okr.key_result.read.all",
    "okr.key_result.update.all",
    "okr.review.workspace.read",
    "okr.review.session.manage",
    "okr.review.facilitator.assign",
  ],
  executive: [
    "okr.objective.read.all",
    "okr.key_result.read.all",
    "okr.review.workspace.read",
    "okr.review.facilitator.assign",
  ],
  department_lead: [
    "okr.objective.read.department",
    "okr.objective.update.department",
    "okr.key_result.read.department",
    "okr.key_result.update.department",
    "okr.review.workspace.read",
    "okr.review.session.manage",
  ],
  team_member: [
    "okr.objective.read.own",
    "okr.objective.update.own",
    "okr.objective.read.deputy",
    "okr.objective.update.deputy",
    "okr.key_result.read.own",
    "okr.key_result.update.own",
    "okr.key_result.read.deputy",
    "okr.key_result.update.deputy",
    "okr.review.workspace.read",
  ],
};

export function getOkrObjectDefaultCodesForRoleCode(roleCode: string): string[] | null {
  if (roleCode in OKR_OBJECT_DEFAULT_CODES_BY_ROLE) {
    return [...OKR_OBJECT_DEFAULT_CODES_BY_ROLE[roleCode as PresetRoleCode]];
  }
  return null;
}