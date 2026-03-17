"use client";

import { useFormStatus } from "react-dom";

type AiWaitOverlayProps = {
  title?: string;
  description?: string;
};

export function AiWaitOverlay({
  title = "AI Agent wird befragt",
  description = "Bitte warten, wir berechnen und speichern die Ergebnisse.",
}: AiWaitOverlayProps) {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/45 p-4">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
        </div>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
      </div>
    </div>
  );
}
