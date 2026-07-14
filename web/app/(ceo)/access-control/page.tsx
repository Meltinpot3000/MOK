import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCeoAccessContext, getAuthenticatedUserId } from "@/lib/ceo/queries";
import {
  getRoleAccessMatrix,
  saveRoleAccessMatrix,
} from "@/lib/rbac/sidebar-access";
import {
  getOkrObjectPermissionMatrix,
  restoreOkrObjectPermissionDefaults,
  saveOkrObjectRolePermissions,
} from "@/lib/rbac/okr-object-role-permissions";
import { OKR_OBJECT_PERMISSION_CODES } from "@/lib/rbac/okr-object-permission-ui";
import {
  getStrategyReviewPermissionMatrix,
  restoreStrategyReviewPermissionDefaults,
  saveStrategyReviewRolePermissions,
} from "@/lib/rbac/strategy-review-role-permissions";
import { STRATEGY_REVIEW_PERMISSION_CODES } from "@/lib/rbac/strategy-review-permission-ui";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";
import { RoleAccessMatrixTable } from "@/components/access-control/RoleAccessMatrixTable";
import { AccessControlTabs, type AccessControlTabId } from "@/components/access-control/AccessControlTabs";
import { OkrObjectPermissionMatrix } from "@/components/access-control/OkrObjectPermissionMatrix";
import { RestoreOkrPermissionPresetsButton } from "@/components/access-control/RestoreOkrPermissionPresetsButton";
import { StrategyReviewPermissionMatrix } from "@/components/access-control/StrategyReviewPermissionMatrix";
import { RestoreStrategyReviewPermissionPresetsButton } from "@/components/access-control/RestoreStrategyReviewPermissionPresetsButton";
import { SIDEBAR_ITEMS } from "@/lib/sidebar-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

function parseTab(raw: string | undefined): AccessControlTabId {
  if (raw === "okr") return "okr";
  if (raw === "rules") return "rules";
  if (raw === "strategy-review") return "strategy-review";
  return "navigation";
}

export default async function AccessControlPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);

  const pageAccess = await getSidebarAccessContext("access-control");
  if (pageAccess.state === "unauthenticated") {
    redirect("/login");
  }
  if (pageAccess.state === "forbidden") {
    redirect("/no-access");
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");
  const access = await getCeoAccessContext(userId);
  if (!access) redirect("/no-access");

  const permCodes = await getPermissionCodesForMembership(access.membershipId);
  const canManageRoles = permCodes.has("admin.manage_roles");
  const canOrgManage = permCodes.has("org.manage");

  const navWrite = pageAccess.canWrite;
  const canSaveNavMatrix = navWrite && canManageRoles;
  const canSaveOkrMatrix = navWrite && canManageRoles;
  const canSaveStrategyReviewMatrix = navWrite && canManageRoles;

  const { roles, matrix } = await getRoleAccessMatrix(access.organizationId);
  const matrixMap = new Map(matrix.map((row) => [`${row.role_id}__${row.item_id}`, row.level]));
  const matrixMapRecord = Object.fromEntries(matrixMap) as Record<
    string,
    "none" | "read" | "write"
  >;

  const okrMatrixPromise =
    tab === "okr"
      ? getOkrObjectPermissionMatrix(access.organizationId)
      : Promise.resolve(null);

  const strategyReviewMatrixPromise =
    tab === "strategy-review"
      ? getStrategyReviewPermissionMatrix(access.organizationId)
      : Promise.resolve(null);

  const orgRulesPromise =
    tab === "rules"
      ? (async () => {
          const supabase = await createSupabaseServerClient();
          const { data } = await supabase
            .schema("app")
            .from("organizations")
            .select(
              "okr_kr_owner_must_match_objective, okr_review_notify_owners_on_schedule, require_annual_targets_before_okrs, annual_target_gate_enforcement_mode, annual_target_gate_scope, annual_target_gate_allow_exceptions, annual_targets_require_signature, annual_targets_signature_mode, annual_targets_activation_requires_signed_status"
            )
            .eq("id", access.organizationId)
            .maybeSingle();
          const row = data as {
            okr_kr_owner_must_match_objective?: boolean;
            okr_review_notify_owners_on_schedule?: boolean;
            require_annual_targets_before_okrs?: boolean;
            annual_target_gate_enforcement_mode?: string;
            annual_target_gate_scope?: string;
            annual_target_gate_allow_exceptions?: boolean;
            annual_targets_require_signature?: boolean;
            annual_targets_signature_mode?: string;
            annual_targets_activation_requires_signed_status?: boolean;
          } | null;
          return {
            okrKrOwnerMustMatchObjective: Boolean(row?.okr_kr_owner_must_match_objective),
            okrReviewNotifyOwnersOnSchedule: Boolean(row?.okr_review_notify_owners_on_schedule),
            requireAnnualTargetsBeforeOkrs: Boolean(row?.require_annual_targets_before_okrs),
            annualTargetGateEnforcementMode:
              row?.annual_target_gate_enforcement_mode === "off" ||
              row?.annual_target_gate_enforcement_mode === "warn_only" ||
              row?.annual_target_gate_enforcement_mode === "block_activation" ||
              row?.annual_target_gate_enforcement_mode === "block_creation"
                ? row.annual_target_gate_enforcement_mode
                : "block_activation",
            annualTargetGateScope:
              row?.annual_target_gate_scope === "selected_roles" ? "selected_roles" : "all_employees",
            annualTargetGateAllowExceptions:
              row?.annual_target_gate_allow_exceptions === undefined
                ? true
                : Boolean(row?.annual_target_gate_allow_exceptions),
            annualTargetsRequireSignature: Boolean(row?.annual_targets_require_signature),
            annualTargetsSignatureMode:
              row?.annual_targets_signature_mode === "internal_acknowledgement" ||
              row?.annual_targets_signature_mode === "external_signature"
                ? row.annual_targets_signature_mode
                : "none",
            annualTargetsActivationRequiresSignedStatus:
              row?.annual_targets_activation_requires_signed_status === undefined
                ? true
                : Boolean(row?.annual_targets_activation_requires_signed_status),
          };
        })()
      : Promise.resolve({
          okrKrOwnerMustMatchObjective: false,
          okrReviewNotifyOwnersOnSchedule: false,
          requireAnnualTargetsBeforeOkrs: false,
          annualTargetGateEnforcementMode: "block_activation" as const,
          annualTargetGateScope: "all_employees" as const,
          annualTargetGateAllowExceptions: true,
          annualTargetsRequireSignature: false,
          annualTargetsSignatureMode: "none" as const,
          annualTargetsActivationRequiresSignedStatus: true,
        });

  const [okrData, strategyReviewData, orgRules] = await Promise.all([
    okrMatrixPromise,
    strategyReviewMatrixPromise,
    orgRulesPromise,
  ]);
  const {
    okrKrOwnerMustMatchObjective,
    okrReviewNotifyOwnersOnSchedule,
    requireAnnualTargetsBeforeOkrs,
    annualTargetGateEnforcementMode,
    annualTargetGateScope,
    annualTargetGateAllowExceptions,
    annualTargetsRequireSignature,
    annualTargetsSignatureMode,
    annualTargetsActivationRequiresSignedStatus,
  } = orgRules;

  async function saveAccessMatrix(formData: FormData) {
    "use server";

    const localAccess = await getSidebarAccessContext("access-control");
    if (localAccess.state !== "ok" || !localAccess.canWrite) {
      redirect("/no-access");
    }

    const localUserId = await getAuthenticatedUserId();
    if (!localUserId) redirect("/login");
    const localContext = await getCeoAccessContext(localUserId);
    if (!localContext) redirect("/no-access");

    const localPerms = await getPermissionCodesForMembership(localContext.membershipId);
    if (!localPerms.has("admin.manage_roles")) {
      redirect("/no-access");
    }

    const local = await getRoleAccessMatrix(localContext.organizationId);
    const levels: Record<string, "none" | "read" | "write"> = {};

    for (const role of local.roles) {
      for (const item of SIDEBAR_ITEMS) {
        const key = `${role.id}__${item.id}`;
        const raw = String(formData.get(key) ?? "none");
        levels[key] = raw === "write" ? "write" : raw === "read" ? "read" : "none";
      }
    }

    await saveRoleAccessMatrix(
      localContext.organizationId,
      local.roles.map((role) => role.id),
      levels
    );

    revalidatePath("/access-control");
    redirect("/access-control");
  }

  async function saveOkrObjectMatrixAction(formData: FormData) {
    "use server";

    const localAccess = await getSidebarAccessContext("access-control");
    if (localAccess.state !== "ok" || !localAccess.canWrite) {
      redirect("/no-access");
    }

    const localUserId = await getAuthenticatedUserId();
    if (!localUserId) redirect("/login");
    const localContext = await getCeoAccessContext(localUserId);
    if (!localContext) redirect("/no-access");

    const localPerms = await getPermissionCodesForMembership(localContext.membershipId);
    if (!localPerms.has("admin.manage_roles")) {
      redirect("/no-access");
    }

    const local = await getRoleAccessMatrix(localContext.organizationId);
    const roleIds = local.roles.map((r) => r.id);
    const granted = new Set<string>();
    for (const role of local.roles) {
      for (const code of OKR_OBJECT_PERMISSION_CODES) {
        const key = `${role.id}__${code}`;
        if (formData.get(key) === "on") granted.add(key);
      }
    }

    await saveOkrObjectRolePermissions(localContext.organizationId, roleIds, granted);
    revalidatePath("/access-control");
    redirect("/access-control?tab=okr");
  }

  async function restoreOkrPresetsAction(_formData: FormData) {
    "use server";

    const localAccess = await getSidebarAccessContext("access-control");
    if (localAccess.state !== "ok" || !localAccess.canWrite) {
      redirect("/no-access");
    }

    const localUserId = await getAuthenticatedUserId();
    if (!localUserId) redirect("/login");
    const localContext = await getCeoAccessContext(localUserId);
    if (!localContext) redirect("/no-access");

    const localPerms = await getPermissionCodesForMembership(localContext.membershipId);
    if (!localPerms.has("admin.manage_roles")) {
      redirect("/no-access");
    }

    const local = await getRoleAccessMatrix(localContext.organizationId);
    await restoreOkrObjectPermissionDefaults(
      localContext.organizationId,
      local.roles.map((r) => ({ id: r.id, code: r.code }))
    );
    revalidatePath("/access-control");
    redirect("/access-control?tab=okr");
  }

  async function saveStrategyReviewMatrixAction(formData: FormData) {
    "use server";

    const localAccess = await getSidebarAccessContext("access-control");
    if (localAccess.state !== "ok" || !localAccess.canWrite) {
      redirect("/no-access");
    }

    const localUserId = await getAuthenticatedUserId();
    if (!localUserId) redirect("/login");
    const localContext = await getCeoAccessContext(localUserId);
    if (!localContext) redirect("/no-access");

    const localPerms = await getPermissionCodesForMembership(localContext.membershipId);
    if (!localPerms.has("admin.manage_roles")) {
      redirect("/no-access");
    }

    const local = await getRoleAccessMatrix(localContext.organizationId);
    const roleIds = local.roles.map((r) => r.id);
    const granted = new Set<string>();
    for (const role of local.roles) {
      for (const code of STRATEGY_REVIEW_PERMISSION_CODES) {
        const key = `${role.id}__${code}`;
        if (formData.get(key) === "on") granted.add(key);
      }
    }

    await saveStrategyReviewRolePermissions(localContext.organizationId, roleIds, granted);
    revalidatePath("/access-control");
    redirect("/access-control?tab=strategy-review");
  }

  async function restoreStrategyReviewPresetsAction(_formData: FormData) {
    "use server";

    const localAccess = await getSidebarAccessContext("access-control");
    if (localAccess.state !== "ok" || !localAccess.canWrite) {
      redirect("/no-access");
    }

    const localUserId = await getAuthenticatedUserId();
    if (!localUserId) redirect("/login");
    const localContext = await getCeoAccessContext(localUserId);
    if (!localContext) redirect("/no-access");

    const localPerms = await getPermissionCodesForMembership(localContext.membershipId);
    if (!localPerms.has("admin.manage_roles")) {
      redirect("/no-access");
    }

    const local = await getRoleAccessMatrix(localContext.organizationId);
    await restoreStrategyReviewPermissionDefaults(
      localContext.organizationId,
      local.roles.map((r) => ({ id: r.id, code: r.code }))
    );
    revalidatePath("/access-control");
    redirect("/access-control?tab=strategy-review");
  }

  async function updateOkrKrOwnerPolicyAction(formData: FormData) {
    "use server";

    const localAccess = await getSidebarAccessContext("access-control");
    if (localAccess.state !== "ok") {
      redirect("/no-access");
    }

    const localUserId = await getAuthenticatedUserId();
    if (!localUserId) redirect("/login");
    const localContext = await getCeoAccessContext(localUserId);
    if (!localContext) redirect("/no-access");

    const localPerms = await getPermissionCodesForMembership(localContext.membershipId);
    /** Mandantenfeld organizations: RLS verlangt org.manage (nicht nav.access-control.write). */
    if (!localPerms.has("org.manage")) {
      redirect("/no-access");
    }

    const rawKr = formData.get("okr_kr_owner_must_match_objective");
    const krOwnerMatch = rawKr === "on" || rawKr === "true";
    const rawNotify = formData.get("okr_review_notify_owners_on_schedule");
    const notifyOwnersOnSchedule = rawNotify === "on" || rawNotify === "true";
    const rawRequireAnnualTargets = formData.get("require_annual_targets_before_okrs");
    const requireAnnualTargetsBeforeOkrs =
      rawRequireAnnualTargets === "on" || rawRequireAnnualTargets === "true";
    const rawMode = String(formData.get("annual_target_gate_enforcement_mode") ?? "block_activation").trim();
    const enforcementMode =
      rawMode === "off" || rawMode === "warn_only" || rawMode === "block_activation" || rawMode === "block_creation"
        ? rawMode
        : "block_activation";
    const rawScope = String(formData.get("annual_target_gate_scope") ?? "all_employees").trim();
    const gateScope = rawScope === "selected_roles" ? "selected_roles" : "all_employees";
    const rawAllowExceptions = formData.get("annual_target_gate_allow_exceptions");
    const gateAllowExceptions = rawAllowExceptions === "on" || rawAllowExceptions === "true";
    const rawRequireSignature = formData.get("annual_targets_require_signature");
    const annualTargetsRequireSignature =
      rawRequireSignature === "on" || rawRequireSignature === "true";
    const rawSigMode = String(formData.get("annual_targets_signature_mode") ?? "none").trim();
    const signatureMode =
      rawSigMode === "internal_acknowledgement" || rawSigMode === "external_signature"
        ? rawSigMode
        : "none";
    const rawActivationSigned = formData.get("annual_targets_activation_requires_signed_status");
    const activationRequiresSigned =
      rawActivationSigned === "on" || rawActivationSigned === "true";

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema("app")
      .from("organizations")
      .update({
        okr_kr_owner_must_match_objective: krOwnerMatch,
        okr_review_notify_owners_on_schedule: notifyOwnersOnSchedule,
        require_annual_targets_before_okrs: requireAnnualTargetsBeforeOkrs,
        annual_target_gate_enforcement_mode: enforcementMode,
        annual_target_gate_scope: gateScope,
        annual_target_gate_allow_exceptions: gateAllowExceptions,
        annual_targets_require_signature: annualTargetsRequireSignature,
        annual_targets_signature_mode: signatureMode,
        annual_targets_activation_requires_signed_status: activationRequiresSigned,
      })
      .eq("id", localContext.organizationId);

    if (error) {
      console.error("[updateOkrKrOwnerPolicyAction]", error.message);
      redirect("/access-control?tab=rules");
    }

    revalidatePath("/access-control");
    revalidatePath("/organization");
    revalidatePath("/okr/planning");
    revalidatePath("/okr/tracking");
    revalidatePath("/okr-workspace");
    revalidatePath("/annual-targets");
    redirect("/access-control?tab=rules");
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rollenrechte</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Rollenrechte, OKR-Objektzugriff und Systemregeln
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Navigation pro Modul, granulare OKR-Objektrechte, Strategie-Review-Capabilities sowie
          Mandantenregeln für die OKR-Planung.
        </p>
      </header>

      <div className="brand-card p-4">
        <AccessControlTabs active={tab} />
      </div>

      {tab === "navigation" ? (
        <section className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Module und Navigation</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Pro Rolle legst du fest, ob ein Sidebar-Bereich fehlt, nur lesbar oder bearbeitbar ist (
            <code className="text-xs">nav.*</code>).
          </p>
          {!canManageRoles ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Zum Speichern der Navigationsmatrix ist die Berechtigung <strong>admin.manage_roles</strong>{" "}
              nötig (Rollen-Admin). Ohne sie sind die Felder nur sichtbar.
            </p>
          ) : null}
          <form action={saveAccessMatrix} className="mt-4">
            <RoleAccessMatrixTable
              roles={roles}
              matrixMap={matrixMapRecord}
              canWrite={canSaveNavMatrix}
            />

            <div className="mt-4 flex items-center justify-between">
              {!canSaveNavMatrix ? (
                <p className="brand-surface p-2 text-sm text-zinc-600">
                  Keine Schreibberechtigung für diese Matrix.
                </p>
              ) : (
                <p className="text-sm text-zinc-600">Hinweis: Schreiben setzt automatisch Lesen.</p>
              )}
              <button
                type="submit"
                disabled={!canSaveNavMatrix}
                className="brand-btn px-4 py-2 text-sm"
              >
                Rechte speichern
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "okr" && okrData ? (
        <section className="brand-card space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">OKR-Objektrechte</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Feingranulare Rechte für Objectives und Key Results pro Rolle (
                <code className="text-xs">okr.objective.*</code>, <code className="text-xs">okr.key_result.*</code> sowie <code className="text-xs">okr.review.*</code> (Workspace, Session-Manage, Facilitator-Zuweisung)
                ). Die App zeigt im UI beschreibende Namen; der technische Code steht unter jeder Zeile.
              </p>
            </div>
            <RestoreOkrPermissionPresetsButton
              disabled={!canSaveOkrMatrix}
              formAction={restoreOkrPresetsAction}
            />
          </div>
          {!canManageRoles ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Zum Speichern ist <strong>admin.manage_roles</strong> erforderlich.
            </p>
          ) : null}

          <form action={saveOkrObjectMatrixAction}>
            <OkrObjectPermissionMatrix
              roles={okrData.roles}
              cells={okrData.cells}
              canWrite={canSaveOkrMatrix}
            />
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={!canSaveOkrMatrix}
                className="brand-btn px-4 py-2 text-sm"
              >
                OKR-Objektrechte speichern
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "strategy-review" && strategyReviewData ? (
        <section className="brand-card space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Strategie-Review</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Verfahrens-Capabilities pro Rolle (
                <code className="text-xs">strategy_review.*</code>
                ), analog zu <code className="text-xs">okr.review.*</code>. Die
                Teilnehmerrolle «Review-Leitung» bleibt fallbezogen und steuert zusätzlich das
                Meeting starten im konkreten Review.
              </p>
            </div>
            <RestoreStrategyReviewPermissionPresetsButton
              disabled={!canSaveStrategyReviewMatrix}
              formAction={restoreStrategyReviewPresetsAction}
            />
          </div>
          {!canManageRoles ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Zum Speichern ist <strong>admin.manage_roles</strong> erforderlich.
            </p>
          ) : null}

          <form action={saveStrategyReviewMatrixAction}>
            <StrategyReviewPermissionMatrix
              roles={strategyReviewData.roles}
              cells={strategyReviewData.cells}
              canWrite={canSaveStrategyReviewMatrix}
            />
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={!canSaveStrategyReviewMatrix}
                className="brand-btn px-4 py-2 text-sm"
              >
                Strategie-Review-Rechte speichern
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "rules" ? (
        <section className="brand-card space-y-6 p-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">OKR-Systemregeln und Mandant</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Die folgenden Regeln sind fest im Produkt verankert (Auszug). Sie können das Verhalten von
              Berechtigungen und Datenlogik beeinflussen; eigene Schalter dafür gibt es in dieser Version nicht.
            </p>
          </div>

          <div className="space-y-3 text-sm text-zinc-800">
            <div className="rounded-md border border-zinc-200 bg-zinc-50/80 p-4">
              <h3 className="font-semibold text-zinc-900">Key Results ohne eigenen Owner</h3>
              <p className="mt-1 text-zinc-700">
                Der wirksame KR-Owner entspricht dem Objective-Owner, wenn am KR kein Owner gesetzt ist
                (Koaleszenz in der Zugriffslogik).
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50/80 p-4">
              <h3 className="font-semibold text-zinc-900">Key Results ohne eigenen Deputy</h3>
              <p className="mt-1 text-zinc-700">
                Der wirksame KR-Deputy wird vom Objective-Deputy übernommen, wenn am KR kein Deputy gesetzt
                ist.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50/80 p-4">
              <h3 className="font-semibold text-zinc-900">Department-Zugriff</h3>
              <p className="mt-1 text-zinc-700">
                Zugriff im Umfang „Führungsbereich“ bezieht sich auf die direkte Führungslinie: ein
                Vorgesetzter sieht OKRs dort, wo der effektive Owner direkt ihm zugeordnet ist (
                <code className="text-xs">reports_to_membership_id</code>).
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-6">
            <h3 className="text-base font-semibold text-zinc-900">Mandantenregel: KR-Owner</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Optional kann die Organisation erzwingen, dass Key Results keinen separaten Owner haben:
              In der Planung wird dann nur der Objective-Owner verwendet.
            </p>
            {!canOrgManage ? (
              <p className="mt-3 text-sm text-zinc-600">
                Aktuell:{" "}
                <span className="font-medium text-zinc-900">
                  {okrKrOwnerMustMatchObjective
                    ? "KR-Owner entspricht dem Objective-Owner (erzwungen)."
                    : "KR-Owner kann separat gesetzt werden."}
                </span>
                <span className="mt-2 block text-xs text-amber-800">
                  Zum Ändern ist die Berechtigung <strong>org.manage</strong> nötig.
                </span>
              </p>
            ) : (
              <form action={updateOkrKrOwnerPolicyAction} className="mt-4 space-y-3">
                <label className="flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="okr_kr_owner_must_match_objective"
                    value="true"
                    defaultChecked={okrKrOwnerMustMatchObjective}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Key-Result-Owner entspricht immer dem Objective-Owner</span>
                    <span className="mt-0.5 block text-xs text-zinc-600">
                      Wenn aktiv: in der OKR-Planung kein separates KR-Owner-Feld; beim Speichern wird der
                      Objective-Owner übernommen.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="okr_review_notify_owners_on_schedule"
                    value="true"
                    defaultChecked={okrReviewNotifyOwnersOnSchedule}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">
                      OKR-Owner bei geplanter Review-Session benachrichtigen
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-600">
                      Nach „Planen“ im OKR-Review-Workspace (Versand folgt, sobald ein E-Mail-Provider
                      angebunden ist).
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="require_annual_targets_before_okrs"
                    value="true"
                    defaultChecked={requireAnnualTargetsBeforeOkrs}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Jahresziele vor OKRs erzwingen</span>
                    <span className="mt-0.5 block text-xs text-zinc-600">
                      Wenn aktiv: Für den Objective-Owner müssen aktive Jahresziele im relevanten Zieljahr existieren.
                    </span>
                  </span>
                </label>
                <label className="block text-sm text-zinc-800">
                  <span className="font-medium">Enforcement-Modus</span>
                  <select
                    name="annual_target_gate_enforcement_mode"
                    defaultValue={annualTargetGateEnforcementMode}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="off">Aus</option>
                    <option value="warn_only">Nur Warnung</option>
                    <option value="block_activation">Aktivierung blockieren (empfohlen)</option>
                    <option value="block_creation">Erstellung blockieren</option>
                  </select>
                </label>
                <label className="block text-sm text-zinc-800">
                  <span className="font-medium">Scope</span>
                  <select
                    name="annual_target_gate_scope"
                    defaultValue={annualTargetGateScope}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="all_employees">Alle Mitarbeitenden</option>
                    <option value="selected_roles">Nur jahreszielpflichtige Rollen/Memberships</option>
                  </select>
                </label>
                <label className="flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="annual_target_gate_allow_exceptions"
                    value="true"
                    defaultChecked={annualTargetGateAllowExceptions}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Ausnahmen erlauben</span>
                    <span className="mt-0.5 block text-xs text-zinc-600">
                      Genehmigte Ausnahme erlaubt Aktivierung ohne direkte Jahresziel-Zuordnung.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="annual_targets_require_signature"
                    value="true"
                    defaultChecked={annualTargetsRequireSignature}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Digitale Signatur für Jahresziele</span>
                    <span className="mt-0.5 block text-xs text-zinc-600">
                      Wenn aktiv: Aktivierung erst nach Signaturstatus «signed».
                    </span>
                  </span>
                </label>
                <label className="block text-sm text-zinc-800">
                  <span className="font-medium">Signatur-Modus</span>
                  <select
                    name="annual_targets_signature_mode"
                    defaultValue={annualTargetsSignatureMode}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="none">Keine</option>
                    <option value="internal_acknowledgement">Interne Bestätigung (MVP)</option>
                    <option value="external_signature">Externer Anbieter (vorbereitet)</option>
                  </select>
                </label>
                <label className="flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="annual_targets_activation_requires_signed_status"
                    value="true"
                    defaultChecked={annualTargetsActivationRequiresSignedStatus}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Aktivierung erfordert Signatur</span>
                  </span>
                </label>
                <button type="submit" className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
                  Mandantenregeln speichern
                </button>
              </form>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
