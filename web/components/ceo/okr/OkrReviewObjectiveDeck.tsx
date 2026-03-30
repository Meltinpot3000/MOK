"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";
import { OkrStatusBadge } from "@/components/ceo/okr/OkrStatusBadge";

type Props = {
  objectiveViews: OkrObjectiveView[];
  updatesByKrId: Record<string, OkrUpdateRow[]>;
  resetKey: string | null;
};

function formatShortWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Kontrastfarbe 2 = --brand-secondary (CEO-Layout: Primary → Secondary → Accent).
 * 50 % mit Weiß, dann mit neutralem Grau entsättigen, damit die Fläche zurückhaltend bleibt.
 */
const deckShellStyle: CSSProperties = {
  backgroundColor:
    "color-mix(in srgb, color-mix(in srgb, var(--brand-secondary) 50%, white) 72%, #f4f4f5)",
  borderColor: "color-mix(in srgb, var(--brand-secondary) 24%, #d4d4d8)",
};

const deckNavBtnStyle: CSSProperties = {
  borderColor: "color-mix(in srgb, var(--brand-secondary) 30%, #d4d4d8)",
};

function sortObjectivesByOwner(views: OkrObjectiveView[]): OkrObjectiveView[] {
  const copy = [...views];
  copy.sort((a, b) => {
    const oa = a.objective;
    const ob = b.objective;
    const na = (oa.ownerDisplayName ?? "").trim().toLocaleLowerCase("de-DE");
    const nb = (ob.ownerDisplayName ?? "").trim().toLocaleLowerCase("de-DE");
    if (na !== nb) return na.localeCompare(nb, "de-DE");
    const ia = (oa.ownerMembershipId ?? "").trim().toLowerCase();
    const ib = (ob.ownerMembershipId ?? "").trim().toLowerCase();
    if (ia !== ib) return ia.localeCompare(ib);
    return oa.title.localeCompare(ob.title, "de-DE");
  });
  return copy;
}

export function OkrReviewObjectiveDeck({
  objectiveViews,
  updatesByKrId,
  resetKey,
}: Props) {
  const slides = useMemo(() => sortObjectivesByOwner(objectiveViews), [objectiveViews]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [resetKey]);

  useEffect(() => {
    setIndex((i) => (slides.length === 0 ? 0 : Math.min(i, slides.length - 1)));
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <div
        className="rounded-lg border p-4 text-sm text-zinc-600"
        style={deckShellStyle}
      >
        Keine Objectives in diesem OKR-Zeitraum — nichts für die Review-Karten.
      </div>
    );
  }

  const slide = slides[index]!;
  const obj = slide.objective;
  const ownerLine =
    (obj.ownerDisplayName?.trim() || null) ??
    (obj.ownerMembershipId ? `${obj.ownerMembershipId.slice(0, 8)}…` : "Ohne Owner");

  const goPrev = () => setIndex((i) => (i <= 0 ? slides.length - 1 : i - 1));
  const goNext = () => setIndex((i) => (i >= slides.length - 1 ? 0 : i + 1));

  return (
    <div className="rounded-lg border p-4" style={deckShellStyle}>
      <div
        className="flex items-center justify-between gap-2 border-b pb-2"
        style={{ borderBottomColor: "color-mix(in srgb, var(--brand-secondary) 22%, #e4e4e7)" }}
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-800">
          Review-Fokus (Objective für Objective)
        </h4>
        <span className="text-[11px] font-medium text-zinc-600">
          {index + 1} / {slides.length}
        </span>
      </div>
      <div className="mt-3 flex min-h-[200px] items-stretch gap-2">
        <button
          type="button"
          aria-label="Vorheriges Objective"
          onClick={goPrev}
          style={deckNavBtnStyle}
          className="flex w-9 shrink-0 items-center justify-center rounded-md border bg-white text-lg font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          ◀
        </button>
        <div className="min-w-0 flex-1 overflow-y-auto rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            Owner · {ownerLine}
          </p>
          <div className="mt-2 flex flex-wrap items-start gap-2">
            <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-zinc-900">
              {obj.title}
            </h3>
            <OkrStatusBadge status={slide.rollupStatus} />
            <span className="text-xs text-zinc-600">
              Ø-Fortschritt{" "}
              <span className="font-semibold text-zinc-800">
                {Math.round(slide.rollupProgressPercent)}%
              </span>
            </span>
          </div>
          {obj.leadingStrategicDirectionTitle ? (
            <p className="mt-1 text-xs text-zinc-500">
              Richtung: {obj.leadingStrategicDirectionTitle}
            </p>
          ) : null}
          <ul className="mt-4 space-y-4">
            {slide.keyResults.map((kv) => {
              const kr = kv.keyResult;
              const updates = [...(updatesByKrId[kr.id] ?? [])].sort(
                (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
              );
              return (
                <li
                  key={kr.id}
                  className="rounded-md border border-zinc-300 bg-zinc-100 px-2 py-2 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900">{kr.title}</span>
                    <OkrStatusBadge status={kv.reviewStatus} />
                    <span className="text-xs text-zinc-600">
                      Fortschritt <span className="font-semibold">{Math.round(kv.progress)}%</span>
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Check-ins
                    </p>
                    {updates.length === 0 ? (
                      <p className="mt-1 text-xs text-zinc-500">Noch keine Check-in-Einträge.</p>
                    ) : (
                      <ul className="mt-1 space-y-2">
                        {updates.map((u, ui) => (
                          <li
                            key={`${kr.id}-${u.created_at}-${ui}`}
                            className="rounded border border-zinc-200/80 bg-white px-2 py-1.5 text-xs"
                          >
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-600">
                              <span>{formatShortWhen(u.created_at)}</span>
                              {u.progress_value != null ? (
                                <span>Fortschritt: {Math.round(Number(u.progress_value))}%</span>
                              ) : null}
                              {u.confidence_level != null ? (
                                <span>Zuversicht: {u.confidence_level}</span>
                              ) : null}
                            </div>
                            {u.comment?.trim() ? (
                              <p className="mt-1 whitespace-pre-wrap text-zinc-800">{u.comment}</p>
                            ) : (
                              <p className="mt-1 italic text-zinc-400">Kein Kommentar.</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <button
          type="button"
          aria-label="Nächstes Objective"
          onClick={goNext}
          style={deckNavBtnStyle}
          className="flex w-9 shrink-0 items-center justify-center rounded-md border bg-white text-lg font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
