"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pickPlanningCycle, scopePlanningCycles } from "@/lib/ceo/pick-planning-cycle";
import type { PlanningCycle } from "@/lib/ceo/types";

type DashboardAreaNavProps = {
  cycles: PlanningCycle[];
};

function resolveActiveTopLevelCycle(cycles: PlanningCycle[], nowMs: number): PlanningCycle | null {
  const topLevel = scopePlanningCycles(cycles).filter((cycle) => (cycle.level_no ?? 1) === 1);
  return pickPlanningCycle(topLevel, nowMs).cycle;
}

export function DashboardAreaNav({ cycles }: DashboardAreaNavProps) {
  const pathname = usePathname();
  const activeTopLevel = resolveActiveTopLevelCycle(cycles, Date.now());

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
