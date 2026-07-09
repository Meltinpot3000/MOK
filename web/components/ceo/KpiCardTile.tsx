"use client";

import type { ReactNode } from "react";
import { useHoverScale } from "@/lib/ui/use-hover-scale";

const TILE_BASE =
  "group relative cursor-pointer rounded-2xl bg-gradient-to-br text-left shadow-md ring-1 hover:shadow-lg hover:ring-2 hover:ring-indigo-300/50";

const TILE_GLOW =
  "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/40 opacity-0 blur-2xl transition group-hover:opacity-100";

type KpiCardTileProps = {
  accent: string;
  paddingClass: string;
  valueSizeClass?: string;
  label: string;
  value: string;
  hint?: string;
  footer?: ReactNode;
  onClick?: () => void;
  interactive?: boolean;
};

export function KpiCardTile({
  accent,
  paddingClass,
  valueSizeClass = "text-2xl sm:text-3xl",
  label,
  value,
  hint,
  footer,
  onClick,
  interactive = Boolean(onClick),
}: KpiCardTileProps) {
  const hover = useHoverScale({ scale: 1.03 });
  const baseClass = `${TILE_BASE} ${paddingClass} ${accent}`;
  const valueClass = `mt-2 font-semibold tabular-nums tracking-tight text-zinc-900 ${valueSizeClass}`;

  const body = (
    <>
      <div className={TILE_GLOW} aria-hidden />
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      <p className={valueClass}>{value}</p>
      {hint ? <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-zinc-600">{hint}</p> : null}
      {footer}
    </>
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${baseClass}`}
        style={hover.style}
        onMouseEnter={hover.onMouseEnter}
        onMouseLeave={hover.onMouseLeave}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={`w-full ${baseClass}`}
      style={hover.style}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
    >
      {body}
    </div>
  );
}
