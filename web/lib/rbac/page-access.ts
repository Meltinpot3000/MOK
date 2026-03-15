import type { SidebarItemId } from "@/lib/sidebar-access";
import { getAuthenticatedUserId, getCeoAccessContext } from "@/lib/ceo/queries";
import { getSidebarPermissionsForMembership } from "@/lib/rbac/sidebar-access";

export async function getSidebarAccessContext(itemId: SidebarItemId) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { state: "unauthenticated" as const };
  }

  const access = await getCeoAccessContext(userId);
  if (!access) {
    return { state: "forbidden" as const };
  }

  const permissions = await getSidebarPermissionsForMembership(access.membershipId);
  const itemPermission = permissions[itemId];

  if (!itemPermission?.read) {
    return { state: "forbidden" as const };
  }

  return {
    state: "ok" as const,
    access,
    permissions,
    canWrite: itemPermission.write,
  };
}
