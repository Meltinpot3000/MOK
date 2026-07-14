"use client";

import type { LifecycleDisplayCounts } from "@/lib/strategy-cycle/design-readiness-snapshot";

const SEGMENTS: Array<{
  key: keyof LifecycleDisplayCounts;
  label: string;
  color: string;
}> = [
  { key: "active", label: "Aktiv", color: "bg-emerald-600" },
  { key: "approved", label: "Genehmigt", color: "bg-emerald-400" },
  { key: "draft", label: "Entwurf", color: "bg-zinc-400" },
  { key: "paused", label: "Pausiert", color: "bg-amber-400" },
  { key: "retired", label: "Stillgelegt", color: "bg-zinc-700" },
  { key: "inactive", label: "Inaktiv", color: "bg-zinc-300" },
];

type Props = {
  counts: LifecycleDisplayCounts;
  title?: string;
  prominent?: boolean;
};

export function LifecycleMiniBar({ counts, title, prominent = false }: Props) {
  const total = SEGMENTS.reduce((s, seg) => s + (counts[seg.key] ?? 0), 0);
  if (total === 0) return null;

  return (
    <div className={prominent ? "mt-3" : "mt-2"}>
      {title ? (
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </p>
      ) : null}
      <div
        className="flex h-2 overflow-hidden rounded-full bg-zinc-100"
        title="Anzeige-Klassifikation; Portfolio-Lifecycle unverändert"
      >
        {SEGMENTS.map((seg) => {
          const n = counts[seg.key] ?? 0;
          if (n <= 0) return null;
          return (
            <div
              key={seg.key}
              className={seg.color}
              style={{ width: `${(n / total) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-600">
        {SEGMENTS.map((seg) => {
          const n = counts[seg.key] ?? 0;
          if (n <= 0) return null;
          return (
            <span key={seg.key} className="inline-flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-sm ${seg.color}`} />
              {seg.label} {n}
            </span>
          );
        })}
      </div>
    </div>
  );
}
