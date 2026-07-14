"use client";

import type { FocusDetailAction } from "@/lib/strategy-cycle/design-readiness-snapshot";
import Link from "next/link";
import { actionHref } from "./readiness-ui";

type Props = {
  actions: FocusDetailAction[];
};

export function ReviewActionList({ actions }: Props) {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-zinc-600">Keine weiteren Review-Aktionen nach aktuellen Schwellen.</p>
    );
  }

  const sorted = [...actions].sort((a, b) => a.priority - b.priority);

  return (
    <ol className="space-y-2">
      {sorted.map((action) => {
        const href = actionHref(action);
        const inner = (
          <>
            <span className="font-medium text-zinc-900">{action.label}</span>
            <span className="mt-0.5 block text-xs text-zinc-600">{action.description}</span>
          </>
        );
        return (
          <li key={`${action.priority}-${action.label}`}>
            {href ? (
              <Link
                href={href}
                className="block rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-300 hover:bg-zinc-50"
              >
                {inner}
              </Link>
            ) : (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm opacity-70">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
