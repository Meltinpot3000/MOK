"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const TABS = [
  { href: "/okr/dashboard", label: "Übersicht" },
  { href: "/okr/tracking", label: "Tracking" },
  { href: "/okr/planning", label: "Planung" },
  { href: "/okr/review", label: "Review" },
] as const;

function OkrAreaNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const okrCycle = searchParams.get("okrCycle")?.trim();
  const cycleQuery = okrCycle ? `?okrCycle=${encodeURIComponent(okrCycle)}` : "";

  return (
    <nav className="brand-card flex flex-wrap gap-2 p-3" aria-label="OKR-Bereich">
      {TABS.map((tab) => {
        const href = `${tab.href}${cycleQuery}`;
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={href}
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

function OkrAreaNavFallback() {
  return (
    <div className="brand-card flex flex-wrap gap-2 p-3" aria-hidden>
      {TABS.map((tab) => (
        <span
          key={tab.href}
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-400"
        >
          {tab.label}
        </span>
      ))}
    </div>
  );
}

/** Reiter für Unterseiten unter /okr/* — unterhalb der Seitenüberschrift platzieren (wie Reviewzyklus). */
export function OkrAreaNav() {
  return (
    <Suspense fallback={<OkrAreaNavFallback />}>
      <OkrAreaNavInner />
    </Suspense>
  );
}
