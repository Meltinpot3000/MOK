"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/okr/dashboard", label: "Dashboard" },
  { href: "/okr/tracking", label: "Tracking" },
  { href: "/okr/planning", label: "Planung" },
  { href: "/okr/review", label: "Review" },
] as const;

export function OkrSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3" aria-label="OKR-Bereich">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
