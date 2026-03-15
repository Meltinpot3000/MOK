"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PlanningCycle, TenantBranding } from "@/lib/ceo/queries";
import { SIDEBAR_ITEMS, type SidebarPermissionMap } from "@/lib/sidebar-access";

type CycleSidebarProps = {
  cycles: PlanningCycle[];
  branding: TenantBranding | null;
  productName: string;
  permissions: SidebarPermissionMap;
};

function cycleLinkClass(isActive: boolean): string {
  return isActive
    ? "block rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
    : "block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100";
}

export function CycleSidebar({ cycles, branding, productName, permissions }: CycleSidebarProps) {
  const pathname = usePathname();
  const isDashboardRoot = pathname === "/dashboard";
  const phase1Items = SIDEBAR_ITEMS.filter(
    (item) => item.section === "phase1" && permissions[item.id].read
  );
  const phase0Items = SIDEBAR_ITEMS.filter(
    (item) => item.section === "phase0" && permissions[item.id].read
  );
  const cycleItems = SIDEBAR_ITEMS.filter(
    (item) => item.section === "cycles" && permissions[item.id].read
  );
  const adminItems = SIDEBAR_ITEMS.filter(
    (item) => item.section === "admin" && permissions[item.id].read
  );

  return (
    <aside className="w-72 border-r border-zinc-200 bg-white p-4">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          {branding?.logo_url ? (
            <span
              className="inline-block h-6 w-6 rounded bg-zinc-100 bg-cover bg-center"
              style={{ backgroundImage: `url("${branding.logo_url}")` }}
              aria-label="Tenant-Logo"
              title={branding.logo_url}
            />
          ) : null}
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: branding?.primary_color ?? "#18181B" }}
          />
          <h1 className="truncate text-lg font-semibold text-zinc-900" title={productName}>
            {productName}
          </h1>
        </div>
        {branding?.logo_url ? (
          <p className="mt-1 truncate text-xs text-zinc-500" title={branding.logo_url}>
            Logo: {branding.logo_url}
          </p>
        ) : null}
        <p className="mt-1 text-sm text-zinc-500">Rollende Mittelfristplanung</p>
        <a
          href="/logout"
          className="mt-3 inline-block rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Abmelden
        </a>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Strategische Planung
        </p>
        <div className="space-y-1">
          {phase1Items.map((item) => (
            <Link key={item.href} href={item.href} className={cycleLinkClass(pathname === item.href || (item.href === "/dashboard" && isDashboardRoot))}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Organisation
        </p>
        <div className="space-y-1">
          {phase0Items.map((item) => (
            <Link key={item.id} href={item.href} className={cycleLinkClass(pathname === item.href)}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {permissions.dashboard.read ? (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Zyklen
        </p>
        <div className="space-y-1 pb-2">
          {cycleItems.map((item) => (
            <Link key={item.id} href={item.href} className={cycleLinkClass(pathname === item.href)}>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="space-y-2">
          {cycles.map((cycle) => {
            const href = `/dashboard/cycles/${cycle.id}`;
            const isActive = pathname === href;

            return (
              <Link key={cycle.id} href={href} className={cycleLinkClass(isActive)}>
                <div className="truncate">{cycle.name}</div>
                <div className="mt-1 text-xs opacity-80">{cycle.code}</div>
              </Link>
            );
          })}
        </div>
        {cycles.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-sm text-zinc-500">
            Noch keine Planungszyklen vorhanden.
          </p>
        ) : null}
      </div>
      ) : null}

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Administration
        </p>
        <div className="space-y-1">
          {adminItems.map((item) => (
            <Link key={item.id} href={item.href} className={cycleLinkClass(pathname === item.href)}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
