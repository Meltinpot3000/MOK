"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PlanningCycle } from "@/lib/ceo/queries";

type DashboardAreaNavProps = {
  cycles: PlanningCycle[];
};

function resolveActiveTopLevelCycle(cycles: PlanningCycle[], nowIso: string): PlanningCycle | null {
  const topLevelCycles = cycles.filter((cycle) => (cycle.level_no ?? 1) === 1);
  const topLevelScope = topLevelCycles.some((cycle) => cycle.is_active_scheme)
    ? topLevelCycles.filter((cycle) => cycle.is_active_scheme)
    : topLevelCycles;
  const nowMs = Date.parse(nowIso);
  return (
    topLevelScope
      .filter((cycle) => Date.parse(cycle.start_date) <= nowMs && nowMs < Date.parse(cycle.end_date))
      .sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date))[0] ??
    topLevelScope
      .filter((cycle) => Date.parse(cycle.start_date) > nowMs)
      .sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date))[0] ??
    topLevelScope
      .filter((cycle) => Date.parse(cycle.end_date) <= nowMs)
      .sort((a, b) => Date.parse(b.end_date) - Date.parse(a.end_date))[0] ??
    null
  );
}

export function DashboardAreaNav({ cycles }: DashboardAreaNavProps) {
  const pathname = usePathname();
  const nowIso = new Date().toISOString();
  const activeTopLevel = resolveActiveTopLevelCycle(cycles, nowIso);

  const tabs: { href: string; label: string }[] = [{ href: "/dashboard", label: "Übersicht" }];
  if (activeTopLevel) {
    tabs.push({ href: `/dashboard/cycles/${activeTopLevel.id}`, label: "Zyklus-Detail" });
  }

  return (
    <nav className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3" aria-label="Strategie-Dashboard">
      {tabs.map((tab) => {
        const active =
          tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith("/dashboard/cycles/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
