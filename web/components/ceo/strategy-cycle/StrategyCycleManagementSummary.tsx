"use client";

import Link from "next/link";
import type { StrategyCycleDashboardModel } from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";
import { readinessStatusBadgeClass } from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";

type Props = {
  readiness: StrategyCycleDashboardModel["readiness"];
  managementSummary: StrategyCycleDashboardModel["managementSummary"];
};

export function StrategyCycleManagementSummary({ readiness, managementSummary }: Props) {
  return (
    <section className="brand-card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">{managementSummary.title}</h2>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${readinessStatusBadgeClass(readiness.status)}`}
            >
              {readiness.label}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">{readiness.description}</p>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-zinc-700">
            {managementSummary.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
        <div className="shrink-0">
          <Link
            href={managementSummary.ctaHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            {managementSummary.ctaLabel} →
          </Link>
        </div>
      </div>
    </section>
  );
}
