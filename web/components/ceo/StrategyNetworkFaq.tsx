"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReferenceFaqItem } from "@/lib/strategy-network/types";

type StrategyNetworkFaqProps = {
  items: ReferenceFaqItem[];
};

export function StrategyNetworkFaq({ items }: StrategyNetworkFaqProps) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <section className="brand-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Häufige Fragen zur Systematik</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Kurzantworten zu Zyklen, Begriffen und Verknüpfungslogik.
          </p>
        </div>
        <Link
          href="/user-manual#begriffe"
          className="text-xs font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
        >
          Alle Begriffe im User Manual
        </Link>
      </div>
      <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
        {items.map((item) => {
          const isOpen = openId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 py-3 text-left"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-zinc-900">{item.question}</span>
                <span className="shrink-0 text-zinc-400" aria-hidden>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen ? (
                <p className="pb-3 text-sm leading-relaxed text-zinc-700">{item.answer}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
