"use client";

import type { DesignReadinessFocus } from "@/lib/strategy-cycle/design-readiness-snapshot";

type Props = {
  focus: DesignReadinessFocus;
  onFocusChange: (focus: DesignReadinessFocus) => void;
};

export function ReadinessFocusToggle({ focus, onFocusChange }: Props) {
  return (
    <div
      className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1"
      role="tablist"
      aria-label="Readiness-Fokus"
    >
      <button
        type="button"
        role="tab"
        aria-selected={focus === "challenges"}
        onClick={() => onFocusChange("challenges")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          focus === "challenges"
            ? "bg-teal-700 text-white shadow-sm"
            : "text-zinc-600 hover:bg-zinc-200/60"
        }`}
      >
        Herausforderungen
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={focus === "directions"}
        onClick={() => onFocusChange("directions")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          focus === "directions"
            ? "bg-teal-700 text-white shadow-sm"
            : "text-zinc-600 hover:bg-zinc-200/60"
        }`}
      >
        Sto&szlig;richtungen
      </button>
    </div>
  );
}
