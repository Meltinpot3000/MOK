import type { OkrObjectiveApprovalPreview } from "@/lib/tasks/okr-approval-preview";
import { OkrObjectiveLifecycleBadge } from "@/components/ceo/okr/OkrObjectiveLifecycleBadge";

type Props = {
  preview: OkrObjectiveApprovalPreview;
};

export function OkrApprovalTaskPreview({ preview }: Props) {
  return (
    <section className="mt-6 space-y-4 border-t border-zinc-200 pt-6">
      <h2 className="text-sm font-semibold text-zinc-900">Freigabeinhalt (OKR)</h2>

      <article className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-zinc-900">{preview.title}</h3>
          <OkrObjectiveLifecycleBadge status={preview.status} />
        </div>

        {preview.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {preview.description}
          </p>
        ) : (
          <p className="mt-3 text-sm italic text-zinc-500">Keine Beschreibung hinterlegt.</p>
        )}

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Führende Stoßrichtung
            </dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {preview.leadingStrategicDirectionTitle ?? (
                <span className="font-normal text-amber-800">nicht gesetzt</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Verantwortlicher
            </dt>
            <dd className="mt-0.5 text-zinc-800">{preview.ownerDisplayName ?? "—"}</dd>
          </div>
          {preview.deputyDisplayName ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Stellvertreter
              </dt>
              <dd className="mt-0.5 text-zinc-800">{preview.deputyDisplayName}</dd>
            </div>
          ) : null}
        </dl>

      </article>

      <div>
        <h3 className="text-sm font-semibold text-zinc-900">
          Schlüsselergebnisse ({preview.keyResults.length})
        </h3>
        {preview.keyResults.length === 0 ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Keine Schlüsselergebnisse definiert — Freigabe prüfen.
          </p>
        ) : (
          <ol className="mt-2 space-y-2">
            {preview.keyResults.map((kr, index) => (
              <li
                key={kr.id}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm"
              >
                <p className="font-medium text-zinc-900">
                  {index + 1}. {kr.title}
                </p>
                <p className="mt-1 text-xs text-zinc-600">{kr.metricSummary}</p>
                {kr.ownerDisplayName ? (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Verantwortlicher: {kr.ownerDisplayName}
                  </p>
                ) : null}
                {kr.linkedInitiativeTitles.length > 0 ? (
                  <p className="mt-1 text-xs text-zinc-600">
                    Treiber-Initiativen: {kr.linkedInitiativeTitles.join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-800">Keine Initiative verknüpft</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {preview.contributionRows.length > 0 ? (
        <div className="rounded-lg border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 via-violet-50/90 to-white p-4 shadow-sm ring-1 ring-indigo-200/60">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-800">
            Sentinel✨ Einschätzung
          </p>
          <h3 className="mt-1 text-base font-semibold text-indigo-950">Stoßrichtungs-Fit</h3>
          <ul className="mt-3 space-y-2.5">
            {preview.contributionRows.map((row) => (
              <li
                key={row.targetTitle}
                className="rounded-md border border-indigo-200/80 bg-white/90 px-3 py-2.5 text-sm shadow-sm"
              >
                <p className="font-semibold text-zinc-900">{row.targetTitle}</p>
                <p className="mt-1.5 text-sm leading-snug text-zinc-800">
                  <span className="font-medium text-indigo-900">Ausrichtung:</span>{" "}
                  {row.alignmentLabel}
                  <span className="mx-1.5 text-indigo-300">·</span>
                  <span className="font-medium text-indigo-900">Formulierung:</span>{" "}
                  {row.formulationLabel}
                  <span className="mx-1.5 text-indigo-300">·</span>
                  <span className="font-medium text-indigo-900">Zeitraumspassung:</span>{" "}
                  {row.scopeFitLabel}
                </p>
                {row.reason ? (
                  <p className="mt-2 rounded-md border border-indigo-100 bg-indigo-50/50 px-2 py-1.5 text-xs leading-relaxed text-zinc-700">
                    {row.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
