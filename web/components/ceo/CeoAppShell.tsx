"use client";

import type { CSSProperties, ReactNode } from "react";
import { CycleSidebar } from "@/components/ceo/CycleSidebar";
import type { PlanningCycle, TenantBranding } from "@/lib/ceo/queries";
import type { SidebarPermissionMap } from "@/lib/sidebar-access";

type CeoAppShellProps = {
  brandStyle: CSSProperties;
  cycles: PlanningCycle[];
  branding: TenantBranding | null;
  productName: string;
  permissions: SidebarPermissionMap;
  nowIso: string;
  userDisplayLine: string;
  userEmail: string | null;
  primaryRoleLabel: string;
  children: ReactNode;
};

/**
 * Eine gemeinsame Client-Boundary für Shell + Sidebar vermeidet Hydration-Kanten zwischen
 * Server-Wrapper und Client-Sidebar (Next/React-Turbopack).
 */
export function CeoAppShell({
  brandStyle,
  cycles,
  branding,
  productName,
  permissions,
  nowIso,
  userDisplayLine,
  userEmail,
  primaryRoleLabel,
  children,
}: CeoAppShellProps) {
  return (
    <div className="brand-shell flex min-h-screen bg-zinc-50" style={brandStyle}>
      <CycleSidebar
        cycles={cycles}
        branding={branding}
        productName={productName}
        permissions={permissions}
        nowIso={nowIso}
        userDisplayLine={userDisplayLine}
        userEmail={userEmail}
        primaryRoleLabel={primaryRoleLabel}
      />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
