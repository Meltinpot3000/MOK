"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ORGANIZATION_TABS = [
  { href: "/organization", label: "Aufbauorganisation" },
  { href: "/responsibles", label: "Verantwortliche" },
  { href: "/industries", label: "Industrien" },
  { href: "/business-models", label: "Business Models" },
  { href: "/operating-models", label: "Operating Models" },
];

export function OrganizationTabs() {
  const pathname = usePathname();

  return (
    <section className="brand-card p-6">
      <div className="flex flex-wrap gap-2">
        {ORGANIZATION_TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
