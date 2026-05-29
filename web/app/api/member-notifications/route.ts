import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/ceo/queries";
import { getAppShellAccess } from "@/lib/rbac/page-access";
import { fetchRecentMemberNotifications } from "@/lib/notifications/member-notifications-queries";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ notifications: [] }, { status: 401 });
  }

  const shell = await getAppShellAccess(userId);
  if (!shell) {
    return NextResponse.json({ notifications: [] }, { status: 403 });
  }

  const notifications = await fetchRecentMemberNotifications(
    shell.access.organizationId,
    shell.access.membershipId
  );

  return NextResponse.json({ notifications });
}
