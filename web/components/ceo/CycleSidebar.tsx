"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PlanningCycle, TenantBranding } from "@/lib/ceo/queries";
import {
  SIDEBAR_ITEMS,
  isSidebarNavItemActive,
  type SidebarPermissionMap,
} from "@/lib/sidebar-access";
import { JobNotificationsBell } from "@/components/ceo/JobNotificationsBell";
import { SidebarAccountMenu } from "@/components/ceo/SidebarAccountMenu";

type CycleSidebarProps = {
  cycles: PlanningCycle[];
  branding: TenantBranding | null;
  productName: string;
  permissions: SidebarPermissionMap;
  nowIso: string;
  /** Erste Zeile: voller Name oder E-Mail */
  userDisplayLine: string;
  userEmail: string | null;
  /** Bereits aufgeloeste hoechste Organisations-Rolle (Kurztext). */
  primaryRoleLabel: string;
};

function cycleLinkClass(isActive: boolean): string {
  return isActive
    ? "block rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
    : "block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100";
}

function UserManualIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v19H6.5A2.5 2.5 0 0 0 4 23V4.5A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

export function CycleSidebar({
  cycles,
  branding,
  productName,
  permissions,
  nowIso,
  userDisplayLine,
  userEmail,
  primaryRoleLabel,
}: CycleSidebarProps) {
  const pathname = usePathname();
  const isUserManualActive = pathname === "/user-manual" || pathname.startsWith("/user-manual/");
  const brandingConfig =
    branding?.branding_config && typeof branding.branding_config === "object"
      ? (branding.branding_config as Record<string, unknown>)
      : {};
  const logoPositionX = Math.max(
    0,
    Math.min(
      100,
      typeof brandingConfig.logo_position_x === "number"
        ? brandingConfig.logo_position_x
        : Number(brandingConfig.logo_position_x ?? 50)
    )
  );
  const logoPositionY = Math.max(
    0,
    Math.min(
      100,
      typeof brandingConfig.logo_position_y === "number"
        ? brandingConfig.logo_position_y
        : Number(brandingConfig.logo_position_y ?? 50)
    )
  );
  const topLevelCycles = cycles.filter((cycle) => (cycle.level_no ?? 1) === 1);
  const topLevelScope = topLevelCycles.some((cycle) => cycle.is_active_scheme)
    ? topLevelCycles.filter((cycle) => cycle.is_active_scheme)
    : topLevelCycles;
  const nowMs = Date.parse(nowIso);
  const activeTopLevelCycle =
    topLevelScope
      .filter((cycle) => Date.parse(cycle.start_date) <= nowMs && nowMs < Date.parse(cycle.end_date))
      .sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date))[0] ??
    topLevelScope
      .filter((cycle) => Date.parse(cycle.start_date) > nowMs)
      .sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date))[0] ??
    topLevelScope
      .filter((cycle) => Date.parse(cycle.end_date) <= nowMs)
      .sort((a, b) => Date.parse(b.end_date) - Date.parse(a.end_date))[0] ??
    null;
  const phase1Items = SIDEBAR_ITEMS.filter(
    (item) =>
      item.section === "phase1" &&
      permissions[item.id].read &&
      item.id !== "key-figures" &&
      item.id !== "strategic-directions" &&
      item.id !== "initiatives" &&
      item.id !== "annual-targets"
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

  const showJobBell = permissions["strategy-cycle"]?.read ?? false;

  return (
    <aside className="flex w-72 flex-col border-r border-zinc-200 bg-white p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            {branding?.logo_url ? (
              <span
                className="inline-block h-[41px] w-16 rounded bg-zinc-100"
                style={{
                  backgroundImage: `url("${branding.logo_url}")`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "contain",
                  backgroundPosition: `${logoPositionX}% ${logoPositionY}%`,
                }}
                aria-label="Mandantenlogo"
                title={branding.logo_url}
              />
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Link
              href="/user-manual"
              className={
                isUserManualActive
                  ? "rounded-md bg-zinc-900 p-2 text-white"
                  : "rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }
              aria-label="User Manual öffnen"
              title="User Manual"
            >
              <UserManualIcon />
            </Link>
            {showJobBell ? <JobNotificationsBell /> : null}
          </div>
        </div>
        <h1 className="mt-2.5 break-words text-lg font-semibold leading-tight text-zinc-900">{productName}</h1>
        {userDisplayLine ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-md border border-zinc-200/90 bg-zinc-50 px-3 py-2.5">
            <SidebarAccountMenu userDisplayLine={userDisplayLine} userEmail={userEmail} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-zinc-900" title={userDisplayLine}>
                {userDisplayLine}
              </p>
              {userEmail && userDisplayLine.trim().toLowerCase() !== userEmail.trim().toLowerCase() ? (
                <p className="truncate text-xs text-zinc-500" title={userEmail}>
                  {userEmail}
                </p>
              ) : null}
              <p className="truncate pt-0.5 text-xs font-medium text-zinc-800" title={primaryRoleLabel}>
                {primaryRoleLabel}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Strategische Planung
        </p>
        <div className="space-y-1">
          {phase1Items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cycleLinkClass(isSidebarNavItemActive(pathname, item))}
            >
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
            <Link
              key={item.id}
              href={item.href}
              className={cycleLinkClass(isSidebarNavItemActive(pathname, item))}
            >
              {item.label}
            </Link>
          ))}
          {permissions["strategy-cycle"]?.read ? (
            <Link
              href="/unternehmensinfo"
              className={cycleLinkClass(
                pathname === "/unternehmensinfo" || pathname.startsWith("/unternehmensinfo/")
              )}
            >
              Unternehmensinfo
            </Link>
          ) : null}
        </div>
      </div>

      {permissions.dashboard.read ? (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Zyklen
        </p>
        <div className="space-y-1 pb-2">
          {cycleItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cycleLinkClass(isSidebarNavItemActive(pathname, item))}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="space-y-2">
          {activeTopLevelCycle ? (
            (() => {
              const href = `/dashboard/cycles/${activeTopLevelCycle.id}`;
              const isActive = pathname === href;
              return (
                <Link href={href} className={cycleLinkClass(isActive)}>
                  <div className="truncate">{activeTopLevelCycle.name}</div>
                  <div className="mt-1 text-xs opacity-80">{activeTopLevelCycle.code}</div>
                </Link>
              );
            })()
          ) : null}
        </div>
        {!activeTopLevelCycle ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-sm text-zinc-500">
            Kein aktiver Hauptzyklus vorhanden.
          </p>
        ) : null}
      </div>
      ) : null}

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Verwaltung
        </p>
        <div className="space-y-1">
          {adminItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cycleLinkClass(isSidebarNavItemActive(pathname, item))}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
