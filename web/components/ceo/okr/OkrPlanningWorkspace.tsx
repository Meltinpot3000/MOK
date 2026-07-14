"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type {
  OkrContributionEdgePlanningRow,
  OkrPlanningInitiativeRow,
  OkrPlanningKeyResultRow,
  OkrPlanningObjectiveRow,
  OkrPlanningWorkspaceData,
  OkrResponsibleOption,
} from "@/lib/okr/planning-data";
import {
  OKR_CONTRIBUTION_TIER_META,
  OKR_CONTRIBUTION_TIER_ORDER,
  type OkrContributionTier,
} from "@/lib/strategy-cycle/coverage-level";
import {
  ExpandableTable,
  type ColumnDef,
  pillLinked,
  pillNeutral,
} from "@/components/ceo/ExpandableTable";
import {
  TableFilterBar,
  TableFilterSearch,
  TableFilterSelect,
} from "@/components/table/TableFilterBar";
import { normalizeTableSearchQuery } from "@/lib/table/filter-utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  acceptKrInitiativeSuggestionAction,
  createKeyResultAction,
  createOkrObjectiveAction,
  deleteKeyResultAction,
  deleteOkrObjectiveAction,
  overrideKrInitiativeLevelAction,
  rejectKrInitiativeSuggestionAction,
  saveOkrPlanningPanelAction,
  shiftOkrObjectiveToNextCycleAction,
} from "@/app/(ceo)/okr-workspace/actions";
import { useOkrPlanningDirty } from "@/components/ceo/okr/okr-planning-dirty";
import { resolveNextOkrCycleId } from "@/lib/okr/okr-cycle-nav";
import type { OkrApprovalSubmitEligibility } from "@/lib/okr/okr-approval-submit-eligibility";
import {
  okrObjectiveEditableInPlanning,
  okrObjectiveLifecycleLabelDe,
  okrPlanningEditBlockedMessageDe,
} from "@/lib/okr/okr-objective-lifecycle";
import { submitForApprovalAction } from "@/lib/tasks/approval-actions";
import { useOkrContributionAssessmentRefresh } from "@/components/ceo/okr/use-okr-contribution-assessment-refresh";
import {
  addressedLinkCountToneClass,
  MATRIX_TABLE_LINK_PILLS_MAX,
} from "@/lib/strategy-cycle/matrix-link-count-tone";
import {
  formulationTierLabelDe,
  scopeFitTierLabelDe,
  scopeFitTierTitleDe,
} from "@/lib/okr/okr-contribution-direction-labels";
import { formatKrPlanningReadOnlyLine } from "@/lib/okr/format-kr-planning-line";

const OKR_FORM_LABEL = "block text-xs text-zinc-600";
const OKR_FORM_CONTROL = "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm";

/** Optional: Objective-ID → nach Mutation ggf. auf Contribution-Job warten und erneut laden. */
export type OkrPlanningDataRefresh = (
  okrObjectiveId?: string,
  options?: { pollContributionAssessment?: boolean }
) => void | Promise<void>;

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
  planningFormId,
  canWrite,
  canEditThisKr,
  okrKrOwnerMustMatchObjective,
  responsibles,
  startTransition,
  onMutationSuccess,
  onFormDirty,
}: {
  kr: OkrPlanningKeyResultRow;
  okrCycleEndDate: string | null;
  initiatives: OkrPlanningInitiativeRow[];
  cycleInstanceId: string;
  planningFormId: string;
  canWrite: boolean;
  canEditThisKr: boolean;
  okrKrOwnerMustMatchObjective: boolean;
  responsibles: OkrResponsibleOption[];
  startTransition: (cb: () => void) => void;
  onMutationSuccess: OkrPlanningDataRefresh;
  onFormDirty: (formId: string) => void;
}) {
  const [metricType, setMetricType] = useState<KeyResultMetricTypeUi>(() =>
    normalizeKeyResultMetricType(kr.metricType),
  );
  const [linkedInitiativeIds, setLinkedInitiativeIds] = useState<string[]>(() => [
    ...kr.linkedInitiativeIds,
  ]);
  useEffect(() => {
    setMetricType(normalizeKeyResultMetricType(kr.metricType));
    setLinkedInitiativeIds([...kr.linkedInitiativeIds]);
  }, [kr.id, kr.metricType, kr.linkedInitiativeIds]);
  const showStartTarget = metricType === "numeric" || metricType === "percent";
  const showUnit = metricType === "numeric";
  const ctl = OKR_KR_COMPACT_CONTROL;
  const linkedN = linkedInitiativeIds.length;
  const krFieldsDisabled = !canWrite || !canEditThisKr;
  const [krDeleteOpen, setKrDeleteOpen] = useState(false);
  const pillsCanEdit = canWrite && canEditThisKr;

  const toggleInitiativeLink = (initiativeId: string) => {
    setLinkedInitiativeIds((prev) => {
      const next = prev.includes(initiativeId)
        ? prev.filter((id) => id !== initiativeId)
        : [...prev, initiativeId];
      return next;
    });
    onFormDirty(planningFormId);
  };

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
              else await onMutationSuccess(kr.objectiveId);
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
          <input
            type="hidden"
            name={`kr_${kr.id}_initiative_ids_json`}
            value={JSON.stringify([...linkedInitiativeIds].sort())}
          />
          {initiatives.length === 0 ? (
            <span className="text-xs text-zinc-500">Keine Initiativen im Zyklus.</span>
          ) : (
            <>
              <p className="mb-1.5 text-[10px] text-zinc-500">
                Auswahl wird mit «Alles speichern» übernommen (kein sofortiges Speichern).
              </p>
              <div className="flex flex-wrap gap-1.5">
                {initiatives.map((i) => (
                  <KrInitiativePillButton
                    key={i.id}
                    isLinked={linkedInitiativeIds.includes(i.id)}
                    canWrite={pillsCanEdit}
                    title={i.title}
                    onToggle={() => toggleInitiativeLink(i.id)}
                  >
                    {i.title}
                  </KrInitiativePillButton>
                ))}
              </div>
            </>
          )}
          <KrInitiativeSuggestionsPanel
            kr={kr}
            cycleInstanceId={cycleInstanceId}
            canWrite={pillsCanEdit}
            onMutationSuccess={onMutationSuccess}
          />
        </div>
      </KrPlanningInitiativesDetails>
    </>
  );
}

function levelBadgeClass(level: "low" | "medium" | "high"): string {
  if (level === "high") return "border-red-200 bg-red-50 text-red-700";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function KrInitiativeSuggestionsPanel({
  kr,
  cycleInstanceId,
  canWrite,
  onMutationSuccess,
}: {
  kr: OkrPlanningKeyResultRow;
  cycleInstanceId: string;
  canWrite: boolean;
  onMutationSuccess: OkrPlanningDataRefresh;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const all = kr.initiativeSuggestions;
  const confirmed = all.filter((r) => r.confirmationStatus === "accepted" || r.confirmationStatus === "manual");
  const suggestions = all.filter((r) => r.confirmationStatus !== "accepted" && r.confirmationStatus !== "manual");
  const run = kr.latestMatchingRun;

  const runAction = async (initiativeId: string, fn: () => Promise<{ error?: string }>) => {
    if (!canWrite) return;
    setPendingId(initiativeId);
    try {
      const res = await fn();
      if (res?.error) {
        window.alert(res.error);
        return;
      }
      await onMutationSuccess(kr.objectiveId);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
      {run?.status === "insufficient_context" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          {run.insufficientContextReason ??
            "Dieses Key Result ist aktuell zu unspezifisch beschrieben, um sinnvolle Initiative-Matches zu ermitteln."}
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-semibold text-zinc-700">Bestätigte Initiativen</p>
        {confirmed.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">Noch keine bestätigten Zuordnungen.</p>
        ) : (
          <div className="mt-1 space-y-1.5">
            {confirmed.map((row) => (
              <div key={`confirmed-${row.initiativeId}`} className="rounded border border-zinc-200 bg-zinc-50 p-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-900">{row.initiativeTitle}</span>
                  {row.confirmedLevel ? (
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${levelBadgeClass(row.confirmedLevel)}`}>
                      {row.confirmedLevel}
                    </span>
                  ) : null}
                  <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-600">
                    gesetzt
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold text-zinc-700">Vorgeschlagene Initiativen</p>
        {suggestions.filter((s) => s.llmLevel).length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">Keine Vorschläge mit ausreichender Confidence.</p>
        ) : (
          <div className="mt-1 space-y-2">
            {suggestions
              .filter((row) => row.llmLevel)
              .map((row) => (
                <div key={`suggestion-${row.initiativeId}`} className="rounded border border-zinc-200 bg-white p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-900">{row.initiativeTitle}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${levelBadgeClass(row.llmLevel!)}`}>
                      {row.llmLevel}
                    </span>
                    {row.confirmationStatus === "pending" ? (
                      <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">
                        Suggestion
                      </span>
                    ) : null}
                    {row.confirmedLevel && row.llmLevel && row.confirmedLevel !== row.llmLevel ? (
                      <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
                        Updated suggestion ({row.confirmedLevel} -&gt; {row.llmLevel})
                      </span>
                    ) : null}
                  </div>
                  {row.llmReason ? <p className="mt-1 text-[11px] text-zinc-600">{row.llmReason}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={!canWrite || pendingId === row.initiativeId}
                      className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 disabled:opacity-50"
                      onClick={() =>
                        void runAction(row.initiativeId, () =>
                          acceptKrInitiativeSuggestionAction({
                            cycleInstanceId,
                            keyResultId: kr.id,
                            initiativeId: row.initiativeId,
                          })
                        )
                      }
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={!canWrite || pendingId === row.initiativeId}
                      className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] text-rose-700 disabled:opacity-50"
                      onClick={() =>
                        void runAction(row.initiativeId, () =>
                          rejectKrInitiativeSuggestionAction({
                            cycleInstanceId,
                            keyResultId: kr.id,
                            initiativeId: row.initiativeId,
                          })
                        )
                      }
                    >
                      Reject
                    </button>
                    {(["low", "medium", "high"] as const).map((level) => (
                      <button
                        key={`${row.initiativeId}-${level}`}
                        type="button"
                        disabled={!canWrite || pendingId === row.initiativeId}
                        className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-700 disabled:opacity-50"
                        onClick={() =>
                          void runAction(row.initiativeId, () =>
                            overrideKrInitiativeLevelAction({
                              cycleInstanceId,
                              keyResultId: kr.id,
                              initiativeId: row.initiativeId,
                              level,
                            })
                          )
                        }
                      >
                        Override {level}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
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
  isLinked,
  canWrite,
  children,
  title,
  onToggle,
}: {
  isLinked: boolean;
  canWrite: boolean;
  children: React.ReactNode;
  title?: string;
  onToggle: () => void;
}) {
  const className = isLinked ? pillLinked() : pillNeutral();

  return (
    <button
      type="button"
      onClick={() => {
        if (!canWrite) return;
        onToggle();
      }}
      disabled={!canWrite}
      className={`max-w-full break-words text-left ${className} flex items-center gap-1.5`}
      title={title}
      aria-pressed={isLinked}
    >
      {children}
      {isLinked ? <span className="ml-0.5 shrink-0 text-red-600">×</span> : null}
    </button>
  );
}

type OkrPlanningWorkspaceProps = {
  data: OkrPlanningWorkspaceData;
  organizationId: string;
  cycleInstanceId: string;
  canWrite: boolean;
  currentMembershipId: string;
  approvalSubmitByObjectiveId: Record<string, OkrApprovalSubmitEligibility>;
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

function okrPlanningFormId(objectiveId: string): string {
  return `okr-planning-form-${objectiveId}`;
}

async function savePanelAndSubmitForApproval(params: {
  objectiveId: string;
  organizationId: string;
  fallbackTitle: string;
  fallbackDescription: string | null;
  /** Panel nur speichern, wenn das Formular als geändert markiert ist. */
  shouldSavePanel: boolean;
}): Promise<
  { ok: true; savedPanel: boolean; ranContributionAssessment: boolean } | { ok: false; error: string }
> {
  const form = document.getElementById(okrPlanningFormId(params.objectiveId)) as HTMLFormElement | null;
  let title = params.fallbackTitle.trim();
  let description = params.fallbackDescription;
  let savedPanel = false;
  let ranContributionAssessment = false;

  if (params.shouldSavePanel && form) {
    const fd = new FormData(form);
    fd.set("run_contribution_assessment", "1");
    ranContributionAssessment = true;
    const saveRes = await saveOkrPlanningPanelAction(fd);
    if (saveRes && "error" in saveRes && saveRes.error) {
      return { ok: false, error: String(saveRes.error) };
    }
    savedPanel = true;
    title = String(fd.get("title") ?? title).trim();
    description = String(fd.get("description") ?? description ?? "") || null;
  } else if (form) {
    title = String(new FormData(form).get("title") ?? title).trim();
    description = String(new FormData(form).get("description") ?? description ?? "") || null;
  }

  const submitRes = await submitForApprovalAction({
    organizationId: params.organizationId,
    sourceObjectType: "okr_objective",
    sourceObjectId: params.objectiveId,
    title: `Freigabe: ${title || "OKR-Objective"}`,
    description: description || null,
  });
  if (!submitRes.ok) return { ok: false, error: submitRes.error };
  return { ok: true, savedPanel, ranContributionAssessment };
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
  organizationId,
  cycleInstanceId,
  objectiveId,
  objectiveTitle,
  objectiveDescription,
  objectiveStatus,
  selectedOkrCycleId,
  canEditRow,
  canWrite,
  hasNextCycle,
  approvalSubmit,
  pending,
  startTransition,
  router,
  onAfterShift,
  onAfterApprovalSubmit,
}: {
  organizationId: string;
  cycleInstanceId: string;
  objectiveId: string;
  objectiveTitle: string;
  objectiveDescription: string | null;
  objectiveStatus: string;
  selectedOkrCycleId: string | null;
  canEditRow: boolean;
  canWrite: boolean;
  hasNextCycle: boolean;
  approvalSubmit: OkrApprovalSubmitEligibility | undefined;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  router: ReturnType<typeof useRouter>;
  onAfterShift: OkrPlanningDataRefresh;
  onAfterApprovalSubmit: OkrPlanningDataRefresh;
}) {
  const [shiftConfirmOpen, setShiftConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isFormDirty, clearDirty } = useOkrPlanningDirty();
  const planningFormId = okrPlanningFormId(objectiveId);

  const closeMenu = () => setMenuOpen(false);

  const openMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right });
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const updatePosition = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right });
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeMenu();
    };
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const canShift =
    canWrite &&
    canEditRow &&
    Boolean(selectedOkrCycleId) &&
    objectiveStatus !== "shifted" &&
    hasNextCycle;
  const canShowApproval =
    canWrite && canEditRow && Boolean(approvalSubmit) && objectiveStatus !== "shifted";

  if (!canShift && !canShowApproval) {
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
        await onAfterShift();
      }
    });
  };

  const actionMenu =
    menuOpen && menuPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[200] min-w-[14rem] -translate-x-full rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {canShowApproval ? (
              <button
                type="button"
                role="menuitem"
                disabled={pending || !approvalSubmit!.canSubmit}
                title={
                  !approvalSubmit!.canSubmit ? approvalSubmit!.disabledReason ?? undefined : undefined
                }
                className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  closeMenu();
                  startTransition(async () => {
                    const panelDirty = isFormDirty(planningFormId);
                    const r = await savePanelAndSubmitForApproval({
                      organizationId,
                      objectiveId,
                      fallbackTitle: objectiveTitle,
                      fallbackDescription: objectiveDescription,
                      shouldSavePanel: panelDirty,
                    });
                    if (!r.ok) window.alert(r.error);
                    else {
                      if (r.savedPanel) clearDirty();
                      await onAfterApprovalSubmit(objectiveId, {
                        pollContributionAssessment: r.ranContributionAssessment,
                      });
                    }
                  });
                }}
              >
                Zur Freigabe senden
              </button>
            ) : null}
            {canShift ? (
              <button
                type="button"
                role="menuitem"
                disabled={pending}
                className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                onClick={() => {
                  closeMenu();
                  setShiftConfirmOpen(true);
                }}
              >
                OKR-Objective in den nächsten Zyklus verschieben
              </button>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100"
        onClick={(e) => {
          e.stopPropagation();
          if (menuOpen) closeMenu();
          else openMenu();
        }}
      >
        <span className="sr-only">Aktionen zu Objective</span>
        <span className="select-none text-lg leading-none" aria-hidden>
          ⋮
        </span>
      </button>
      {actionMenu}
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

function okrContributionTierIndex(level: OkrContributionTier | null | undefined): number {
  if (!level) return -1;
  return OKR_CONTRIBUTION_TIER_ORDER.indexOf(level);
}

function formatOkrContributionTierRange(levels: OkrContributionTier[]): string {
  if (levels.length === 0) return "";
  const idxs = levels.map((l) => OKR_CONTRIBUTION_TIER_ORDER.indexOf(l)).filter((i) => i >= 0);
  if (idxs.length === 0) return "";
  const min = Math.min(...idxs);
  const max = Math.max(...idxs);
  const low = OKR_CONTRIBUTION_TIER_ORDER[min]!;
  const high = OKR_CONTRIBUTION_TIER_ORDER[max]!;
  if (min === max) {
    return `${OKR_CONTRIBUTION_TIER_META[low].emoji} ${OKR_CONTRIBUTION_TIER_META[low].labelDe}`;
  }
  return `${OKR_CONTRIBUTION_TIER_META[low].emoji}–${OKR_CONTRIBUTION_TIER_META[high].emoji}`;
}

function findStrategicDirectionContributionEdge(
  o: OkrPlanningObjectiveRow
): OkrContributionEdgePlanningRow | undefined {
  const dirId = o.leadingStrategicDirectionId;
  if (dirId) {
    return o.contributionEdges.find(
      (e) => e.targetType === "strategic_direction" && e.targetId === dirId
    );
  }
  return o.contributionEdges.find((e) => e.targetType === "strategic_direction");
}

function effectiveDirectionContributionTier(
  edge: OkrContributionEdgePlanningRow
): OkrContributionTier | null {
  if (edge.confirmedLevel) return edge.confirmedLevel;
  if (edge.llmSuggestionDismissed) return null;
  return edge.llmLevel ?? null;
}

function formatDirectionContributionTooltip(edge: OkrContributionEdgePlanningRow): string {
  const parts: string[] = [];
  if (edge.llmAlignmentLevel) {
    parts.push(`Alignment: ${OKR_CONTRIBUTION_TIER_META[edge.llmAlignmentLevel].labelDe}`);
  }
  const formulation = edge.llmFormulationLevel ?? edge.llmAmbitionLevel;
  if (formulation) {
    parts.push(`Formulierung: ${OKR_CONTRIBUTION_TIER_META[formulation].labelDe}`);
  }
  if (edge.llmScopeFitLevel) {
    parts.push(`Quartals-Fit: ${scopeFitTierLabelDe(edge.llmScopeFitLevel)}`);
  }
  if (edge.llmReason) parts.push(edge.llmReason);
  if (edge.llmImprovementHint) parts.push(`Verbesserung: ${edge.llmImprovementHint}`);
  return parts.join("\n");
}

/** Sortierschlüssel: Overall-Stufe der Stoßrichtung (0=insufficient … 3=high), sonst 4. */
function okrContributionColumnSortValue(o: OkrPlanningObjectiveRow): number {
  const edge = findStrategicDirectionContributionEdge(o);
  const tier = edge ? effectiveDirectionContributionTier(edge) : null;
  const idx = okrContributionTierIndex(tier);
  return idx >= 0 ? idx : 4;
}

function OkrContributionTableCell({
  o,
  isAssessing,
}: {
  o: OkrPlanningObjectiveRow;
  isAssessing?: boolean;
}) {
  if (isAssessing) {
    return (
      <span className="text-sm text-violet-800" title="LLM-Bewertung läuft im Hintergrund">
        wird berechnet…
      </span>
    );
  }

  if (!o.leadingStrategicDirectionId) {
    return <span className="text-sm text-zinc-400">—</span>;
  }

  const edge = findStrategicDirectionContributionEdge(o);
  if (!edge) {
    return (
      <span className="text-sm text-zinc-400" title="Bewertung ausstehend (nach Speichern)">
        offen
      </span>
    );
  }

  const tier = effectiveDirectionContributionTier(edge);
  if (!tier) {
    return (
      <span className="text-sm text-zinc-400" title="Bewertung ausstehend">
        offen
      </span>
    );
  }

  const label = `${OKR_CONTRIBUTION_TIER_META[tier].emoji} ${OKR_CONTRIBUTION_TIER_META[tier].labelDe}`;
  const isSuggestion = !edge.confirmedLevel && Boolean(edge.llmLevel) && !edge.llmSuggestionDismissed;
  const tooltip = formatDirectionContributionTooltip(edge);

  return (
    <div className="space-y-0.5">
      <span
        className={`text-sm ${isSuggestion ? "text-violet-900" : "text-zinc-800"}`}
        title={tooltip || "Einstufung zur Stoßrichtung"}
      >
        {label}
      </span>
      {isSuggestion ? <span className="block text-[10px] text-zinc-500">Vorschlag</span> : null}
    </div>
  );
}

function okrContributionTierLabel(tier: OkrContributionTier | null | undefined): string {
  if (!tier) return "—";
  const meta = OKR_CONTRIBUTION_TIER_META[tier];
  return `${meta.emoji} ${meta.labelDe}`;
}

function effectiveLlmContributionTier(edge: OkrContributionEdgePlanningRow): OkrContributionTier | null {
  if (edge.confirmedLevel) return edge.confirmedLevel;
  if (edge.llmSuggestionDismissed) return null;
  return edge.llmLevel ?? null;
}

function OkrContributionAssessmentDetail({ o }: { o: OkrPlanningObjectiveRow }) {
  const dirEdge = findStrategicDirectionContributionEdge(o);
  const soEdges = o.contributionEdges.filter((e) => e.targetType === "strategy_objective");
  const initEdges = o.contributionEdges.filter((e) => e.targetType === "initiative");
  const showDirection = Boolean(dirEdge) && Boolean(o.leadingStrategicDirectionTitle);

  if (!showDirection && soEdges.length === 0 && initEdges.length === 0) return null;

  const dirUsesLlm = Boolean(dirEdge && !dirEdge.llmSuggestionDismissed);
  const dirOverall = dirEdge ? effectiveDirectionContributionTier(dirEdge) : null;
  const dirAlignment = dirEdge && dirUsesLlm ? dirEdge.llmAlignmentLevel : null;
  const dirFormulation =
    dirEdge && dirUsesLlm ? dirEdge.llmFormulationLevel ?? dirEdge.llmAmbitionLevel : null;
  const dirScopeFit = dirEdge && dirUsesLlm ? dirEdge.llmScopeFitLevel : null;
  const dirReason = dirEdge && dirUsesLlm ? dirEdge.llmReason : null;
  const dirHint = dirEdge && dirUsesLlm ? dirEdge.llmImprovementHint : null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Detailbewertung</p>

      {showDirection && dirEdge ? (
        <div className="mt-2 rounded-md border border-violet-100 bg-violet-50/40 p-2.5">
          <p className="text-[11px] font-semibold text-zinc-800">
            Stoßrichtung · {o.leadingStrategicDirectionTitle}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            Entspricht der Spalte «Einstufung» — Gesamt kombiniert Alignment, Formulierung und
            Quartals-Fit (überladener Scope dämpft das Gesamt).
          </p>
          <dl className="mt-2 grid gap-1.5 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-medium text-zinc-600">Alignment</dt>
              <dd className="text-zinc-900">{okrContributionTierLabel(dirAlignment)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">Formulierung</dt>
              <dd className="text-zinc-900">{formulationTierLabelDe(dirFormulation)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">Quartals-Fit</dt>
              <dd
                className={`text-zinc-900 ${dirScopeFit === "high" ? "font-medium text-amber-900" : ""}`}
                title={scopeFitTierTitleDe(dirScopeFit)}
              >
                {scopeFitTierLabelDe(dirScopeFit)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">Gesamt</dt>
              <dd className="font-semibold text-zinc-900">{okrContributionTierLabel(dirOverall)}</dd>
            </div>
          </dl>
          {dirReason ? <p className="mt-2 text-[11px] leading-snug text-zinc-600">{dirReason}</p> : null}
          {dirHint ? (
            <p className="mt-1.5 text-[11px] leading-snug text-amber-900">
              <span className="font-medium">Verbesserung:</span> {dirHint}
            </p>
          ) : null}
        </div>
      ) : null}

      {soEdges.length > 0 ? (
        <div className={showDirection ? "mt-3" : "mt-2"}>
          <p className="text-[11px] font-medium text-zinc-700">Strategieziele (Portfolio)</p>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            Zusatz: Relevanz weiterer Ziele unter derselben Stoßrichtung — nicht die Spalten-Einstufung.
          </p>
          <ul className="mt-1 space-y-1.5">
            {soEdges.map((e) => {
              const tier = effectiveLlmContributionTier(e);
              return (
                <li key={e.targetId} className="text-[11px] text-zinc-600">
                  <span className="font-medium text-zinc-800">{e.targetTitle}</span>
                  <span className="ml-1 text-zinc-500">· Fit {okrContributionTierLabel(tier)}</span>
                  {e.llmReason ? <p className="mt-0.5 text-zinc-500">{e.llmReason}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {initEdges.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-zinc-700">Initiativen (Execution Linkage)</p>
          <ul className="mt-1 space-y-1.5">
            {initEdges.map((e) => {
              const tier = effectiveLlmContributionTier(e);
              return (
                <li key={e.targetId} className="text-[11px] text-zinc-600">
                  <span className="font-medium text-zinc-800">{e.targetTitle}</span>
                  <span className="ml-1 text-zinc-500">· {okrContributionTierLabel(tier)}</span>
                  {e.llmReason ? <p className="mt-0.5 text-zinc-500">{e.llmReason}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
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

function okrPlanningObjectiveHasContributionTargets(o: OkrPlanningObjectiveRow): boolean {
  return Boolean(o.leadingStrategicDirectionId);
}

/** Bestätigte Stoßrichtungs-Stufe für manuelles Dropdown. */
function objectiveContributionLevelFormDefault(o: OkrPlanningObjectiveRow): string {
  if (!okrPlanningObjectiveHasContributionTargets(o)) return "";
  const edge = findStrategicDirectionContributionEdge(o);
  const c = edge?.confirmedLevel ?? null;
  if (!c) return "";
  const levels: OkrContributionTier[] = [c];
  if (levels.length === 0) return "";
  const first = levels[0];
  for (let j = 1; j < levels.length; j++) {
    if (levels[j] !== first) return "";
  }
  return first;
}

function buildOkrObjectiveTableColumns(cycleInitiativeCount: number): ColumnDef<OkrPlanningObjectiveRow>[] {
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
      id: "contribution",
      label: "Einstufung",
      headerClassName: "min-w-[7.5rem]",
      sortValue: (o) => okrContributionColumnSortValue(o),
      render: (o) => <OkrContributionTableCell o={o} />,
    },
    {
      id: "status",
      label: "Status",
      sortValue: (o) => o.status,
      render: (o) => <span className="text-zinc-700">{okrObjectiveLifecycleLabelDe(o.status)}</span>,
    },
  ];
}

export function OkrPlanningWorkspace({
  data,
  organizationId,
  cycleInstanceId,
  canWrite,
  currentMembershipId,
  approvalSubmitByObjectiveId,
  objectiveOwnerChoices,
  objectiveEditById,
  keyResultEditById,
  canCreateKeyResultByObjectiveId,
  inCycleOkrObjectiveCountBeforeReadFilter,
}: OkrPlanningWorkspaceProps) {
  const router = useRouter();
  const { markDirty, clearDirty, isFormDirty } = useOkrPlanningDirty();
  const [pending, startTransition] = useTransition();

  const onPlanningFormDirty = useCallback(
    (formId: string) => {
      markDirty(formId);
    },
    [markDirty]
  );

  const onPlanningFormSaved = useCallback(() => {
    clearDirty();
  }, [clearDirty]);

  const refresh = useCallback(async () => {
    await router.refresh();
  }, [router]);

  const { refreshAfterMutation, assessingObjectiveIds } = useOkrContributionAssessmentRefresh({
    contributionAssessmentEnabled: data.okrContributionAssessmentEnabled,
    cycleInstanceId,
    refresh,
  });

  const onAfterApprovalSubmit = useCallback(
    async (
      objectiveId?: string,
      options?: { pollContributionAssessment?: boolean }
    ) => {
      clearDirty();
      await refreshAfterMutation(objectiveId, options);
    },
    [clearDirty, refreshAfterMutation]
  );

  const [searchTitle, setSearchTitle] = useState("");
  const [filterDirectionId, setFilterDirectionId] = useState("");
  const [filterOwnerMembershipId, setFilterOwnerMembershipId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const quickLower = normalizeTableSearchQuery(searchTitle);

  const selectedOkrCycleEndDate = useMemo(() => {
    const id = data.selectedOkrCycleId;
    if (!id) return null;
    return data.okrCycles.find((c) => c.id === id)?.end_date ?? null;
  }, [data.okrCycles, data.selectedOkrCycleId]);

  const directionFilterOptions = useMemo(() => {
    const ids = [
      ...new Set(
        data.okrObjectives
          .map((o) => o.leadingStrategicDirectionId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    return ids
      .map((id) => ({
        value: id,
        label:
          data.okrObjectives.find((o) => o.leadingStrategicDirectionId === id)
            ?.leadingStrategicDirectionTitle ?? id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [data.okrObjectives]);

  const ownerFilterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const obj of data.okrObjectives) {
      if (obj.ownerMembershipId && obj.ownerDisplayName) {
        byId.set(obj.ownerMembershipId, obj.ownerDisplayName);
      }
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "de"))
      .map(([value, label]) => ({ value, label }));
  }, [data.okrObjectives]);

  const statusFilterOptions = useMemo(() => {
    const statuses = [...new Set(data.okrObjectives.map((o) => o.status))];
    return statuses
      .sort((a, b) => okrObjectiveLifecycleLabelDe(a).localeCompare(okrObjectiveLifecycleLabelDe(b), "de"))
      .map((s) => ({ value: s, label: okrObjectiveLifecycleLabelDe(s) }));
  }, [data.okrObjectives]);

  const filteredOkrObjectives = useMemo(() => {
    return data.okrObjectives.filter((obj) => {
      if (filterDirectionId && obj.leadingStrategicDirectionId !== filterDirectionId) {
        return false;
      }
      if (filterOwnerMembershipId && obj.ownerMembershipId !== filterOwnerMembershipId) {
        return false;
      }
      if (filterStatus && obj.status !== filterStatus) return false;
      if (!quickLower) return true;
      if (obj.title.toLowerCase().includes(quickLower)) return true;
      if (obj.keyResults.some((kr) => kr.title.toLowerCase().includes(quickLower))) return true;
      return obj.keyResults.some((kr) =>
        kr.linkedInitiativeTitles.some((t) => t.toLowerCase().includes(quickLower))
      );
    });
  }, [data.okrObjectives, quickLower, filterDirectionId, filterOwnerMembershipId, filterStatus]);

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
    const base = buildOkrObjectiveTableColumns(data.initiatives.length).map((col) =>
      col.id === "contribution"
        ? {
            ...col,
            render: (o: OkrPlanningObjectiveRow) => (
              <OkrContributionTableCell o={o} isAssessing={assessingObjectiveIds.has(o.id)} />
            ),
          }
        : col
    );
    return [
      ...base,
      {
        id: "actions",
        label: "Aktionen",
        headerClassName: "w-[4.5rem] whitespace-nowrap",
        cellClassName: "w-[4.5rem]",
        render: (o: OkrPlanningObjectiveRow) => (
          <OkrObjectiveRowActions
            organizationId={organizationId}
            cycleInstanceId={cycleInstanceId}
            objectiveId={o.id}
            objectiveTitle={o.title}
            objectiveDescription={o.description}
            objectiveStatus={o.status}
            selectedOkrCycleId={data.selectedOkrCycleId}
            canEditRow={Boolean(objectiveEditById[o.id])}
            canWrite={canWrite}
            hasNextCycle={Boolean(nextOkrCycleId)}
            approvalSubmit={approvalSubmitByObjectiveId[o.id]}
            pending={pending}
            startTransition={startTransition}
            router={router}
            onAfterShift={refresh}
            onAfterApprovalSubmit={onAfterApprovalSubmit}
          />
        ),
      },
    ];
  }, [
    assessingObjectiveIds,
    data.initiatives.length,
    organizationId,
    approvalSubmitByObjectiveId,
    cycleInstanceId,
    data.selectedOkrCycleId,
    canWrite,
    objectiveEditById,
    nextOkrCycleId,
    pending,
    refreshAfterMutation,
    router,
    startTransition,
  ]);

  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
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
                onSuccess={refreshAfterMutation}
              />
            ) : null}

            {data.selectedOkrCycleId && !canWrite ? (
              <p className="mt-4 text-xs text-zinc-500">Lesemodus: neue Objectives können hier nicht angelegt werden.</p>
            ) : null}
          </>
        )}
      </article>

      <article className="brand-card min-w-0 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">OKR-Übersicht</h2>

        <div className="mt-4 min-w-0">
          <TableFilterBar>
            <TableFilterSelect
              label="Stoßrichtung"
              value={filterDirectionId}
              onChange={setFilterDirectionId}
              className="min-w-[140px] flex-1"
              options={directionFilterOptions}
            />
            <TableFilterSelect
              label="Owner"
              value={filterOwnerMembershipId}
              onChange={setFilterOwnerMembershipId}
              className="min-w-[140px] flex-1"
              options={ownerFilterOptions}
            />
            <TableFilterSelect
              label="Status"
              value={filterStatus}
              onChange={setFilterStatus}
              options={statusFilterOptions}
            />
            <TableFilterSearch
              value={searchTitle}
              onChange={setSearchTitle}
              label="Suche"
              placeholder="Objective-, KR- oder Initiativ-Titel…"
            />
          </TableFilterBar>
        </div>

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
                  selectedOkrCycleId={data.selectedOkrCycleId}
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
                  onMutationSuccess={refreshAfterMutation}
                  onFormDirty={onPlanningFormDirty}
                  onFormSaved={onPlanningFormSaved}
                  isFormDirty={isFormDirty}
                  okrContributionAssessmentEnabled={data.okrContributionAssessmentEnabled}
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
  onSuccess: OkrPlanningDataRefresh;
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
          const description = String(fd.get("description") ?? "").trim();
          const ownerRaw = String(fd.get("owner_membership_id") ?? "").trim();
          const r = await createOkrObjectiveAction({
            cycleInstanceId,
            okrCycleId,
            title,
            description,
            ownerMembershipId: ownerRaw || null,
          });
          if ("error" in r && r.error) window.alert(r.error);
          else if ("id" in r && r.id) {
            setNewObjectiveTitle("");
            setNewObjectiveDescription("");
            await onSuccess(r.id);
          }
        });
      }}
    >
      <p className="text-sm font-medium text-zinc-800">Neues OKR-Objective</p>
      <p className="mt-1 text-xs text-zinc-500">
        Initiativen werden pro Key Result verknüpft: Objective-Zeile rechts aufklappen, Key Result anlegen oder
        aufklappen, Initiativen-Pills wählen. Die Stoßrichtung wird automatisch über Change-Jahresziel oder
        Initiative/Programm abgeleitet.
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
        Stoßrichtung (abgeleitet)
        <p className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-600">
          Wird nach Verknüpfung mit Change-Jahresziel oder Initiative/Programm automatisch ermittelt.
        </p>
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
  selectedOkrCycleId: string | null;
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
  onMutationSuccess: OkrPlanningDataRefresh;
  onFormDirty: (formId: string) => void;
  onFormSaved: () => void;
  isFormDirty: (formId: string) => boolean;
  okrContributionAssessmentEnabled: boolean;
}) {
  const {
    objective,
    selectedOkrCycleId,
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
    onFormDirty,
    onFormSaved,
    isFormDirty,
    okrContributionAssessmentEnabled,
  } = props;

  const [objectiveDeleteOpen, setObjectiveDeleteOpen] = useState(false);
  const planningFormId = okrPlanningFormId(objective.id);

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

  const planningEditable = okrObjectiveEditableInPlanning(objective.status);
  const planningLockMessage = okrPlanningEditBlockedMessageDe(objective.status);
  const canEditObjective = planningEditable && Boolean(objectiveEditById[objective.id]);
  const showPanelSave =
    planningEditable &&
    (canEditObjective ||
      objective.keyResults.some((kr) => Boolean(keyResultEditById[kr.id])));

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
      {canWrite && canEditObjective ? (
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

  if (!canWrite || !planningEditable) {
    return (
      <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/50 px-1 py-4 sm:px-2">
        {headerMeta}
        {planningLockMessage ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {planningLockMessage}
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
      <OkrContributionAssessmentDetail o={objective} />

      <form
        id={planningFormId}
        className="space-y-6 rounded-lg border border-zinc-200 bg-white p-4"
        onChange={() => onFormDirty(planningFormId)}
        action={(fd) => {
          startTransition(async () => {
            const panelDirty = isFormDirty(planningFormId);
            if (panelDirty) {
              fd.set("run_contribution_assessment", "1");
            }
            const r = await saveOkrPlanningPanelAction(fd);
            if (r && "error" in r && r.error) window.alert(r.error);
            else {
              onFormSaved();
              await onMutationSuccess(objective.id, {
                pollContributionAssessment: panelDirty,
              });
            }
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
          <div className={OKR_FORM_LABEL}>
            Stoßrichtung (abgeleitet, read-only)
            <p className={`${OKR_FORM_CONTROL} bg-zinc-50 text-zinc-700`}>
              {objective.leadingStrategicDirectionTitle ?? (
                <span className="text-amber-700">Kein Change-Anker — bitte Change-JZ oder Initiative verknüpfen</span>
              )}
            </p>
          </div>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          {!okrContributionAssessmentEnabled ? (
            <label className={OKR_FORM_LABEL}>
              Einstufung (Alignment)
              <select
                name="objective_contribution_level"
                defaultValue={objectiveContributionLevelFormDefault(objective)}
                disabled={
                  !canEditObjective || !okrPlanningObjectiveHasContributionTargets(objective)
                }
                className={OKR_FORM_CONTROL}
              >
                <option value="">
                  — unverändert
                  {objectiveContributionLevelFormDefault(objective) === "" &&
                  okrPlanningObjectiveHasContributionTargets(objective)
                    ? " (z. B. gemischte Stufen)"
                    : ""}
                </option>
                <option value="clear">Keine Stufe (Bestätigung entfernen)</option>
                <option value="insufficient">
                  {OKR_CONTRIBUTION_TIER_META.insufficient.emoji}{" "}
                  {OKR_CONTRIBUTION_TIER_META.insufficient.labelDe}
                </option>
                <option value="low">{OKR_CONTRIBUTION_TIER_META.low.labelDe}</option>
                <option value="medium">{OKR_CONTRIBUTION_TIER_META.medium.labelDe}</option>
                <option value="high">{OKR_CONTRIBUTION_TIER_META.high.labelDe}</option>
              </select>
              {canEditObjective ? (
                <span className="mt-1 block text-[10px] text-zinc-500">
                  Gilt für alle verknüpften Initiativen und das Strategieziel; wirksam mit «Alles speichern».
                  {!okrPlanningObjectiveHasContributionTargets(objective)
                    ? " Sobald Treiber verknüpft sind, ist die Stufe wählbar."
                    : null}
                </span>
              ) : null}
            </label>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-900">Key Results</p>

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
                  planningFormId={planningFormId}
                  canWrite={canWrite}
                  canEditThisKr={Boolean(keyResultEditById[kr.id])}
                  okrKrOwnerMustMatchObjective={okrKrOwnerMustMatchObjective}
                  responsibles={responsibles}
                  startTransition={startTransition}
                  onMutationSuccess={onMutationSuccess}
                  onFormDirty={onFormDirty}
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
              else await onMutationSuccess();
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
  onSuccess: OkrPlanningDataRefresh;
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
            await onSuccess(objectiveId);
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
