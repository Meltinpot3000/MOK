import type { KrCompletionTaskPreview } from "@/lib/tasks/kr-completion-preview";

function formatDeShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function KrCompletionTaskPreviewPanel({
  preview,
  submitterName,
}: {
  preview: KrCompletionTaskPreview;
  submitterName: string | null;
}) {
  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
      <h2 className="text-sm font-semibold text-zinc-900">100-%-Check-in zur Bestätigung</h2>
      <p className="mt-1 text-xs text-zinc-600">
        OKR: {preview.objectiveTitle} · Key Result: {preview.keyResultTitle}
      </p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Gemeldeter Fortschritt</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">
            {preview.checkInProgress != null ? `${Math.round(preview.checkInProgress)} %` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Zuversicht</dt>
          <dd className="mt-0.5 text-zinc-800">
            {preview.checkInConfidence != null ? preview.checkInConfidence : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Eingereicht von</dt>
          <dd className="mt-0.5 text-zinc-800">{submitterName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Zeitpunkt</dt>
          <dd className="mt-0.5 text-zinc-800">{formatDeShort(preview.checkInAt)}</dd>
        </div>
      </dl>
      {preview.checkInComment?.trim() ? (
        <p className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
          <span className="text-xs font-medium text-zinc-500">Check-in-Kommentar: </span>
          {preview.checkInComment.trim()}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] leading-snug text-zinc-500">
        Bei Bestätigung wird das Key Result abgeschlossen. Bei Ablehnung bleibt der letzte bestätigte
        Fortschritt wirksam; dein Kommentar erscheint am KR und der Mitarbeiter erhält eine
        Benachrichtigung.
      </p>
    </section>
  );
}
