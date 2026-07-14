"use client";

import Link from "next/link";
import type { StrategyCycleActionItem } from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";

type Props = {
  actionItems: StrategyCycleActionItem[];
};

export function StrategyCycleActionItems({ actionItems }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Handlungsbedarf</h3>
      {actionItems.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">
          Kein unmittelbarer Handlungsbedarf nach aktuellen Kennzahlen.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {actionItems.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <Link
                href={item.href}
                className="block rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-300 hover:bg-zinc-50"
              >
                <span className="font-medium text-zinc-900">
                  {index + 1}. {item.title}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-600">{item.description}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
