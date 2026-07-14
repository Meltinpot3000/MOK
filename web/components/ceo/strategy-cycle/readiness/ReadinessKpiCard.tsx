"use client";

import type { ReadinessStatus } from "@/lib/strategy-cycle/design-readiness-snapshot";
import { ReadinessStatusBadge } from "./ReadinessStatusBadge";

type Props = {
  label: string;
  value: string;
  hint: string;
  status?: ReadinessStatus;
};

export function ReadinessKpiCard({ label, value, hint, status }: Props) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
      <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-zinc-500">
          {label}
        </p>
        {status ? <ReadinessStatusBadge kind="status" value={status} compact /> : null}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-zinc-600">{hint}</p>
    </div>
  );
}
