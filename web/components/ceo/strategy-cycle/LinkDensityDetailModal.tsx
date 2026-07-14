"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { LinkDensityBucket } from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  bucket: LinkDensityBucket | null;
  objectType: "objective" | "challenge";
};

const OBJECT_TYPE_HREF = {
  objective: "/strategy-cycle?l1=objectives",
  challenge: "/strategy-cycle?l1=strategic-directions&l2=challenges",
} as const;

const OBJECT_TYPE_LABEL = {
  objective: "Zum Ziel",
  challenge: "Zur Herausforderung",
} as const;

export function LinkDensityDetailModal({ open, onClose, title, bucket, objectType }: Props) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || !bucket) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-none bg-black/40 p-3 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-density-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(88vh,640px)] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-indigo-50/40 px-4 py-3">
          <div>
            <h2 id="link-density-detail-title" className="text-sm font-semibold text-zinc-900">
              {title}
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-600">
              {bucket.count === 1 ? "1 Eintrag" : `${bucket.count} Einträge`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60"
          >
            Schließen
          </button>
        </div>

        <div className="max-h-[min(62vh,480px)] overflow-y-auto px-4 py-4">
          {bucket.items.length === 0 ? (
            <p className="text-sm text-zinc-500">Keine Einträge in diesem Bucket.</p>
          ) : (
            <ul className="space-y-3">
              {bucket.items.map((item) => (
                <li key={item.id} className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900">{item.label}</p>
                    <p className="shrink-0 text-xs font-semibold tabular-nums text-zinc-600">
                      {item.linkCount} Verknüpfung{item.linkCount === 1 ? "" : "en"}
                    </p>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Verknüpfte Stoßrichtungen
                    </p>
                    {item.linkedDirections.length === 0 ? (
                      <p className="mt-1 text-xs text-zinc-600">
                        Keine Stoßrichtungen verknüpft.
                        {objectType === "objective"
                          ? " Empfehlung: Ziel-Stoßrichtungs-Bezug prüfen."
                          : " Empfehlung: Herausforderung mit Stoßrichtungen verknüpfen."}
                      </p>
                    ) : (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-zinc-700">
                        {item.linkedDirections.map((direction) => (
                          <li key={direction.id}>{direction.label}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <p className="mt-2">
                    <Link
                      href={OBJECT_TYPE_HREF[objectType]}
                      className="text-xs font-medium text-indigo-700 hover:underline"
                      onClick={onClose}
                    >
                      {OBJECT_TYPE_LABEL[objectType]} →
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-zinc-100 px-4 py-3">
          <Link
            href="/strategy-cycle?l1=strategic-directions&l2=design"
            className="text-sm font-medium text-indigo-700 hover:underline"
            onClick={onClose}
          >
            Zum Strategischen Design →
          </Link>
        </div>
      </div>
    </div>
  );
}
