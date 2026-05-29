import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";

/** Membership-UUIDs case-insensitive vergleichen (Client vs. DB). */
function normalizeMembershipUuid(id: string | null): string | null {
  if (!id) return null;
  const t = id.trim();
  return t.length ? t.toLowerCase() : null;
}

export type OkrAction = "read" | "update";

/** Relationsstufe ohne globales „all“ (das wird nur über Permission-Codes abgebildet). */
export type OkrObjectRelation = "owner" | "deputy" | "department" | "none";

/** Für UI/Debug: inkl. global über Permission. */
export type OkrAccessRelationLabel = "all" | OkrObjectRelation;

const RELATION_PRIORITY: Record<OkrAccessRelationLabel, number> = {
  all: 4,
  owner: 3,
  deputy: 2,
  department: 1,
  none: 0,
};

export function strongerAccessRelation(
  a: OkrAccessRelationLabel,
  b: OkrAccessRelationLabel
): OkrAccessRelationLabel {
  return RELATION_PRIORITY[a] >= RELATION_PRIORITY[b] ? a : b;
}

export function hasObjectivePermissionForRelation(
  permissionCodes: Set<string>,
  action: OkrAction,
  relation: OkrObjectRelation
): boolean {
  if (permissionCodes.has(`okr.objective.${action}.all`)) return true;
  if (relation === "owner" && permissionCodes.has(`okr.objective.${action}.own`)) return true;
  if (relation === "deputy" && permissionCodes.has(`okr.objective.${action}.deputy`)) return true;
  if (relation === "department" && permissionCodes.has(`okr.objective.${action}.department`)) return true;
  return false;
}

export function hasKeyResultPermissionForRelation(
  permissionCodes: Set<string>,
  action: OkrAction,
  relation: OkrObjectRelation
): boolean {
  if (permissionCodes.has(`okr.key_result.${action}.all`)) return true;
  if (relation === "owner" && permissionCodes.has(`okr.key_result.${action}.own`)) return true;
  if (relation === "deputy" && permissionCodes.has(`okr.key_result.${action}.deputy`)) return true;
  if (relation === "department" && permissionCodes.has(`okr.key_result.${action}.department`)) return true;
  return false;
}

export async function isDepartmentHeadOf(params: {
  managerMembershipId: string;
  subordinateMembershipId: string | null;
}): Promise<boolean> {
  if (!params.subordinateMembershipId) return false;
  const supabase = await createSupabaseServerClient();
  const subId = normalizeMembershipUuid(params.subordinateMembershipId);
  if (!subId) return false;
  const { data } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("reports_to_membership_id")
    .eq("id", subId)
    .maybeSingle();
  return (
    normalizeMembershipUuid(data?.reports_to_membership_id as string | null) ===
    normalizeMembershipUuid(params.managerMembershipId)
  );
}

/** Phase A: nur direkte Führungslinie (kein rekursives CTE). */
export async function getObjectiveRelation(params: {
  currentMembershipId: string;
  objectiveOwnerMembershipId: string | null;
  objectiveDeputyMembershipId: string | null;
}): Promise<OkrObjectRelation> {
  const mid = normalizeMembershipUuid(params.currentMembershipId);
  if (!mid) return "none";
  if (normalizeMembershipUuid(params.objectiveOwnerMembershipId) === mid) {
    return "owner";
  }
  if (normalizeMembershipUuid(params.objectiveDeputyMembershipId) === mid) {
    return "deputy";
  }
  if (
    params.objectiveOwnerMembershipId &&
    (await isDepartmentHeadOf({
      managerMembershipId: params.currentMembershipId,
      subordinateMembershipId: params.objectiveOwnerMembershipId,
    }))
  ) {
    return "department";
  }
  return "none";
}

export async function getKeyResultRelation(params: {
  currentMembershipId: string;
  keyResultOwnerMembershipId: string | null;
  keyResultDeputyMembershipId: string | null;
  objectiveOwnerMembershipId: string | null;
  objectiveDeputyMembershipId: string | null;
}): Promise<OkrObjectRelation> {
  const effectiveOwner =
    params.keyResultOwnerMembershipId ?? params.objectiveOwnerMembershipId ?? null;
  const effectiveDeputy =
    params.keyResultDeputyMembershipId ?? params.objectiveDeputyMembershipId ?? null;

  const mid = normalizeMembershipUuid(params.currentMembershipId);
  if (normalizeMembershipUuid(effectiveOwner) === mid) return "owner";
  if (normalizeMembershipUuid(effectiveDeputy) === mid) return "deputy";
  if (
    effectiveOwner &&
    (await isDepartmentHeadOf({
      managerMembershipId: params.currentMembershipId,
      subordinateMembershipId: effectiveOwner,
    }))
  ) {
    return "department";
  }
  return "none";
}

export type OkrObjectiveAccessRow = {
  id: string;
  owner_membership_id: string | null;
  deputy_membership_id: string | null;
};

export type OkrKeyResultAccessRow = {
  id: string;
  owner_membership_id: string | null;
  deputy_membership_id: string | null;
};

export async function canAccessObjective(params: {
  currentMembershipId: string;
  action: OkrAction;
  objective: OkrObjectiveAccessRow;
}): Promise<boolean> {
  const permissionCodes = await getPermissionCodesForMembership(params.currentMembershipId);
  if (permissionCodes.has(`okr.objective.${params.action}.all`)) return true;
  const relation = await getObjectiveRelation({
    currentMembershipId: params.currentMembershipId,
    objectiveOwnerMembershipId: params.objective.owner_membership_id,
    objectiveDeputyMembershipId: params.objective.deputy_membership_id,
  });
  return hasObjectivePermissionForRelation(permissionCodes, params.action, relation);
}

export async function canAccessKeyResult(params: {
  currentMembershipId: string;
  action: OkrAction;
  keyResult: OkrKeyResultAccessRow;
  objective: OkrObjectiveAccessRow;
}): Promise<boolean> {
  const permissionCodes = await getPermissionCodesForMembership(params.currentMembershipId);
  if (permissionCodes.has(`okr.key_result.${params.action}.all`)) return true;
  const relation = await getKeyResultRelation({
    currentMembershipId: params.currentMembershipId,
    keyResultOwnerMembershipId: params.keyResult.owner_membership_id,
    keyResultDeputyMembershipId: params.keyResult.deputy_membership_id,
    objectiveOwnerMembershipId: params.objective.owner_membership_id,
    objectiveDeputyMembershipId: params.objective.deputy_membership_id,
  });
  return hasKeyResultPermissionForRelation(permissionCodes, params.action, relation);
}

/** Bulk-Kontext: einmal Permissions + reports_to für alle vorkommenden Membership-IDs. */
export type OkrBulkAccessContext = {
  permissionCodes: Set<string>;
  currentMembershipId: string;
  /** subordinate id → reports_to_membership_id */
  reportsToByMembershipId: Map<string, string | null>;
};

export async function loadOkrBulkAccessContext(params: {
  currentMembershipId: string;
  referencedMembershipIds: string[];
}): Promise<OkrBulkAccessContext> {
  const permissionCodes = await getPermissionCodesForMembership(params.currentMembershipId);
  const ids = [...new Set(params.referencedMembershipIds.filter(Boolean))];
  const reportsToByMembershipId = new Map<string, string | null>();
  if (ids.length > 0) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .schema("app")
      .from("organization_memberships")
      .select("id, reports_to_membership_id")
      .in("id", ids);
    for (const row of data ?? []) {
      const id = normalizeMembershipUuid(row.id as string);
      if (!id) continue;
      reportsToByMembershipId.set(
        id,
        normalizeMembershipUuid((row.reports_to_membership_id as string | null) ?? null)
      );
    }
  }
  return {
    permissionCodes,
    currentMembershipId: params.currentMembershipId,
    reportsToByMembershipId,
  };
}

export function objectiveRelationFromBulk(
  ctx: OkrBulkAccessContext,
  objective: Pick<OkrObjectiveAccessRow, "owner_membership_id" | "deputy_membership_id">
): OkrObjectRelation {
  const mid = normalizeMembershipUuid(ctx.currentMembershipId);
  if (!mid) return "none";
  if (normalizeMembershipUuid(objective.owner_membership_id) === mid) return "owner";
  if (normalizeMembershipUuid(objective.deputy_membership_id) === mid) return "deputy";
  const ownerId = normalizeMembershipUuid(objective.owner_membership_id);
  if (ownerId) {
    const reportsTo = ctx.reportsToByMembershipId.get(ownerId) ?? null;
    if (normalizeMembershipUuid(reportsTo) === mid) return "department";
  }
  return "none";
}

export function keyResultRelationFromBulk(
  ctx: OkrBulkAccessContext,
  keyResult: Pick<OkrKeyResultAccessRow, "owner_membership_id" | "deputy_membership_id">,
  objective: Pick<OkrObjectiveAccessRow, "owner_membership_id" | "deputy_membership_id">
): OkrObjectRelation {
  const mid = ctx.currentMembershipId;
  const effOwner = keyResult.owner_membership_id ?? objective.owner_membership_id ?? null;
  const effDeputy = keyResult.deputy_membership_id ?? objective.deputy_membership_id ?? null;
  if (effOwner === mid) return "owner";
  if (effDeputy === mid) return "deputy";
  if (effOwner && ctx.reportsToByMembershipId.get(effOwner) === mid) return "department";
  return "none";
}

export function canReadObjectiveFromBulk(
  ctx: OkrBulkAccessContext,
  objective: Pick<OkrObjectiveAccessRow, "owner_membership_id" | "deputy_membership_id">
): boolean {
  const rel = objectiveRelationFromBulk(ctx, objective);
  return hasObjectivePermissionForRelation(ctx.permissionCodes, "read", rel);
}

export function canReadKeyResultFromBulk(
  ctx: OkrBulkAccessContext,
  kr: Pick<OkrKeyResultAccessRow, "owner_membership_id" | "deputy_membership_id">,
  objective: Pick<OkrObjectiveAccessRow, "owner_membership_id" | "deputy_membership_id">
): boolean {
  const rel = keyResultRelationFromBulk(ctx, kr, objective);
  return hasKeyResultPermissionForRelation(ctx.permissionCodes, "read", rel);
}

export function canUpdateObjectiveFromBulk(
  ctx: OkrBulkAccessContext,
  objective: Pick<OkrObjectiveAccessRow, "owner_membership_id" | "deputy_membership_id">
): boolean {
  const rel = objectiveRelationFromBulk(ctx, objective);
  return hasObjectivePermissionForRelation(ctx.permissionCodes, "update", rel);
}

export function canUpdateKeyResultFromBulk(
  ctx: OkrBulkAccessContext,
  kr: Pick<OkrKeyResultAccessRow, "owner_membership_id" | "deputy_membership_id">,
  objective: Pick<OkrObjectiveAccessRow, "owner_membership_id" | "deputy_membership_id">
): boolean {
  const rel = keyResultRelationFromBulk(ctx, kr, objective);
  return hasKeyResultPermissionForRelation(ctx.permissionCodes, "update", rel);
}

/** UI: KR anlegen erlaubt bei KR-update.all oder wenn das Objective (Parent) aktualisiert werden darf. */
export function canCreateKeyResultOnObjectiveFromBulk(
  ctx: OkrBulkAccessContext,
  objective: Pick<OkrObjectiveAccessRow, "owner_membership_id" | "deputy_membership_id">
): boolean {
  if (ctx.permissionCodes.has("okr.key_result.update.all")) return true;
  return canUpdateObjectiveFromBulk(ctx, objective);
}

export function collectMembershipIdsForOkrBulk(objectives: OkrObjectiveAccessRow[], keyResults: OkrKeyResultAccessRow[]): string[] {
  const ids: string[] = [];
  for (const o of objectives) {
    if (o.owner_membership_id) ids.push(o.owner_membership_id);
    if (o.deputy_membership_id) ids.push(o.deputy_membership_id);
  }
  for (const k of keyResults) {
    if (k.owner_membership_id) ids.push(k.owner_membership_id);
    if (k.deputy_membership_id) ids.push(k.deputy_membership_id);
  }
  return ids;
}

/** Create Objective: nav/RLS write + (update.all oder self-owner mit update.own). */
export function canCreateOkrObjective(params: {
  permissionCodes: Set<string>;
  currentMembershipId: string;
  requestedOwnerMembershipId: string | null;
}): boolean {
  if (params.permissionCodes.has("okr.objective.update.all")) return true;
  const current = normalizeMembershipUuid(params.currentMembershipId);
  const requested = normalizeMembershipUuid(params.requestedOwnerMembershipId);
  if (
    current &&
    requested === current &&
    params.permissionCodes.has("okr.objective.update.own")
  ) {
    return true;
  }
  return false;
}

/**
 * Create KR (nach Modul-Write): update.all oder Parent als KR-Editor (vgl. canCreateKeyResultOnObjectiveFromBulk),
 * plus plausibler KR-Owner (eigene Mitgliedschaft oder Objective-Owner, z. B. Mandantenregel / Stellvertretung).
 */
export async function canCreateOkrKeyResult(params: {
  currentMembershipId: string;
  requestedKrOwnerMembershipId: string | null;
  parentObjective: OkrObjectiveAccessRow;
}): Promise<boolean> {
  const permissionCodes = await getPermissionCodesForMembership(params.currentMembershipId);
  if (permissionCodes.has("okr.key_result.update.all")) return true;

  const ctx = await loadOkrBulkAccessContext({
    currentMembershipId: params.currentMembershipId,
    referencedMembershipIds: [
      params.parentObjective.owner_membership_id,
      params.parentObjective.deputy_membership_id,
    ].filter(Boolean) as string[],
  });
  if (!canCreateKeyResultOnObjectiveFromBulk(ctx, params.parentObjective)) {
    return false;
  }

  const req = normalizeMembershipUuid(params.requestedKrOwnerMembershipId);
  if (!req) return false;

  const cur = normalizeMembershipUuid(params.currentMembershipId);
  const objOwn = normalizeMembershipUuid(params.parentObjective.owner_membership_id);

  if (cur && req === cur && permissionCodes.has("okr.key_result.update.own")) {
    return true;
  }
  if (objOwn && req === objOwn) {
    return (
      permissionCodes.has("okr.key_result.update.deputy") ||
      permissionCodes.has("okr.key_result.update.department") ||
      permissionCodes.has("okr.key_result.update.own")
    );
  }
  return false;
}

function isEmptyMembershipField(value: string | null | undefined): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Formular «— (wie Objective-Owner)» / leer: kein expliziter KR-Owner in der DB (null).
 * Nur wenn zuvor ein Owner gesetzt war, zählt leer als Entfernen (Patch null).
 */
export function resolveKeyResultOwnerMembershipPatch(
  currentOwnerMembershipId: string | null,
  inputOwnerMembershipId: string | null | undefined
): string | null | undefined {
  if (inputOwnerMembershipId === undefined) return undefined;
  if (!isEmptyMembershipField(inputOwnerMembershipId)) {
    return inputOwnerMembershipId;
  }
  if (currentOwnerMembershipId != null) return null;
  return undefined;
}

export function isExplicitKeyResultOwnerRemoval(
  currentOwnerMembershipId: string | null,
  ownerPatch: string | null | undefined
): boolean {
  return ownerPatch === null && currentOwnerMembershipId != null;
}

export function resolveKeyResultDeputyMembershipPatch(
  currentDeputyMembershipId: string | null,
  inputDeputyMembershipId: string | null | undefined
): string | null | undefined {
  if (inputDeputyMembershipId === undefined) return undefined;
  if (!isEmptyMembershipField(inputDeputyMembershipId)) {
    return inputDeputyMembershipId;
  }
  if (currentDeputyMembershipId != null) return null;
  return undefined;
}

export function isExplicitKeyResultDeputyRemoval(
  currentDeputyMembershipId: string | null,
  deputyPatch: string | null | undefined
): boolean {
  return deputyPatch === null && currentDeputyMembershipId != null;
}
