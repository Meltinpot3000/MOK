import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { CycleSidebar } from "@/components/ceo/CycleSidebar";
import { getSidebarPermissionsForMembership } from "@/lib/rbac/sidebar-access";
import {
  getAuthenticatedUserId,
  getCeoAccessContext,
  getPlanningCyclesForOrganization,
  getTenantBranding,
} from "@/lib/ceo/queries";

export async function generateMetadata(): Promise<Metadata> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      title: "CITADEL",
    };
  }

  const access = await getCeoAccessContext(userId);
  const productName = access?.organizationName
    ? `${access.organizationName} CITADEL`
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

  const access = await getCeoAccessContext(userId);

  if (!access) {
    redirect("/no-access");
  }

  const [cycles, branding, sidebarPermissions] = await Promise.all([
    getPlanningCyclesForOrganization(access.organizationId),
    getTenantBranding(access.organizationId),
    getSidebarPermissionsForMembership(access.membershipId),
  ]);

  const hasAnySidebarRead = Object.values(sidebarPermissions).some((permission) => permission.read);
  if (!hasAnySidebarRead) {
    redirect("/no-access");
  }
  const productName = access.organizationName
    ? `${access.organizationName} CITADEL`
    : "CITADEL";
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
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
