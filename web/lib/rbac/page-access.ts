import {
  SIDEBAR_ITEM_IDS,
  type SidebarItemId,
  type SidebarPermissionMap,
} from "@/lib/sidebar-access";
import type { CeoAccessContext } from "@/lib/ceo/queries";
import { getAuthenticatedUserId, getRankedCeoAccessContexts } from "@/lib/ceo/queries";
import { getSidebarPermissionsForMembership } from "@/lib/rbac/sidebar-access";

/** Zaehlt Leserechte; Dashboard-Zugang wird bei der Shell-Wahl stark bevorzugt (Login-Ziel ist /dashboard). */
function appShellPermissionScore(permissions: SidebarPermissionMap): number {
  const readCount = SIDEBAR_ITEM_IDS.filter((id) => permissions[id]?.read).length;
  const dashboardRead = permissions.dashboard?.read ? 1 : 0;
  return dashboardRead * 10_000 + readCount;
}

/**
 * Wenn irgendein Nav-Punkt lesbar ist, aber nicht das Dashboard: Leserecht fuer Dashboard ergänzen,
 * damit Layout und Zielroute nach Login konsistent sind (sonst Layout ok, Seite -> no-access).
 */
function ensureDashboardReadableIfAnyNavRead(
  permissions: SidebarPermissionMap
): SidebarPermissionMap {
  const hasAnyRead = SIDEBAR_ITEM_IDS.some((id) => permissions[id]?.read);
  if (!hasAnyRead || permissions.dashboard?.read) {
    return permissions;
  }
  return {
    ...permissions,
    dashboard: { read: true, write: permissions.dashboard.write },
  };
}

/** Jede aktive Mitgliedschaft darf die Shell nutzen: mindestens Dashboard-Lesen (z. B. team_member ohne nav.*). */
function ensureMinimumShellPermissions(permissions: SidebarPermissionMap): SidebarPermissionMap {
  const step = ensureDashboardReadableIfAnyNavRead(permissions);
  if (step.dashboard?.read) {
    return step;
  }
  return {
    ...step,
    dashboard: { read: true, write: step.dashboard.write },
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
