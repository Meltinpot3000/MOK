"use client";

import { useCallback, useEffect, useState } from "react";
import type { OkrCycleKpis } from "@/lib/okr/okr-cycle-view-model";
import {
  fetchOkrDashboardKpiDetailAction,
  type OkrKpiDetailKey,
  type OkrKpiDetailSection,
} from "@/app/(ceo)/okr/dashboard/actions";

type OkrKpiBarProps = {
  kpis: OkrCycleKpis;
  okrCycleId: string;
};

const KPI_DEF: Array<{
  key: OkrKpiDetailKey;
  short: string;
  sub: string;
  accent: string;
  value: (k: OkrCycleKpis) => string | number;
}> = [
  {
    key: "objectives",
    short: "Objectives",
    sub: "OKR-Ziele im Zeitraum",
    accent: "from-violet-500/15 to-fuchsia-500/10 ring-violet-200/60",
    value: (k) => k.objectiveCount,
  },
  {
    key: "keyResults",
    short: "Key Results",
    sub: "Messbare Ergebnisse",
    accent: "from-sky-500/15 to-cyan-500/10 ring-sky-200/60",
    value: (k) => k.keyResultCount,
  },
  {
    key: "status",
    short: "Status-Mix",
    sub: "im Plan / wackelig / kritisch",
    accent: "from-emerald-500/12 to-amber-500/10 ring-emerald-200/50",
    value: (k) => `${k.statusCounts.on_track}/${k.statusCounts.at_risk}/${k.statusCounts.off_track}`,
  },
  {
    key: "critical",
    short: "Kritisch",
    sub: "KRs in Gefahr / überfällig",
    accent: "from-rose-500/18 to-orange-500/10 ring-rose-200/60",
    value: (k) => k.criticalCount,
  },
  {
    key: "krNoInit",
    short: "KR ohne Init.",
    sub: "ohne Initiative-Verknüpfung",
    accent: "from-amber-500/15 to-yellow-500/8 ring-amber-200/55",
    value: (k) => k.keyResultsWithoutInitiative,
  },
  {
    key: "initNoKr",
    short: "Init. ohne KR",
    sub: "Initiative offen",
    accent: "from-orange-500/14 to-red-500/8 ring-orange-200/55",
    value: (k) => k.initiativesWithoutKr,
  },
];

export function OkrKpiBar({ kpis, okrCycleId }: OkrKpiBarProps) {
  const [detail, setDetail] = useState<{
    title: string;
    sections: OkrKpiDetailSection[];
  } | null>(null);
  const [loadingKey, setLoadingKey] = useState<OkrKpiDetailKey | null>(null);

  const openDetail = useCallback(
    async (key: OkrKpiDetailKey) => {
      setLoadingKey(key);
      const r = await fetchOkrDashboardKpiDetailAction(okrCycleId, key);
      setLoadingKey(null);
      if (r.ok) setDetail({ title: r.title, sections: r.sections });
      else window.alert(r.error);
    },
    [okrCycleId]
  );

  useEffect(() => {
    if (!detail) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [detail]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {KPI_DEF.map((def) => {
          const busy = loadingKey === def.key;
          return (
            <button
              key={def.key}
              type="button"
              onClick={() => openDetail(def.key)}
              disabled={busy}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-left shadow-md ring-1 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-wait disabled:opacity-70 ${def.accent}`}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/40 opacity-0 blur-2xl transition group-hover:opacity-100" />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">{def.short}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
                {busy ? "…" : def.value(kpis)}
              </p>
              <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-zinc-600">{def.sub}</p>
              <p className="mt-3 text-[10px] font-medium text-indigo-700 group-hover:underline">
                Details aus Datenbank →
              </p>
            </button>
          );
        })}
      </div>

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-none bg-black/40 p-3 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="okr-kpi-detail-title"
        >
          <div className="max-h-[min(85vh,640px)] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-indigo-50/40 px-4 py-3">
              <h2 id="okr-kpi-detail-title" className="text-sm font-semibold text-zinc-900">
                {detail.title}
              </h2>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60"
              >
                Schließen
              </button>
            </div>
            <div className="max-h-[min(70vh,540px)] space-y-4 overflow-y-auto px-4 py-4">
              {detail.sections.map((sec) => (
                <div key={sec.heading}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{sec.heading}</p>
                  {sec.lines.length === 0 ? (
                    <p className="mt-1 text-xs text-zinc-400">Keine Einträge.</p>
                  ) : (
                    <ul className="mt-1.5 space-y-1.5 text-xs leading-snug text-zinc-700">
                      {sec.lines.map((line, i) => (
                        <li
                          key={`${sec.heading}-${i}`}
                          className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-2.5 py-1.5"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
