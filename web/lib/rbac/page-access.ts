import {
  SIDEBAR_ITEMS,
  SIDEBAR_ITEM_IDS,
  type SidebarItemId,
  type SidebarPermissionMap,
} from "@/lib/sidebar-access";
import type { CeoAccessContext } from "@/lib/ceo/queries";
import { getAuthenticatedUserId, getRankedCeoAccessContexts } from "@/lib/ceo/queries";
import { getSidebarPermissionsForMembership } from "@/lib/rbac/sidebar-access";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";

/** Zaehlt Leserechte; Dashboard-Zugang wird bei der Shell-Wahl zwischen Mitgliedschaften bevorzugt. */
function appShellPermissionScore(permissions: SidebarPermissionMap): number {
  const readCount = SIDEBAR_ITEM_IDS.filter((id) => permissions[id]?.read).length;
  const dashboardRead = permissions.dashboard?.read ? 1 : 0;
  return dashboardRead * 10_000 + readCount;
}

/**
 * Nur wenn kein einziger Sidebar-Punkt lesbar ist: Dashboard-Lesen ergänzen, damit die Shell
 * nutzbar bleibt (z. B. Rolle ohne nav.*). Sonst bleiben Berechtigungen unverändert — kein
 * künstliches Dashboard bei reinem OKR- o. a. Zugriff.
 */
function ensureMinimumShellPermissions(permissions: SidebarPermissionMap): SidebarPermissionMap {
  const hasAnyRead = SIDEBAR_ITEM_IDS.some((id) => permissions[id]?.read);
  if (hasAnyRead) {
    return permissions;
  }
  return {
    ...permissions,
    dashboard: { read: true, write: permissions.dashboard?.write ?? false },
  };
}

/**
 * App-Shell: beste aktive Mitgliedschaft nach Sidebar-Rechten (u. a. Dashboard-Ziel /login).
 * Kein Ausschluss nach «CEO»-Rollen — jede Organisations-Rolle zaehlt.
 */
export async function getAppShellAccess(userId: string): Promise<{
  access: CeoAccessContext;
  permissions: SidebarPermissionMap;
} | null> {
  const ranked = await getRankedCeoAccessContexts(userId);
  if (ranked.length === 0) {
    return null;
  }

  let best: { access: CeoAccessContext; permissions: SidebarPermissionMap } | null = null;
  let bestScore = -1;
  for (const access of ranked) {
    const permissions = await getSidebarPermissionsForMembership(access.membershipId);
    const score = appShellPermissionScore(permissions);
    if (score > bestScore) {
      bestScore = score;
      best = { access, permissions };
    }
  }
  if (!best) {
    return null;
  }
  return {
    access: best.access,
    permissions: ensureMinimumShellPermissions(best.permissions),
  };
}

/** Erste sinnvolle Route nach Login (ohne kuenstliches Dashboard, wenn andere Bereiche frei sind). */
export async function getPostLoginRedirectPath(userId: string): Promise<string> {
  const shell = await getAppShellAccess(userId);
  if (!shell) return "/no-access";
  const p = shell.permissions;
  if (p.dashboard?.read) return "/dashboard";
  for (const item of SIDEBAR_ITEMS) {
    if (p[item.id]?.read) {
      return item.href;
    }
  }
  return "/no-access";
}

export async function getSidebarAccessContext(itemId: SidebarItemId) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { state: "unauthenticated" as const };
  }

  const shell = await getAppShellAccess(userId);
  if (!shell) {
    return { state: "forbidden" as const };
  }

  const itemPermission = shell.permissions[itemId];
  if (!itemPermission?.read) {
    return { state: "forbidden" as const };
  }

  return {
    state: "ok" as const,
    access: shell.access,
    permissions: shell.permissions,
    canWrite: itemPermission.write,
  };
}

/** OKR-Arbeitsbereich: Sidebar-Schreiben oder Modulrecht `okr.write` (z. B. Teammitglied). */
/** Strategie-Matrix / Jahresziele: Sidebar Jahresziele oder Strategiezyklus. */
export async function getStrategyMatrixAccessContext() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { state: "unauthenticated" as const };
  }

  const shell = await getAppShellAccess(userId);
  if (!shell) {
    return { state: "forbidden" as const };
  }

  const cycle = shell.permissions["strategy-cycle"];
  const annual = shell.permissions["annual-targets"];
  if (!cycle?.read && !annual?.read) {
    return { state: "forbidden" as const };
  }

  const codes = await getPermissionCodesForMembership(shell.access.membershipId);
  const granularWrite =
    codes.has("annual_targets.write.all") ||
    codes.has("annual_targets.write.own") ||
    codes.has("annual_targets.write.department");

  return {
    state: "ok" as const,
    access: shell.access,
    permissions: shell.permissions,
    canWrite: Boolean(cycle?.write || annual?.write || granularWrite),
  };
}

export const getAnnualTargetsAccessContext = getStrategyMatrixAccessContext;

export async function getOkrWorkspaceEffectiveCanWrite(
  page: Extract<Awaited<ReturnType<typeof getSidebarAccessContext>>, { state: "ok" }>
): Promise<boolean> {
  if (page.canWrite) return true;
  const codes = await getPermissionCodesForMembership(page.access.membershipId);
  return codes.has("okr.write");
}
