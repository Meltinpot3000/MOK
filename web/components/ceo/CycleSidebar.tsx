"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PlanningCycle } from "@/lib/ceo/queries";

type CycleSidebarProps = {
  cycles: PlanningCycle[];
};

function cycleLinkClass(isActive: boolean): string {
  return isActive
    ? "block rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
    : "block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100";
}

export function CycleSidebar({ cycles }: CycleSidebarProps) {
  const pathname = usePathname();
  const isDashboardRoot = pathname === "/dashboard";
  const navItems = [
    { href: "/dashboard", label: "Executive Dashboard" },
    { href: "/key-figures", label: "Strategic Key Figures" },
    { href: "/strategy-cycle", label: "Strategy Cycle View" },
    { href: "/strategic-directions", label: "Strategic Directions" },
    { href: "/annual-targets", label: "Annual Targets" },
    { href: "/initiatives", label: "Initiatives / Programmes" },
    { href: "/okr-workspace", label: "OKR Workspace" },
    { href: "/reviews", label: "Review & Retrospective" },
    { href: "/strategy-matrix", label: "Strategic Dashboard Matrix" },
  ];

  return (
    <aside className="w-72 border-r border-zinc-200 bg-white p-4">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">MOK CEO</h1>
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
          Phase 1 Bereiche
        </p>
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={cycleLinkClass(pathname === item.href || (item.href === "/dashboard" && isDashboardRoot))}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Phase 0 Fundament
        </p>
        <div className="space-y-1">
          <Link href="/organization" className={cycleLinkClass(pathname === "/organization")}>
            Organisation
          </Link>
          <Link href="/responsibles" className={cycleLinkClass(pathname === "/responsibles")}>
            Verantwortliche
          </Link>
          <Link href="/planning-cycles" className={cycleLinkClass(pathname === "/planning-cycles")}>
            Planungszyklen
          </Link>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Zyklen
        </p>
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
    </aside>
  );
}
