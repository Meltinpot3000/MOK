"use client";

import type { ReadinessStatus } from "@/lib/strategy-cycle/design-readiness-snapshot";
import { ReadinessStatusBadge } from "./ReadinessStatusBadge";

type Highlight = "primary" | "secondary" | "dimmed" | "normal";

type Props = {
  label: string;
  mainValue: string;
  subHint: string;
  status: ReadinessStatus;
  highlight?: Highlight;
  metrics?: Array<{ label: string; value: string }>;
  children?: React.ReactNode;
};

export function ReadinessFlowStageCard({
  label,
  mainValue,
  subHint,
  status,
  highlight = "normal",
  metrics,
  children,
}: Props) {
  const surface =
    highlight === "primary"
      ? "border-2 border-teal-700 bg-teal-50/40 shadow-sm ring-2 ring-teal-700/20"
      : highlight === "secondary"
        ? "border border-teal-200 bg-teal-50/25 ring-1 ring-teal-400/25"
        : highlight === "dimmed"
          ? "border border-zinc-200 bg-white opacity-55"
          : "border border-zinc-200 bg-white";

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg p-3 ${surface}`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-zinc-500">
          {label}
        </p>
        <div className="mt-1">
          <ReadinessStatusBadge kind="status" value={status} compact className="self-start" />
        </div>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-900">{mainValue}</p>
      <p className="mt-1 text-[11px] leading-snug text-zinc-600">{subHint}</p>
      {metrics && metrics.length > 0 ? (
        <ul className="mt-2 space-y-0.5 border-t border-zinc-100 pt-2">
          {metrics.map((m) => (
            <li key={m.label} className="flex justify-between gap-2 text-[10px] text-zinc-600">
              <span>{m.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-zinc-800">{m.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}
