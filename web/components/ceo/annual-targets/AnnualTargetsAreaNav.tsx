"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const TABS = [
  { tab: "mine", label: "Meine Jahresziele" },
  { tab: "team", label: "Jahresziele Mitarbeiter" },
] as const;

function AnnualTargetsAreaNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "team" ? "team" : "mine";

  if (pathname !== "/annual-targets" && !pathname.startsWith("/annual-targets/")) {
    return null;
  }

  return (
    <nav className="brand-card flex flex-wrap gap-2 p-3" aria-label="Jahresziele">
      {TABS.map((t) => {
        const href = `/annual-targets?tab=${t.tab}`;
        const active = activeTab === t.tab;
        return (
          <Link
            key={t.tab}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AnnualTargetsAreaNav() {
  return (
    <Suspense
      fallback={
        <div className="brand-card flex flex-wrap gap-2 p-3" aria-hidden>
          {TABS.map((t) => (
            <span key={t.tab} className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm text-zinc-400">
              {t.label}
            </span>
          ))}
        </div>
      }
    >
      <AnnualTargetsAreaNavInner />
    </Suspense>
  );
}
