import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { CycleSidebar } from "@/components/ceo/CycleSidebar";
import { getAppShellAccess } from "@/lib/rbac/page-access";
import {
  getVisibleAdminNavItems,
  getVisibleCyclesNavItems,
  getVisiblePhase0NavItems,
  getVisiblePhase1NavItems,
  getVisibleTopNavItems,
} from "@/lib/sidebar-access";
import { getOpenTaskCountForMembership } from "@/lib/tasks/approval-queries";
import {
  getAuthenticatedUserId,
  getAuthUserSidebarIdentity,
  getPlanningCyclesForOrganization,
  getTenantBranding,
  highestOrgRoleCode,
  labelForOrgRoleCodeDe,
} from "@/lib/ceo/queries";

export async function generateMetadata(): Promise<Metadata> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      title: "CITADEL",
    };
  }

  const shell = await getAppShellAccess(userId);
  const productName = shell?.access.organizationName
    ? `${shell.access.organizationName} CITADEL`
    : "CITADEL";

  return {
    title: productName,
  };
}

export default async function CeoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const shell = await getAppShellAccess(userId);

  if (!shell) {
    redirect("/no-access");
  }

  const { access, permissions: sidebarPermissions } = shell;
  const [cycles, branding, sidebarIdentity] = await Promise.all([
    getPlanningCyclesForOrganization(access.organizationId),
    getTenantBranding(access.organizationId),
    getAuthUserSidebarIdentity(),
  ]);

  const userDisplayLine =
    sidebarIdentity.displayLine.trim() ||
    sidebarIdentity.email?.trim() ||
    "Benutzer";
  const topOrgRoleCode = highestOrgRoleCode(access.roleCodes);
  const primaryRoleLabel = topOrgRoleCode
    ? labelForOrgRoleCodeDe(topOrgRoleCode)
    : "Keine zugewiesene Rolle";

  const productName = access.organizationName
    ? `${access.organizationName} CITADEL`
    : "CITADEL";
  const topNavItems = getVisibleTopNavItems(sidebarPermissions);
  const phase1NavItems = getVisiblePhase1NavItems(sidebarPermissions);
  const phase0NavItems = getVisiblePhase0NavItems(sidebarPermissions);
  const cycleNavItems = getVisibleCyclesNavItems(sidebarPermissions);
  const adminNavItems = getVisibleAdminNavItems(sidebarPermissions);
  const myTasksOpenCount =
    topNavItems.length > 0
      ? await getOpenTaskCountForMembership(access.organizationId, access.membershipId)
      : 0;
  const brandStyle = {
    "--brand-primary": branding?.primary_color ?? "#1D4ED8",
    "--brand-secondary": branding?.secondary_color ?? "#0F172A",
    "--brand-accent": branding?.accent_color ?? "#14B8A6",
  } as CSSProperties;

  return (
    <div className="brand-shell flex min-h-screen bg-zinc-50" style={brandStyle}>
      <CycleSidebar
        cycles={cycles}
        branding={branding}
        productName={productName}
        permissions={sidebarPermissions}
        topNavItems={topNavItems}
        myTasksOpenCount={myTasksOpenCount}
        phase1NavItems={phase1NavItems}
        phase0NavItems={phase0NavItems}
        cycleNavItems={cycleNavItems}
        adminNavItems={adminNavItems}
        nowIso={new Date().toISOString()}
        userDisplayLine={userDisplayLine}
        userEmail={sidebarIdentity.email}
        primaryRoleLabel={primaryRoleLabel}
      />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
