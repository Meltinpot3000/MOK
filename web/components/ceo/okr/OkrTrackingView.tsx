"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import { createOkrCheckInAction, updateKeyResultAction } from "@/app/(ceo)/okr-workspace/actions";
import { OkrProgressBar } from "@/components/ceo/okr/OkrProgressBar";
import { OkrStatusBadge } from "@/components/ceo/okr/OkrStatusBadge";
import { OkrWarningBadge } from "@/components/ceo/okr/OkrWarningBadge";

function formatDeDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

type OkrTrackingViewProps = {
  cycleInstanceId: string;
  okrCycleId: string | null;
  okrCycleEndDate: string | null;
  canWrite: boolean;
  objectiveViews: OkrObjectiveView[];
};

export function OkrTrackingView({
  cycleInstanceId,
  okrCycleId,
  okrCycleEndDate,
  canWrite,
  objectiveViews,
}: OkrTrackingViewProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [quickFind, setQuickFind] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "on_track" | "at_risk" | "off_track">("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [checkInKrId, setCheckInKrId] = useState<string | null>(null);

  const selectedObjectiveId = sp.get("objective")?.trim() ?? "";

  const quickLower = quickFind.trim().toLowerCase();

  const filteredViews = useMemo(() => {
    return objectiveViews.filter((ov) => {
      const obj = ov.objective;
      if (directionFilter && obj.leadingStrategicDirectionId !== directionFilter) return false;
      if (ownerFilter && obj.ownerMembershipId !== ownerFilter) return false;
      if (statusFilter && ov.rollupStatus !== statusFilter) return false;
      if (criticalOnly && ov.rollupStatus !== "off_track" && !ov.warnings.includes("overdue")) return false;
      if (quickLower) {
        const hitObj = obj.title.toLowerCase().includes(quickLower);
        const hitKr = obj.keyResults.some((kr) => kr.title.toLowerCase().includes(quickLower));
        const hitInit = obj.keyResults.some((kr) =>
          kr.linkedInitiativeTitles.some((t) => t.toLowerCase().includes(quickLower))
        );
        if (!hitObj && !hitKr && !hitInit) return false;
      }
      return true;
    });
  }, [objectiveViews, directionFilter, ownerFilter, statusFilter, criticalOnly, quickLower]);

  const directionOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const ov of objectiveViews) {
      const id = ov.objective.leadingStrategicDirectionId;
      const t = ov.objective.leadingStrategicDirectionTitle;
      if (id && t) m.set(id, t);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"));
  }, [objectiveViews]);

  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const ov of objectiveViews) {
      const id = ov.objective.ownerMembershipId;
      const n = ov.objective.ownerDisplayName;
      if (id && n) m.set(id, n);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"));
  }, [objectiveViews]);

  const selectedView = filteredViews.find((v) => v.objective.id === selectedObjectiveId) ?? null;

  const setObjectiveParam = (id: string) => {
    const p = new URLSearchParams(sp.toString());
    if (id) p.set("objective", id);
    else p.delete("objective");
    router.push(`/okr/tracking?${p.toString()}`);
  };

  if (!okrCycleId) {
    return (
      <p className="brand-card p-6 text-sm text-zinc-600">
        Kein aktiver OKR-Zeitraum gewählt oder angelegt.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="brand-card space-y-3 p-4">
        <label className="block text-xs font-medium text-zinc-600">
          Suche (zusätzlich zu Filtern)
          <input
            type="search"
            value={quickFind}
            onChange={(e) => setQuickFind(e.target.value)}
            placeholder="OKR-Objective-, KR- oder Initiativ-Titel…"
            className="mt-1 w-full max-w-xl rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-zinc-600">
            Stoßrichtung
            <select
              className="ml-1 rounded border border-zinc-300 px-2 py-1 text-sm"
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
            >
              <option value="">Alle</option>
              {directionOptions.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            Owner
            <select
              className="ml-1 rounded border border-zinc-300 px-2 py-1 text-sm"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="">Alle</option>
              {ownerOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            Status (Rollup)
            <select
              className="ml-1 rounded border border-zinc-300 px-2 py-1 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="">Alle</option>
              <option value="on_track">On track</option>
              <option value="at_risk">At risk</option>
              <option value="off_track">Off track</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} />
            Nur kritisch
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="brand-card p-4">
          <h2 className="text-sm font-semibold text-zinc-900">OKR-Objectives</h2>
          <ul className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto">
            {filteredViews.length === 0 ? (
              <li className="text-sm text-zinc-600">
                {objectiveViews.length === 0
                  ? "Keine OKR-Objectives im Zeitraum."
                  : "Keine Treffer für Filter/Suche."}
              </li>
            ) : (
              filteredViews.map((ov) => (
                <li key={ov.objective.id}>
                  <button
                    type="button"
                    onClick={() => setObjectiveParam(ov.objective.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selectedObjectiveId === ov.objective.id
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <span className="font-medium text-zinc-900">{ov.objective.title}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <OkrStatusBadge status={ov.rollupStatus} />
                      <span className="text-xs text-zinc-500">{Math.round(ov.rollupProgressPercent)}%</span>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="brand-card p-4">
          {!selectedView ? (
            <p className="text-sm text-zinc-600">
              {objectiveViews.length === 0
                ? "Kein OKR-Objective im Zeitraum."
                : "Bitte links ein OKR-Objective wählen."}
            </p>
          ) : (
            <div className="space-y-4">
              <header>
                <h2 className="text-lg font-semibold text-zinc-900">{selectedView.objective.title}</h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Stoßrichtung: {selectedView.objective.leadingStrategicDirectionTitle ?? "—"} · Owner:{" "}
                  {selectedView.objective.ownerDisplayName ?? "—"}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Status: <OkrStatusBadge status={selectedView.rollupStatus} /> · Verteilung:{" "}
                  {selectedView.statusDistributionLabel}
                </p>
                <div className="mt-2 max-w-md">
                  <OkrProgressBar value={selectedView.rollupProgressPercent} />
                  <p className="mt-1 text-[10px] text-zinc-400">
                    Fortschritt: MVP-Durchschnitt der KR (keine Governance-Gewichtung).
                  </p>
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  Letzte Aktivität (Check-in bevorzugt): {formatDeDate(selectedView.lastActivityAt)}
                </p>
                {selectedView.warnings.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedView.warnings.map((w) => (
                      <OkrWarningBadge key={w} kind={w} />
                    ))}
                  </div>
                ) : null}
                {selectedView.objective.keyResults.length > 0 ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    Initiativen:{" "}
                    {[
                      ...new Set(
                        selectedView.objective.keyResults.flatMap((kr) => kr.linkedInitiativeTitles)
                      ),
                    ].join(", ") || "—"}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-800">Keine Key Results für dieses OKR-Objective.</p>
                )}
              </header>

              {selectedView.keyResults.length === 0 ? null : (
                <ul className="space-y-3">
                  {selectedView.keyResults.map((kv) => (
                    <li key={kv.keyResult.id} className="rounded-lg border border-zinc-200 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-zinc-900">{kv.keyResult.title}</p>
                          <p className="text-xs text-zinc-600">
                            Owner: {kv.effectiveOwnerDisplayName ?? "—"} · Trend: {kv.trend} · Confidence:{" "}
                            {kv.confidenceLevel ?? "—"}
                          </p>
                        </div>
                        <OkrStatusBadge status={kv.reviewStatus} />
                      </div>
                      <div className="mt-2 max-w-xs">
                        <OkrProgressBar value={kv.progress} />
                      </div>
                      {kv.warnings.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {kv.warnings.map((w) => (
                            <OkrWarningBadge key={w} kind={w} />
                          ))}
                        </div>
                      ) : null}
                      {canWrite ? (
                        <div className="mt-3 space-y-2 border-t border-zinc-100 pt-2">
                          <button
                            type="button"
                            className="rounded bg-zinc-900 px-2 py-1 text-xs text-white"
                            onClick={() => setCheckInKrId(kv.keyResult.id)}
                          >
                            Check-in
                          </button>
                          <form
                            className="space-y-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const fd = new FormData(e.currentTarget);
                              startTransition(async () => {
                                const r = await updateKeyResultAction({
                                  keyResultId: kv.keyResult.id,
                                  title: String(fd.get("title") ?? ""),
                                  metricType: String(fd.get("metric_type") ?? "numeric"),
                                  startValue: fd.get("start_value") ? Number(fd.get("start_value")) : null,
                                  targetValue: fd.get("target_value") ? Number(fd.get("target_value")) : null,
                                  currentValue: fd.get("current_value") ? Number(fd.get("current_value")) : null,
                                  measurementUnit: String(fd.get("measurement_unit") ?? "") || null,
                                  status: String(fd.get("status") ?? "draft"),
                                });
                                if ("error" in r && r.error) window.alert(r.error);
                                else router.refresh();
                              });
                            }}
                          >
                            <input
                              name="title"
                              defaultValue={kv.keyResult.title}
                              className="w-full rounded border px-2 py-1 text-xs"
                            />
                            <p className="w-full text-[11px] text-zinc-600">
                              Fällig:{" "}
                              <span className="font-medium text-zinc-800">
                                {okrCycleEndDate ? formatDeDate(okrCycleEndDate) : formatDeDate(kv.keyResult.dueDate)}
                              </span>
                              <span className="text-zinc-500"> (Ende OKR-Zyklus)</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              <select name="metric_type" defaultValue={kv.keyResult.metricType} className="rounded border text-xs">
                                <option value="numeric">numeric</option>
                                <option value="percent">percent</option>
                                <option value="boolean">boolean</option>
                              </select>
                              <input name="start_value" defaultValue={kv.keyResult.startValue ?? ""} className="w-20 rounded border px-1 text-xs" />
                              <input name="target_value" defaultValue={kv.keyResult.targetValue ?? ""} className="w-20 rounded border px-1 text-xs" />
                              <input name="current_value" defaultValue={kv.keyResult.currentValue ?? ""} className="w-20 rounded border px-1 text-xs" />
                              <input name="measurement_unit" defaultValue={kv.keyResult.measurementUnit ?? ""} className="w-24 rounded border px-1 text-xs" />
                              <select name="status" defaultValue={kv.keyResult.status} className="rounded border text-xs">
                                {["draft", "active", "at_risk", "on_hold", "completed", "archived"].map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button type="submit" disabled={pending} className="mt-1 rounded bg-zinc-700 px-2 py-1 text-xs text-white">
                              KR speichern
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs text-zinc-500">
                Review-Inhalte persistent speichern:{" "}
                <Link href="/okr/review" className="text-zinc-800 underline">
                  OKR Review
                </Link>
              </p>
            </div>
          )}
        </section>
      </div>

      {checkInKrId && okrCycleId ? (
        <CheckInModal
          keyResultId={checkInKrId}
          keyResultTitle={
            selectedView?.keyResults.find((k) => k.keyResult.id === checkInKrId)?.keyResult.title ?? ""
          }
          cycleInstanceId={cycleInstanceId}
          okrCycleId={okrCycleId}
          onClose={() => setCheckInKrId(null)}
          onDone={() => {
            setCheckInKrId(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CheckInModal(props: {
  keyResultId: string;
  keyResultTitle: string;
  cycleInstanceId: string;
  okrCycleId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-zinc-900">Check-in: {props.keyResultTitle}</h3>
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const confLabel = String(fd.get("confidence") ?? "med");
            const confMap = { high: 8, med: 5, low: 2 } as const;
            const confidenceLevel = confMap[confLabel as keyof typeof confMap] ?? 5;
            const currentRaw = fd.get("current_value");
            const updateCurrentValue =
              currentRaw != null && String(currentRaw).trim() !== ""
                ? Number(currentRaw)
                : null;
            const progressValue = Number.isFinite(updateCurrentValue) ? updateCurrentValue : null;
            startTransition(async () => {
              const r = await createOkrCheckInAction({
                cycleInstanceId: props.cycleInstanceId,
                okrCycleId: props.okrCycleId,
                keyResultId: props.keyResultId,
                progressValue,
                confidenceLevel,
                comment: String(fd.get("comment") ?? "").trim() || null,
                updateCurrentValue: Number.isFinite(updateCurrentValue) ? updateCurrentValue : null,
              });
              if ("error" in r && r.error) window.alert(r.error);
              else props.onDone();
            });
          }}
        >
          <label className="block text-xs text-zinc-600">
            Ist-Wert (optional, aktualisiert KR)
            <input name="current_value" type="number" step="any" className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-zinc-600">
            Confidence
            <select name="confidence" className="mt-1 w-full rounded border px-2 py-1 text-sm" defaultValue="med">
              <option value="high">Hoch</option>
              <option value="med">Mittel</option>
              <option value="low">Niedrig</option>
            </select>
          </label>
          <label className="block text-xs text-zinc-600">
            Kommentar
            <textarea name="comment" rows={3} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={props.onClose}>
              Abbrechen
            </button>
            <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white">
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
