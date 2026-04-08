import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { CeoAppShell } from "@/components/ceo/CeoAppShell";
import { getAppShellAccess } from "@/lib/rbac/page-access";
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
  const brandStyle = {
    "--brand-primary": branding?.primary_color ?? "#1D4ED8",
    "--brand-secondary": branding?.secondary_color ?? "#0F172A",
    "--brand-accent": branding?.accent_color ?? "#14B8A6",
  } as CSSProperties;

  return (
    <CeoAppShell
      brandStyle={brandStyle}
      cycles={cycles}
      branding={branding}
      productName={productName}
      permissions={sidebarPermissions}
      nowIso={new Date().toISOString()}
      userDisplayLine={userDisplayLine}
      userEmail={sidebarIdentity.email}
      primaryRoleLabel={primaryRoleLabel}
    >
      {children}
    </CeoAppShell>
  );
}
