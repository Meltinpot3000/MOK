"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  OkrPlanningInitiativeRow,
  OkrPlanningKeyResultRow,
  OkrPlanningObjectiveRow,
  OkrPlanningWorkspaceData,
  OkrResponsibleOption,
} from "@/lib/okr/planning-data";
import {
  ExpandableTable,
  type ColumnDef,
  pillLinked,
  pillNeutral,
} from "@/components/ceo/ExpandableTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createKeyResultAction,
  createOkrObjectiveAction,
  deleteKeyResultAction,
  deleteOkrObjectiveAction,
  linkKeyResultInitiativeAction,
  saveOkrPlanningPanelAction,
  shiftOkrObjectiveToNextCycleAction,
  unlinkKeyResultInitiativeAction,
} from "@/app/(ceo)/okr-workspace/actions";
import { resolveNextOkrCycleId } from "@/lib/okr/okr-cycle-nav";
import {
  addressedLinkCountToneClass,
  MATRIX_TABLE_LINK_PILLS_MAX,
} from "@/lib/strategy-cycle/matrix-link-count-tone";
const OKR_FORM_LABEL = "block text-xs text-zinc-600";
const OKR_FORM_CONTROL = "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm";

function okrMetricTypeLabelDe(metricType: string): string {
  switch (metricType) {
    case "numeric":
      return "Numerisch";
    case "percent":
      return "Prozent";
    case "boolean":
      return "erfüllt/Nicht erfüllt";
    default:
      return metricType;
  }
}

function formatKrPlanningReadOnlyLine(kr: OkrPlanningKeyResultRow): string {
  const kind = okrMetricTypeLabelDe(kr.metricType);
  const cur = kr.currentValue ?? "—";
  const tgt = kr.targetValue ?? "—";
  if (kr.metricType === "boolean") {
    return `${kind}: Ist ${cur} · Ziel ${tgt}`;
  }
  if (kr.metricType === "percent") {
    return `${kind}: ${cur} / Ziel ${tgt} %`;
  }
  return `${kind}: ${cur} / Ziel ${tgt} (${kr.measurementUnit ?? "—"})`;
}

type KeyResultMetricTypeUi = "numeric" | "percent" | "boolean";

function normalizeKeyResultMetricType(raw: string | null | undefined): KeyResultMetricTypeUi {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (t === "numeric" || t === "percent" || t === "boolean") return t;
  return "boolean";
}

function formDataEntryOptionalNumber(entry: FormDataEntryValue | null): number | null {
  if (entry == null || entry === "") return null;
  const n = Number(entry);
  return Number.isFinite(n) ? n : null;
}

const OKR_KR_COMPACT_CONTROL =
  "mt-0.5 w-full rounded-md border border-zinc-300 px-1.5 py-1 text-xs";

const OKR_KR_INLINE_LBL = "mb-0 block text-[10px] font-medium text-zinc-500";

/** Zeile 1: Titel. Zeile 2: Metrik, Start/Ziel (nur numerisch/prozent), Einheit (nur numerisch), Fällig, Aktionen; Initiativen darunter. */
function KeyResultPlanningKrOneLineRow({
  kr,
  okrCycleEndDate,
  initiatives,
  cycleInstanceId,
  canWrite,
  canEditThisKr,
  okrKrOwnerMustMatchObjective,
  responsibles,
  startTransition,
  onMutationSuccess,
}: {
  kr: OkrPlanningKeyResultRow;
  okrCycleEndDate: string | null;
  initiatives: OkrPlanningInitiativeRow[];
  cycleInstanceId: string;
  canWrite: boolean;
  canEditThisKr: boolean;
  okrKrOwnerMustMatchObjective: boolean;
  responsibles: OkrResponsibleOption[];
  startTransition: (cb: () => void) => void;
  onMutationSuccess: () => void;
}) {
  const [metricType, setMetricType] = useState<KeyResultMetricTypeUi>(() =>
    normalizeKeyResultMetricType(kr.metricType),
  );
  useEffect(() => {
    setMetricType(normalizeKeyResultMetricType(kr.metricType));
  }, [kr.id, kr.metricType]);
  const showStartTarget = metricType === "numeric" || metricType === "percent";
  const showUnit = metricType === "numeric";
  const ctl = OKR_KR_COMPACT_CONTROL;
  const linkedN = kr.linkedInitiativeIds.length;
  const krFieldsDisabled = !canWrite || !canEditThisKr;
  const [krDeleteOpen, setKrDeleteOpen] = useState(false);

  return (
    <>
      <label className={`block w-full ${OKR_KR_INLINE_LBL}`}>
        Titel
        <input
          name={`kr_${kr.id}_title`}
          required={canEditThisKr}
          disabled={krFieldsDisabled}
          defaultValue={kr.title}
          className={`${ctl} font-medium text-zinc-900`}
        />
      </label>
      {!okrKrOwnerMustMatchObjective ? (
        <label className={`mt-2 block w-full max-w-md ${OKR_KR_INLINE_LBL}`}>
          Key-Result-Owner
          <select
            name={`kr_${kr.id}_owner_membership_id`}
            defaultValue={kr.ownerMembershipId ?? ""}
            disabled={krFieldsDisabled}
            className={ctl}
          >
            <option value="">— (wie Objective-Owner)</option>
            {responsibles.map((r) => (
              <option key={r.membershipId} value={r.membershipId}>
                {r.fullName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={`mt-2 block w-full max-w-md ${OKR_KR_INLINE_LBL}`}>
        Key-Result-Deputy
        <select
          name={`kr_${kr.id}_deputy_membership_id`}
          defaultValue={kr.deputyMembershipId ?? ""}
          disabled={krFieldsDisabled}
          className={ctl}
        >
          <option value="">— (wie Objective-Deputy)</option>
          {responsibles.map((r) => (
            <option key={r.membershipId} value={r.membershipId}>
              {r.fullName}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-2">
        <label className={`w-[7.5rem] shrink-0 ${OKR_KR_INLINE_LBL}`}>
          Metrik
          <select
            name={`kr_${kr.id}_metric_type`}
            value={metricType}
            disabled={krFieldsDisabled}
            onChange={(e) =>
              setMetricType(normalizeKeyResultMetricType(e.target.value))
            }
            className={ctl}
          >
            <option value="boolean">erfüllt/Nicht erfüllt</option>
            <option value="numeric">Numerisch</option>
            <option value="percent">Prozent</option>
          </select>
        </label>
        {showStartTarget ? (
          <Fragment key={`${kr.id}-${metricType}-start-target`}>
            <label className={`w-[4.75rem] shrink-0 sm:w-[5.25rem] ${OKR_KR_INLINE_LBL}`}>
              Start
              <input
                name={`kr_${kr.id}_start_value`}
                type="text"
                inputMode="decimal"
                placeholder="0"
                disabled={krFieldsDisabled}
                defaultValue={kr.startValue ?? ""}
                className={ctl}
              />
            </label>
            <label className={`w-[4.75rem] shrink-0 sm:w-[5.25rem] ${OKR_KR_INLINE_LBL}`}>
              Ziel
              <input
                name={`kr_${kr.id}_target_value`}
                type="text"
                inputMode="decimal"
                placeholder={metricType === "percent" ? "100" : "·"}
                disabled={krFieldsDisabled}
                defaultValue={kr.targetValue ?? ""}
                className={ctl}
              />
            </label>
          </Fragment>
        ) : null}
        {showUnit ? (
          <label className={`w-[5.5rem] shrink-0 sm:w-24 ${OKR_KR_INLINE_LBL}`}>
            Einheit
            <input
              name={`kr_${kr.id}_measurement_unit`}
              type="text"
              placeholder="z. B. €"
              disabled={krFieldsDisabled}
              defaultValue={kr.measurementUnit ?? ""}
              className={ctl}
            />
          </label>
        ) : null}
        <div className={`shrink-0 ${OKR_KR_INLINE_LBL}`}>
          Fällig
          <div className="mt-0.5 whitespace-nowrap px-0.5 py-1 text-xs font-medium tabular-nums text-zinc-800">
            {okrCycleEndDate ? formatDeDate(okrCycleEndDate) : "—"}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-1">
          {kr.warningNoInitiativeLink ? (
            <WarningBadge>Keine Initiative</WarningBadge>
          ) : null}
          <button
            type="button"
            disabled={!canWrite || !canEditThisKr}
            className="whitespace-nowrap text-[11px] text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setKrDeleteOpen(true)}
          >
            Löschen
          </button>
        </div>
      </div>

      {krDeleteOpen ? (
        <ConfirmDialog
          title="Key Result löschen?"
          description="Das Key Result wird dauerhaft entfernt. Verknüpfungen zu Initiativen gehen verloren."
          confirmLabel="Löschen"
          onCancel={() => setKrDeleteOpen(false)}
          onConfirm={() => {
            setKrDeleteOpen(false);
            startTransition(async () => {
              const r = await deleteKeyResultAction({ keyResultId: kr.id });
              if ("error" in r && r.error) window.alert(r.error);
              else onMutationSuccess();
            });
          }}
        />
      ) : null}

      <KrPlanningInitiativesDetails
        autoOpen={kr.warningNoInitiativeLink}
        className="mt-2 rounded-md border border-zinc-200 bg-white [&>summary::-webkit-details-marker]:hidden"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-2 py-1.5 hover:bg-zinc-50">
          <span className="min-w-0 text-left">
            <span className="block text-xs font-medium text-zinc-800">Unterstützende Initiativen</span>
            <span className="mt-0.5 block text-[10px] font-normal leading-snug text-zinc-500">
              Aufklappen und passende Zyklus-Initiativen per Pill verknüpfen — jeder Klick speichert sofort.
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="whitespace-nowrap text-[11px] font-normal tabular-nums text-zinc-600">
              {initiatives.length === 0
                ? "keine im Zyklus"
                : linkedN > 0
                  ? `${linkedN} verknüpft`
                  : "keine verknüpft"}
            </span>
            <span aria-hidden className="text-zinc-400">
              ▾
            </span>
          </span>
        </summary>
        <div className="max-h-48 overflow-y-auto border-t border-zinc-100 p-2">
          {initiatives.length === 0 ? (
            <span className="text-xs text-zinc-500">Keine Initiativen im Zyklus.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {initiatives.map((i) => (
                <KrInitiativePillButton
                  key={i.id}
                  cycleInstanceId={cycleInstanceId}
                  keyResultId={kr.id}
                  initiativeId={i.id}
                  isLinked={kr.linkedInitiativeIds.includes(i.id)}
                  canWrite={canWrite && canEditThisKr}
                  title={i.title}
                >
                  {i.title}
                </KrInitiativePillButton>
              ))}
            </div>
          )}
        </div>
      </KrPlanningInitiativesDetails>
    </>
  );
}

/** Kontrolliertes &lt;details&gt; — React kennt kein defaultOpen auf nativen details-Elementen. */
function KrPlanningInitiativesDetails({
  autoOpen,
  className,
  children,
}: {
  autoOpen: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(autoOpen);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  return (
    <details
      className={className}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      {children}
    </details>
  );
}

function KrInitiativePillButton({
  cycleInstanceId,
  keyResultId,
  initiativeId,
  isLinked,
  canWrite,
  children,
  title,
}: {
  cycleInstanceId: string;
  keyResultId: string;
  initiativeId: string;
  isLinked: boolean;
  canWrite: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [optimisticLinked, setOptimisticLinked] = useState<boolean | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const displayLinked = optimisticLinked !== null ? optimisticLinked : isLinked;

  useEffect(() => {
    if (optimisticLinked !== null && isLinked === optimisticLinked) {
      setOptimisticLinked(null);
    }
  }, [isLinked, optimisticLinked]);

  const runToggle = async () => {
    if (!canWrite || isPending) return;
    setOptimisticLinked(!isLinked);
    setIsPending(true);
    try {
      if (isLinked) {
        const r = await unlinkKeyResultInitiativeAction({
          cycleInstanceId,
          keyResultId,
          initiativeId,
        });
        if ("error" in r && r.error) {
          window.alert(r.error);
          setOptimisticLinked(null);
          return;
        }
      } else {
        const r = await linkKeyResultInitiativeAction({
          cycleInstanceId,
          keyResultId,
          initiativeId,
        });
        if ("error" in r && r.error) {
          window.alert(r.error);
          setOptimisticLinked(null);
          return;
        }
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const handleClick = async () => {
    if (!canWrite || isPending) return;
    if (isLinked) {
      setUnlinkConfirmOpen(true);
      return;
    }
    await runToggle();
  };

  const className = displayLinked ? pillLinked() : pillNeutral();

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={!canWrite || isPending}
        className={`max-w-full break-words text-left ${className} flex items-center gap-1.5 ${isPending ? "opacity-70" : ""}`}
        title={title}
      >
        {children}
        {displayLinked ? <span className="ml-0.5 shrink-0 text-red-600">×</span> : null}
      </button>
      {unlinkConfirmOpen ? (
        <ConfirmDialog
          title="Initiative vom Key Result trennen?"
          description="Die Verknüpfung zwischen diesem Key Result und der Initiative wird aufgehoben."
          confirmLabel="Trennen"
          onCancel={() => setUnlinkConfirmOpen(false)}
          onConfirm={() => {
            setUnlinkConfirmOpen(false);
            void runToggle();
          }}
        />
      ) : null}
    </>
  );
}

type OkrPlanningWorkspaceProps = {
  data: OkrPlanningWorkspaceData;
  cycleInstanceId: string;
  canWrite: boolean;
  currentMembershipId: string;
  /** OKR-Objective-Owner: nach OKR-Berechtigung gefiltert (z. B. nur du bei update.own). */
  objectiveOwnerChoices: OkrResponsibleOption[];
  objectiveEditById: Record<string, boolean>;
  keyResultEditById: Record<string, boolean>;
  canCreateKeyResultByObjectiveId: Record<string, boolean>;
  /** Anzahl Objectives im Zeitraum vor Lesefilter — für Leermeldung wie im Tracking */
  inCycleOkrObjectiveCountBeforeReadFilter?: number;
};

function formatDeDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function okrObjectiveStatusLabelDe(status: string): string {
  if (status === "shifted") return "Verschoben";
  return status;
}

function WarningBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
      {children}
    </span>
  );
}

/** Alle über Key Results verknüpften Initiativen eines Objectives, nach Titel sortiert, IDs dedupliziert. */
function OkrObjectiveRowActions({
  cycleInstanceId,
  objectiveId,
  objectiveStatus,
  selectedOkrCycleId,
  canEditRow,
  canWrite,
  hasNextCycle,
  pending,
  startTransition,
  router,
  onAfterShift,
}: {
  cycleInstanceId: string;
  objectiveId: string;
  objectiveStatus: string;
  selectedOkrCycleId: string | null;
  canEditRow: boolean;
  canWrite: boolean;
  hasNextCycle: boolean;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  router: ReturnType<typeof useRouter>;
  onAfterShift: () => void;
}) {
  const [shiftConfirmOpen, setShiftConfirmOpen] = useState(false);
  const allowed =
    canWrite &&
    canEditRow &&
    Boolean(selectedOkrCycleId) &&
    objectiveStatus !== "shifted" &&
    hasNextCycle;

  if (!allowed) {
    return <span className="inline-block w-8" aria-hidden />;
  }

  const runShiftToNextCycle = () => {
    startTransition(async () => {
      const r = await shiftOkrObjectiveToNextCycleAction({
        cycleInstanceId,
        objectiveId,
        fromOkrCycleId: selectedOkrCycleId!,
      });
      if (r && "error" in r && r.error) window.alert(r.error);
      else if (r && "newOkrCycleId" in r && r.newOkrCycleId) {
        router.push(`/okr/planning?okrCycle=${encodeURIComponent(r.newOkrCycleId)}`);
        onAfterShift();
      }
    });
  };

  return (
    <>
      <details className="relative">
        <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden">
          <span className="sr-only">Aktionen zu Objective</span>
          <span className="select-none text-lg leading-none" aria-hidden>
            ⋮
          </span>
        </summary>
        <div className="absolute right-0 z-20 mt-1 min-w-[14rem] rounded-md border border-zinc-200 bg-white py-1 shadow-md">
          <button
            type="button"
            disabled={pending}
            className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            onClick={(e) => {
              e.preventDefault();
              const det = e.currentTarget.closest("details") as HTMLDetailsElement | null;
              if (det) det.open = false;
              setShiftConfirmOpen(true);
            }}
          >
            OKR-Objective in den nächsten Zyklus verschieben
          </button>
        </div>
      </details>
      {shiftConfirmOpen ? (
        <ConfirmDialog
          title="Objective in den nächsten Zyklus verschieben?"
          description="Offene Key Results (Fortschritt unter 100 %) werden in den nächsten OKR-Zeitraum kopiert; Initiative-Verknüpfungen werden den Kopien zugeordnet. Das Objective hier wird als «Verschoben» markiert."
          confirmLabel="Verschieben"
          pending={pending}
          onCancel={() => setShiftConfirmOpen(false)}
          onConfirm={() => {
            setShiftConfirmOpen(false);
            runShiftToNextCycle();
          }}
        />
      ) : null}
    </>
  );
}

function collectLinkedInitiativesForOkrObjective(
  o: OkrPlanningObjectiveRow,
): Array<{ id: string; title: string }> {
  const byId = new Map<string, string>();
  for (const kr of o.keyResults) {
    for (let i = 0; i < kr.linkedInitiativeIds.length; i++) {
      const id = kr.linkedInitiativeIds[i];
      const title = kr.linkedInitiativeTitles[i] ?? id;
      byId.set(id, title);
    }
  }
  return [...byId.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
}

function buildOkrObjectiveTableColumns(
  cycleInitiativeCount: number,
): ColumnDef<OkrPlanningObjectiveRow>[] {
  return [
    {
      id: "title",
      label: "Objective",
      sortValue: (o) => o.title,
      render: (o) => <span className="font-medium text-zinc-900">{o.title}</span>,
    },
    {
      id: "direction",
      label: "Stoßrichtung",
      sortValue: (o) => o.leadingStrategicDirectionTitle ?? "",
      render: (o) =>
        o.leadingStrategicDirectionTitle ? (
          <span className="text-zinc-700">{o.leadingStrategicDirectionTitle}</span>
        ) : (
          <span className="text-amber-800">nicht gesetzt</span>
        ),
    },
    {
      id: "owner",
      label: "Owner",
      sortValue: (o) => o.ownerDisplayName ?? "",
      render: (o) => (
        <span className="text-zinc-700">
          {o.ownerDisplayName ?? <span className="text-zinc-400">—</span>}
        </span>
      ),
    },
    {
      id: "kr_count",
      label: "Key Results",
      sortValue: (o) => o.keyResults.length,
      render: (o) => <span className="tabular-nums text-zinc-800">{o.keyResults.length}</span>,
    },
    {
      id: "initiatives",
      label: "Unterstützende Initiativen",
      defaultVisible: true,
      sortValue: (o) => collectLinkedInitiativesForOkrObjective(o).length,
      render: (o) => {
        const linked = collectLinkedInitiativesForOkrObjective(o);
        if (linked.length === 0) return <span className="text-zinc-400">—</span>;
        const n = linked.length;
        const total = cycleInitiativeCount;
        return (
          <div className="space-y-1">
            <div
              className={`text-[10px] font-semibold tabular-nums ${addressedLinkCountToneClass(n)}`}
              title="Anzahl verknüpfter Initiativen vs. alle im Zyklus (Farbe wie Strategie-Matrix)"
            >
              Init {n}/{total}
            </div>
            <div className="flex flex-wrap gap-1">
              {linked.slice(0, MATRIX_TABLE_LINK_PILLS_MAX).map((item) => (
                <span
                  key={item.id}
                  className={`${pillLinked()} inline-flex max-w-[168px] items-center gap-0.5`}
                  title={item.title}
                >
                  <span className="min-w-0 truncate">{item.title}</span>
                </span>
              ))}
              {n > MATRIX_TABLE_LINK_PILLS_MAX ? (
                <span className={pillLinked()}>+{n - MATRIX_TABLE_LINK_PILLS_MAX}</span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      label: "Status",
      sortValue: (o) => o.status,
      render: (o) => <span className="text-zinc-700">{okrObjectiveStatusLabelDe(o.status)}</span>,
    },
    {
      id: "progress",
      label: "Fortschritt",
      sortValue: (o) => o.progressPercent,
      render: (o) => <span className="tabular-nums text-zinc-700">{o.progressPercent}%</span>,
    },
  ];
}

export function OkrPlanningWorkspace({
  data,
  cycleInstanceId,
  canWrite,
  currentMembershipId,
  objectiveOwnerChoices,
  objectiveEditById,
  keyResultEditById,
  canCreateKeyResultByObjectiveId,
  inCycleOkrObjectiveCountBeforeReadFilter,
}: OkrPlanningWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = () => router.refresh();
  const [quickFind, setQuickFind] = useState("");

  const quickLower = quickFind.trim().toLowerCase();

  const selectedOkrCycleEndDate = useMemo(() => {
    const id = data.selectedOkrCycleId;
    if (!id) return null;
    return data.okrCycles.find((c) => c.id === id)?.end_date ?? null;
  }, [data.okrCycles, data.selectedOkrCycleId]);

  const filteredOkrObjectives = useMemo(() => {
    if (!quickLower) return data.okrObjectives;
    return data.okrObjectives.filter((obj) => {
      if (obj.title.toLowerCase().includes(quickLower)) return true;
      if (obj.keyResults.some((kr) => kr.title.toLowerCase().includes(quickLower))) return true;
      return obj.keyResults.some((kr) =>
        kr.linkedInitiativeTitles.some((t) => t.toLowerCase().includes(quickLower))
      );
    });
  }, [data.okrObjectives, quickLower]);

  const tableEmptyMessage = !data.selectedOkrCycleId
    ? "Kein Zeitraum gewählt."
    : data.okrObjectives.length === 0
      ? inCycleOkrObjectiveCountBeforeReadFilter != null &&
          inCycleOkrObjectiveCountBeforeReadFilter > 0
        ? "Es gibt Objectives in diesem Zeitraum, aber keines, das Sie mit Ihrer Rolle lesen dürfen (Owner, Deputy oder direkte Team-Linie)."
        : "Noch kein OKR-Objective in diesem Zeitraum — links im Formular anlegen."
      : "Keine Treffer für die Suche — Suchfeld leeren, um alle Objectives zu sehen.";

  const nextOkrCycleId = useMemo(
    () =>
      resolveNextOkrCycleId(
        data.okrCycles.map((c) => ({ id: c.id, start_date: c.start_date })),
        data.selectedOkrCycleId,
      ),
    [data.okrCycles, data.selectedOkrCycleId],
  );

  const objectiveTableColumns = useMemo(() => {
    const base = buildOkrObjectiveTableColumns(data.initiatives.length);
    return [
      ...base,
      {
        id: "actions",
        label: "",
        headerClassName: "w-10 max-w-[2.5rem]",
        cellClassName: "w-10 max-w-[2.5rem]",
        render: (o: OkrPlanningObjectiveRow) => (
          <OkrObjectiveRowActions
            cycleInstanceId={cycleInstanceId}
            objectiveId={o.id}
            objectiveStatus={o.status}
            selectedOkrCycleId={data.selectedOkrCycleId}
            canEditRow={Boolean(objectiveEditById[o.id])}
            canWrite={canWrite}
            hasNextCycle={Boolean(nextOkrCycleId)}
            pending={pending}
            startTransition={startTransition}
            router={router}
            onAfterShift={() => router.refresh()}
          />
        ),
      },
    ];
  }, [
    data.initiatives.length,
    cycleInstanceId,
    data.selectedOkrCycleId,
    canWrite,
    objectiveEditById,
    nextOkrCycleId,
    pending,
    router,
    startTransition,
  ]);

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">OKR anlegen</h2>

        {data.okrCycles.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Kein OKR-Zeitraum für diesen Zyklus angelegt. Legen Sie zuerst einen OKR-Zyklus an (z. B. über
            Administration / Datenpflege).
          </p>
        ) : (
          <>
            <p className="mt-4 text-xs text-zinc-500">
              OKR-Zeitraum wählst du oben per Pfeiltasten — der gewählte Zeitraum gilt für Anlage und Übersicht.
            </p>

            {data.selectedOkrCycleId && canWrite && objectiveOwnerChoices.length === 0 ? (
              <p className="mt-4 text-xs text-amber-800">
                Objective anlegen ist derzeit nicht möglich: für deine Rolle sind keine zulässigen Objective-Owner-Einträge ermittelbar. Bitte Zugriffssteuerung prüfen (
                <span className="font-mono">okr.objective.update.own</span> oder <span className="font-mono">.all</span>).
              </p>
            ) : null}
            {data.selectedOkrCycleId && canWrite && objectiveOwnerChoices.length > 0 ? (
              <CreateOkrObjectiveForm
                cycleInstanceId={cycleInstanceId}
                okrCycleId={data.selectedOkrCycleId}
                directions={data.strategicDirections}
                objectiveOwnerChoices={objectiveOwnerChoices}
                currentMembershipId={currentMembershipId}
                pending={pending}
                startTransition={startTransition}
                onSuccess={refresh}
              />
            ) : null}

            {data.selectedOkrCycleId && !canWrite ? (
              <p className="mt-4 text-xs text-zinc-500">Lesemodus: neue Objectives können hier nicht angelegt werden.</p>
            ) : null}
          </>
        )}
      </article>

      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">OKR-Übersicht</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Sortierbare Tabelle — Zeile aufklappen: ein Formular für Objective und alle Key Results.
        </p>

        <label className="mt-4 block text-xs font-medium text-zinc-600">
          Suche
          <input
            type="search"
            value={quickFind}
            onChange={(e) => setQuickFind(e.target.value)}
            placeholder="Objective-, KR- oder Initiativ-Titel…"
            className="mt-1 w-full max-w-xl rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>

        <div className="mt-4 min-w-0">
          {data.okrCycles.length === 0 ? (
            <p className="text-sm text-zinc-600">Kein OKR-Zeitraum — keine Übersicht möglich.</p>
          ) : (
            <ExpandableTable<OkrPlanningObjectiveRow>
              columns={objectiveTableColumns}
              rows={filteredOkrObjectives}
              getRowId={(o) => o.id}
              emptyMessage={tableEmptyMessage}
              renderExpandedContent={(obj) => (
                <OkrObjectiveExpandedPanel
                  objective={obj}
                  cycleInstanceId={cycleInstanceId}
                  okrCycleEndDate={selectedOkrCycleEndDate}
                  directions={data.strategicDirections}
                  responsibles={data.responsibles}
                  objectiveOwnerChoices={objectiveOwnerChoices}
                  initiatives={data.initiatives}
                  canWrite={canWrite}
                  okrKrOwnerMustMatchObjective={data.okrKrOwnerMustMatchObjective}
                  currentMembershipId={currentMembershipId}
                  objectiveEditById={objectiveEditById}
                  keyResultEditById={keyResultEditById}
                  canCreateKeyResultByObjectiveId={canCreateKeyResultByObjectiveId}
                  pending={pending}
                  startTransition={startTransition}
                  onMutationSuccess={refresh}
                />
              )}
            />
          )}
        </div>
      </article>
    </section>
  );
}

function CreateOkrObjectiveForm(props: {
  cycleInstanceId: string;
  okrCycleId: string;
  directions: Array<{ id: string; title: string }>;
  objectiveOwnerChoices: OkrResponsibleOption[];
  currentMembershipId: string;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onSuccess: () => void;
}) {
  const {
    cycleInstanceId,
    okrCycleId,
    directions,
    objectiveOwnerChoices,
    currentMembershipId,
    pending,
    startTransition,
    onSuccess,
  } = props;
  const defaultOwnerValue =
    objectiveOwnerChoices.find((r) => r.membershipId === currentMembershipId)?.membershipId ??
    objectiveOwnerChoices[0]?.membershipId ??
    "";
  const ownerOptionsLimited =
    objectiveOwnerChoices.length > 0 &&
    objectiveOwnerChoices.every((r) => r.membershipId === currentMembershipId);
  const [newObjectiveTitle, setNewObjectiveTitle] = useState("");
  const [newObjectiveDescription, setNewObjectiveDescription] = useState("");
  const [newObjectiveDirectionId, setNewObjectiveDirectionId] = useState("");
  const createObjectiveCanSubmit =
    directions.length > 0 &&
    objectiveOwnerChoices.length > 0 &&
    newObjectiveTitle.trim().length > 0 &&
    newObjectiveDescription.trim().length > 0 &&
    newObjectiveDirectionId.trim().length > 0;

  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-dashed border-zinc-300 p-4"
      action={(fd) => {
        startTransition(async () => {
          const title = String(fd.get("title") ?? "").trim();
          const strategicDirectionId = String(fd.get("strategic_direction_id") ?? "").trim();
          const description = String(fd.get("description") ?? "").trim();
          const ownerRaw = String(fd.get("owner_membership_id") ?? "").trim();
          const r = await createOkrObjectiveAction({
            cycleInstanceId,
            okrCycleId,
            title,
            description,
            strategicDirectionId,
            ownerMembershipId: ownerRaw || null,
          });
          if ("error" in r && r.error) window.alert(r.error);
          else {
            setNewObjectiveTitle("");
            setNewObjectiveDescription("");
            setNewObjectiveDirectionId("");
            onSuccess();
          }
        });
      }}
    >
      <p className="text-sm font-medium text-zinc-800">Neues OKR-Objective</p>
      <p className="mt-1 text-xs text-zinc-500">
        Initiativen werden pro Key Result verknüpft: Objective-Zeile rechts aufklappen, Key Result anlegen oder
        aufklappen, Initiativen-Pills wählen.
      </p>
      <input type="hidden" name="okr_cycle_id" value={okrCycleId} />
      <label className="block text-xs text-zinc-600">
        Titel *
        <input
          name="title"
          required
          value={newObjectiveTitle}
          onChange={(e) => setNewObjectiveTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-zinc-600">
        Führende Stoßrichtung *
        <select
          name="strategic_direction_id"
          required
          value={newObjectiveDirectionId}
          onChange={(e) => setNewObjectiveDirectionId(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Bitte wählen…
          </option>
          {directions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-zinc-600">
        Beschreibung *
        <textarea
          name="description"
          required
          rows={6}
          value={newObjectiveDescription}
          onChange={(e) => setNewObjectiveDescription(e.target.value)}
          className="mt-1 min-h-[9rem] w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-zinc-600">
        OKR-Objective-Owner *
        <select
          name="owner_membership_id"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          defaultValue={defaultOwnerValue}
        >
          {objectiveOwnerChoices.map((r) => (
            <option key={r.membershipId} value={r.membershipId}>
              {r.fullName}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[10px] text-zinc-500">
          {ownerOptionsLimited
            ? "Mit deiner Rolle ist nur du als Objective-Owner wählbar."
            : "Liste entspricht deinen OKR-Objective-Berechtigungen (z. B. nur «eigen» oder alle)."}
        </span>
      </label>
      <button
        type="submit"
        disabled={pending || directions.length === 0 || !createObjectiveCanSubmit}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        OKR-Objective anlegen
      </button>
    </form>
  );
}

function OkrObjectiveExpandedPanel(props: {
  objective: OkrPlanningObjectiveRow;
  cycleInstanceId: string;
  okrCycleEndDate: string | null;
  directions: Array<{ id: string; title: string }>;
  responsibles: OkrResponsibleOption[];
  objectiveOwnerChoices: OkrResponsibleOption[];
  initiatives: OkrPlanningInitiativeRow[];
  canWrite: boolean;
  okrKrOwnerMustMatchObjective: boolean;
  currentMembershipId: string;
  objectiveEditById: Record<string, boolean>;
  keyResultEditById: Record<string, boolean>;
  canCreateKeyResultByObjectiveId: Record<string, boolean>;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onMutationSuccess: () => void;
}) {
  const {
    objective,
    cycleInstanceId,
    okrCycleEndDate,
    directions,
    responsibles,
    objectiveOwnerChoices,
    initiatives,
    canWrite,
    okrKrOwnerMustMatchObjective,
    currentMembershipId,
    objectiveEditById,
    keyResultEditById,
    canCreateKeyResultByObjectiveId,
    pending,
    startTransition,
    onMutationSuccess,
  } = props;

  const [objectiveDeleteOpen, setObjectiveDeleteOpen] = useState(false);

  const ownerChoicesForPanel = useMemo(() => {
    const byId = new Map(objectiveOwnerChoices.map((r) => [r.membershipId, r]));
    const oid = objective.ownerMembershipId;
    if (oid && !byId.has(oid)) {
      const label = objective.ownerDisplayName ?? "Owner";
      return [...objectiveOwnerChoices, { membershipId: oid, fullName: label }];
    }
    return objectiveOwnerChoices;
  }, [
    objective.ownerMembershipId,
    objective.ownerDisplayName,
    objectiveOwnerChoices,
  ]);

  const ownerOptionsLimited =
    objectiveOwnerChoices.length > 0 &&
    objectiveOwnerChoices.every((r) => r.membershipId === currentMembershipId);

  const canEditObjective = Boolean(objectiveEditById[objective.id]);
  const showPanelSave =
    canEditObjective ||
    objective.keyResults.some((kr) => Boolean(keyResultEditById[kr.id]));

  const krIdsJson = JSON.stringify(objective.keyResults.map((k) => k.id));

  const headerMeta = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Objective bearbeiten</p>
        <p className="mt-0.5 text-xs text-zinc-600">
          Stoßrichtung:{" "}
          {objective.leadingStrategicDirectionTitle ?? (
            <span className="text-amber-800">nicht gesetzt</span>
          )}
          {objective.ownerDisplayName ? ` · Owner: ${objective.ownerDisplayName}` : ""}
          {objective.deputyDisplayName ? ` · Deputy: ${objective.deputyDisplayName}` : ""}
        </p>
      </div>
      {canWrite && canEditObjective && objective.status !== "shifted" ? (
        <button
          type="button"
          className="text-xs text-red-700 hover:underline"
          onClick={() => setObjectiveDeleteOpen(true)}
        >
          Objective löschen
        </button>
      ) : null}
    </div>
  );

  if (!canWrite || objective.status === "shifted") {
    return (
      <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/50 px-1 py-4 sm:px-2">
        {headerMeta}
        {objective.status === "shifted" ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Dieses Objective wurde in einen späteren OKR-Zeitraum verschoben. Bearbeitung ist hier
            deaktiviert; offene Key Results und Verknüpfungen sind im neuen Zeitraum fortgeführt.
          </p>
        ) : null}
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-sm font-semibold text-zinc-900">Key Results</p>
          <ul className="mt-2 space-y-3">
            {objective.keyResults.map((kr) => (
                <li key={kr.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-medium text-zinc-900">{kr.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {formatKrPlanningReadOnlyLine(kr)}
                    {okrCycleEndDate ? (
                      <span className="ml-1 text-zinc-500">· Fällig: {formatDeDate(okrCycleEndDate)}</span>
                    ) : null}
                  </p>
                  {kr.linkedInitiativeTitles.length > 0 ? (
                    <p className="mt-1 text-xs text-zinc-600">
                      Treiber: {kr.linkedInitiativeTitles.join(", ")}
                    </p>
                  ) : null}
                </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/50 px-1 py-4 sm:px-2">
      {headerMeta}
      <p className="text-xs text-zinc-600">
        Objective- und Key-Result-Felder bearbeiten, dann{" "}
        <span className="font-medium text-zinc-800">«Alles speichern»</span> (nur wo deine OKR-Berechtigung
        passt). Pro KR die aufklappbare Zeile mit Verknüpfungen öffnen — Klick auf eine Pill speichert sofort.
      </p>

      <form
        className="space-y-6 rounded-lg border border-zinc-200 bg-white p-4"
        action={(fd) => {
          startTransition(async () => {
            const r = await saveOkrPlanningPanelAction(fd);
            if (r && "error" in r && r.error) window.alert(r.error);
            else onMutationSuccess();
          });
        }}
      >
        <input type="hidden" name="cycle_instance_id" value={cycleInstanceId} />
        <input type="hidden" name="objective_id" value={objective.id} />
        <input type="hidden" name="kr_ids_json" value={krIdsJson} />

        <div className="space-y-3 border-b border-zinc-100 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Objective</p>
            {!canEditObjective ? (
            <p className="text-xs text-zinc-600">
              Objective-Köpfel sind schreibgeschützt. Key Results unten ggf. weiter bearbeitbar — je nach
              Berechtigung.
            </p>
          ) : null}
          <label className={OKR_FORM_LABEL}>
            Titel
            <input
              name="title"
              required={canEditObjective}
              disabled={!canEditObjective}
              defaultValue={objective.title}
              className={OKR_FORM_CONTROL}
            />
          </label>
          <label className={OKR_FORM_LABEL}>
            Führende Stoßrichtung
            <select
              name="strategic_direction_id"
              defaultValue={objective.leadingStrategicDirectionId ?? ""}
              required={canEditObjective}
              disabled={!canEditObjective}
              className={OKR_FORM_CONTROL}
            >
              {directions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          <label className={OKR_FORM_LABEL}>
            Beschreibung *
            <textarea
              name="description"
              rows={6}
              required={canEditObjective}
              disabled={!canEditObjective}
              defaultValue={objective.description ?? ""}
              className={`${OKR_FORM_CONTROL} min-h-[9rem]`}
            />
          </label>
          <label className={OKR_FORM_LABEL}>
            OKR-Objective-Owner *
            <select
              name="owner_membership_id"
              defaultValue={
                objective.ownerMembershipId ?? ownerChoicesForPanel[0]?.membershipId ?? ""
              }
              required={canEditObjective}
              disabled={!canEditObjective}
              className={OKR_FORM_CONTROL}
            >
              {ownerChoicesForPanel.map((r) => (
                <option key={r.membershipId} value={r.membershipId}>
                  {r.fullName}
                </option>
              ))}
            </select>
            {canEditObjective ? (
              <span className="mt-1 block text-[10px] text-zinc-500">
                {ownerOptionsLimited
                  ? "Mit deiner Rolle ist nur du als Objective-Owner wählbar."
                  : "Liste entspricht deinen OKR-Objective-Berechtigungen."}
              </span>
            ) : null}
          </label>
          <label className={OKR_FORM_LABEL}>
            Stellvertretung (Deputy)
            <select
              name="deputy_membership_id"
              defaultValue={objective.deputyMembershipId ?? ""}
              disabled={!canEditObjective}
              className={OKR_FORM_CONTROL}
            >
              <option value="">—</option>
              {responsibles.map((r) => (
                <option key={r.membershipId} value={r.membershipId}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Key Results</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Pro Key Result: Zeile 1 Titel, Zeile 2 Metrik — Start/Ziel nur bei numerisch oder Prozent; Initiativen
              darunter aufklappbar. Neues Key Result unten anlegen.
            </p>
          </div>

          <ul className="m-0 list-none space-y-2 p-0">
            {objective.keyResults.map((kr) => (
              <li
                key={kr.id}
                className="rounded-md border border-zinc-200 bg-zinc-50/90 px-2 py-2 sm:px-3"
              >
                <KeyResultPlanningKrOneLineRow
                  kr={kr}
                  okrCycleEndDate={okrCycleEndDate}
                  initiatives={initiatives}
                  cycleInstanceId={cycleInstanceId}
                  canWrite={canWrite}
                  canEditThisKr={Boolean(keyResultEditById[kr.id])}
                  okrKrOwnerMustMatchObjective={okrKrOwnerMustMatchObjective}
                  responsibles={responsibles}
                  startTransition={startTransition}
                  onMutationSuccess={onMutationSuccess}
                />
              </li>
            ))}
          </ul>
        </div>

        {showPanelSave ? (
          <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 pt-5">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Alles speichern
            </button>
          </div>
        ) : (
          <p className="border-t border-zinc-200 pt-5 text-xs text-zinc-500">
            Kein Speichern möglich: für dieses Objective/KR fehlt die passende OKR-Objekt-Berechtigung.
          </p>
        )}
      </form>

      <CreateKeyResultForm
        objectiveId={objective.id}
        cycleInstanceId={cycleInstanceId}
        canCreateKeyResult={Boolean(canCreateKeyResultByObjectiveId[objective.id])}
        okrKrOwnerMustMatchObjective={okrKrOwnerMustMatchObjective}
        responsibles={responsibles}
        pending={pending}
        startTransition={startTransition}
        onSuccess={onMutationSuccess}
      />
      {objectiveDeleteOpen ? (
        <ConfirmDialog
          title="OKR-Objective wirklich löschen?"
          description="Das Objective und seine Key Results werden aus diesem Zeitraum entfernt, sofern die Datenbank das zulässt."
          confirmLabel="Löschen"
          pending={pending}
          onCancel={() => setObjectiveDeleteOpen(false)}
          onConfirm={() => {
            setObjectiveDeleteOpen(false);
            startTransition(async () => {
              const r = await deleteOkrObjectiveAction({
                cycleInstanceId,
                objectiveId: objective.id,
              });
              if ("error" in r && r.error) window.alert(r.error);
              else onMutationSuccess();
            });
          }}
        />
      ) : null}
    </div>
  );
}

function CreateKeyResultForm(props: {
  objectiveId: string;
  cycleInstanceId: string;
  canCreateKeyResult: boolean;
  okrKrOwnerMustMatchObjective: boolean;
  responsibles: OkrResponsibleOption[];
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onSuccess: () => void;
}) {
  const {
    objectiveId,
    cycleInstanceId,
    canCreateKeyResult,
    okrKrOwnerMustMatchObjective,
    responsibles,
    pending,
    startTransition,
    onSuccess,
  } = props;
  const formRef = useRef<HTMLFormElement | null>(null);
  const [metricType, setMetricType] = useState<KeyResultMetricTypeUi>("boolean");
  const showStartTarget = metricType === "numeric" || metricType === "percent";
  const showUnit = metricType === "numeric";

  if (!canCreateKeyResult) {
    return null;
  }

  return (
    <form
      ref={formRef}
      className="mt-4 space-y-2 rounded-md border border-dashed border-zinc-400 bg-zinc-50/80 p-3"
      action={(fd) => {
        startTransition(async () => {
          const mt = normalizeKeyResultMetricType(String(fd.get("metric_type") ?? "boolean"));
          const ownerRaw = String(fd.get("create_kr_owner_membership_id") ?? "").trim();
          const deputyRaw = String(fd.get("create_kr_deputy_membership_id") ?? "").trim();
          const r = await createKeyResultAction({
            cycleInstanceId,
            objectiveId,
            title: String(fd.get("title") ?? ""),
            metricType: mt,
            startValue:
              mt === "boolean" ? null : formDataEntryOptionalNumber(fd.get("create_kr_start_value")),
            targetValue:
              mt === "boolean" ? null : formDataEntryOptionalNumber(fd.get("create_kr_target_value")),
            measurementUnit:
              mt === "numeric"
                ? String(fd.get("create_kr_measurement_unit") ?? "").trim() || null
                : null,
            ownerMembershipId: okrKrOwnerMustMatchObjective ? undefined : ownerRaw || null,
            deputyMembershipId: deputyRaw || null,
          });
          if ("error" in r && r.error) window.alert(r.error);
          else {
            formRef.current?.reset();
            setMetricType("boolean");
            onSuccess();
          }
        });
      }}
    >
      <p className="text-sm font-semibold text-zinc-900">Key Result hinzufügen</p>
      <p className="text-xs text-zinc-500">
        Bei erfüllt/Nicht erfüllt keine Start-/Zielwerte (Skala 0/1). Bei numerisch und Prozent erscheinen die
        Felder wie im Key Result darüber. Nach «Anlegen» bei Bedarf «Alles speichern» nutzen.
      </p>
      {!okrKrOwnerMustMatchObjective ? (
        <label className="mt-2 block">
          <span className={OKR_FORM_LABEL}>Key-Result-Owner (optional)</span>
          <select
            name="create_kr_owner_membership_id"
            className={OKR_FORM_CONTROL}
            defaultValue=""
          >
            <option value="">— (wie Objective-Owner)</option>
            {responsibles.map((r) => (
              <option key={r.membershipId} value={r.membershipId}>
                {r.fullName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="mt-2 block">
        <span className={OKR_FORM_LABEL}>Key-Result-Deputy (optional)</span>
        <select name="create_kr_deputy_membership_id" className={OKR_FORM_CONTROL} defaultValue="">
          <option value="">— (wie Objective-Deputy)</option>
          {responsibles.map((r) => (
            <option key={r.membershipId} value={r.membershipId}>
              {r.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block">
        <span className={OKR_FORM_LABEL}>Titel</span>
        <input
          name="title"
          required
          placeholder="z. B. Umsatz Q2"
          className={OKR_FORM_CONTROL}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label>
          <span className={OKR_FORM_LABEL}>Metrik</span>
          <select
            name="metric_type"
            value={metricType}
            onChange={(e) =>
              setMetricType(normalizeKeyResultMetricType(e.target.value))
            }
            className={OKR_FORM_CONTROL}
          >
            <option value="boolean">erfüllt/Nicht erfüllt</option>
            <option value="numeric">Numerisch</option>
            <option value="percent">Prozent</option>
          </select>
        </label>
        {showStartTarget ? (
          <Fragment key={`create-kr-${metricType}-st`}>
            <label>
              <span className={OKR_FORM_LABEL}>Start</span>
              <input
                name="create_kr_start_value"
                type="text"
                inputMode="decimal"
                placeholder="0"
                className={OKR_FORM_CONTROL}
              />
            </label>
            <label>
              <span className={OKR_FORM_LABEL}>Ziel</span>
              <input
                name="create_kr_target_value"
                type="text"
                inputMode="decimal"
                placeholder={metricType === "percent" ? "100" : "·"}
                className={OKR_FORM_CONTROL}
              />
            </label>
          </Fragment>
        ) : null}
        {showUnit ? (
          <label>
            <span className={OKR_FORM_LABEL}>Einheit</span>
            <input
              name="create_kr_measurement_unit"
              type="text"
              placeholder="z. B. €, Stück"
              className={OKR_FORM_CONTROL}
            />
          </label>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Anlegen
        </button>
      </div>
    </form>
  );
}
