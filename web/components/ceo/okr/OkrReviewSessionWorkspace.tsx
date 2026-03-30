"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OkrCycleKpis, OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";
import type { OkrReviewSessionCheckInTracking } from "@/lib/okr/review-session-tracking";
import type { OkrReviewSessionRow, OkrReviewSessionTaskRow } from "@/lib/okr/review-sessions";
import type { OkrResponsibleOption } from "@/lib/okr/planning-data";
import { OkrKpiBar } from "@/components/ceo/okr/OkrKpiBar";
import { OkrReviewObjectiveDeck } from "@/components/ceo/okr/OkrReviewObjectiveDeck";
import {
  createOkrReviewSessionAction,
  createOkrReviewSessionTaskAction,
  deleteOkrReviewSessionAction,
  deleteOkrReviewSessionTaskAction,
  updateOkrReviewSessionAction,
  updateOkrReviewSessionTaskAction,
  type OkrReviewSessionStatus,
  type OkrReviewSessionType,
} from "@/app/(ceo)/okr-workspace/actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const SESSION_TYPE_LABEL: Record<string, string> = {
  mid_cycle: "Mid-Cycle",
  end_of_cycle: "Ende des Zeitraums",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  scheduled: "Geplant",
  in_progress: "Laufend",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
};

const WORKFLOW_CONFIRM_COPY: Record<
  "plan" | "start" | "complete",
  { title: string; description: string; confirmLabel: string }
> = {
  plan: {
    title: "Session planen?",
    description:
      "Die Session wechselt in den Status «Geplant». Team und Facilitator können sich auf Termin und Vorbereitung ausrichten.",
    confirmLabel: "Planen",
  },
  start: {
    title: "Review starten?",
    description:
      "Die Session wird auf «Laufend» gesetzt. Meeting-Felder und To-Dos stehen für die Durchführung bereit.",
    confirmLabel: "Starten",
  },
  complete: {
    title: "Review abschließen?",
    description:
      "Die Session wird als abgeschlossen markiert. Der Ablauf ist damit beendet; spätere Änderungen können eingeschränkt sein.",
    confirmLabel: "Abschließen",
  },
};

/** Session darf gelöscht werden, solange die Review nicht gestartet oder abgeschlossen ist. */
function sessionIsDeletable(status: string): boolean {
  return status !== "in_progress" && status !== "completed";
}

function reviewStatusPillClass(status: string): string {
  switch (status) {
    case "draft":
      return "border-zinc-300 bg-zinc-100 text-zinc-800";
    case "scheduled":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "in_progress":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "cancelled":
      return "border-rose-200 bg-rose-50 text-rose-900";
    default:
      return "border-zinc-200 bg-white text-zinc-800";
  }
}

function ReviewSessionStatusPill({ status }: { status: OkrReviewSessionStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${reviewStatusPillClass(
        status
      )}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function formatSessionWhen(iso: string | null): string {
  if (!iso) return "—";
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

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function fromDatetimeLocalValue(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function geplantAmLabel(scheduledAt: string | null): string {
  if (!scheduledAt) return "Geplant (kein Termin)";
  try {
    const d = new Date(scheduledAt);
    return `Geplant am ${d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })}`;
  } catch {
    return "Geplant (kein Termin)";
  }
}

function gestartetLabel(startedAt: string | null): string {
  if (!startedAt) return "Meeting gestartet";
  try {
    return `Gestartet am ${formatSessionWhen(startedAt)}`;
  } catch {
    return "Meeting gestartet";
  }
}

function startenButtonLabel(
  serverStatus: OkrReviewSessionStatus,
  startedAt: string | null
): string {
  if (serverStatus === "cancelled") return "Starten";
  if (serverStatus === "scheduled") return "Starten";
  if (serverStatus === "in_progress" || serverStatus === "completed") {
    return gestartetLabel(startedAt);
  }
  return "Starten";
}

function SessionCheckInTrackingPanel({ tracking }: { tracking: OkrReviewSessionCheckInTracking }) {
  const y = tracking.expectedCount;
  const x = tracking.distinctCheckInUsers;
  const ratio = y > 0 ? Math.min(1, x / y) : 0;
  const circumference = 2 * Math.PI * 40;
  const dash = ratio * circumference;

  const series = tracking.series;
  const w = 280;
  const h = 72;
  const pad = 10;
  let pathD = "";
  if (series.length > 0) {
    const t0 = new Date(series[0].at).getTime();
    const t1 = Math.max(
      ...series.map((p) => new Date(p.at).getTime()),
      t0 + 60_000
    );
    const span = Math.max(1, t1 - t0);
    const maxC = Math.max(...series.map((p) => p.cumulativeUniqueCheckInUsers), 1);
    const pts = series.map((p, i) => {
      const tx = new Date(p.at).getTime();
      const px = pad + ((tx - t0) / span) * (w - 2 * pad);
      const py = pad + (1 - p.cumulativeUniqueCheckInUsers / maxC) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
    });
    pathD = pts.join(" ");
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-900">
        Check-in-Stand nach Planung
      </h4>
      <p className="mt-1 text-xs text-sky-800/90">
        Eindeutige Personen mit Check-in im OKR-Tracking seit dem Referenzzeitpunkt, bezogen auf
        erwartete Objective-/KR-Owner in diesem Zeitraum.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#bae6fd" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#0369a1"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold text-sky-950">{x}</span>
            <span className="text-[10px] font-medium text-sky-800">von {y}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-sky-950">
            {y > 0
              ? `${x} von ${y} erwarteten Ownern/Deputies haben eingecheckt`
              : "Keine Owner/Deputies im Zeitraum — Tempomat bezieht sich nur auf eingetragene Check-ins."}
          </p>
          <p className="mt-1 text-xs text-sky-900/80">
            Referenz ab:{" "}
            {tracking.baselineAt ? formatSessionWhen(tracking.baselineAt) : "—"}
          </p>
          <div className="mt-3">
            {series.length === 0 ? (
              <p className="text-xs text-sky-800/80">Noch keine neuen Check-ins seit dem Planen.</p>
            ) : (
              <svg
                width={w}
                height={h}
                className="max-w-full text-sky-700"
                aria-label="Verlauf der Check-ins"
              >
                <title>Verlauf: kumulierte eindeutige Personen mit Check-in</title>
                <path
                  d={pathD}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type OkrReviewSessionWorkspaceProps = {
  cycleInstanceId: string;
  okrCycleId: string;
  okrCycleLabel: string;
  searchQuery: string;
  sessions: OkrReviewSessionRow[];
  selectedSessionId: string | null;
  responsibles: OkrResponsibleOption[];
  currentMembershipId: string;
  canManageSessions: boolean;
  canAssignFacilitator: boolean;
  kpis: OkrCycleKpis;
  objectiveViews: OkrObjectiveView[];
  updatesByKrId: Record<string, OkrUpdateRow[]>;
  sessionCheckInTracking: OkrReviewSessionCheckInTracking | null;
  sessionTasks: OkrReviewSessionTaskRow[];
};

export function OkrReviewSessionWorkspace({
  cycleInstanceId,
  okrCycleId,
  okrCycleLabel,
  searchQuery,
  sessions,
  selectedSessionId,
  responsibles,
  currentMembershipId,
  canManageSessions,
  canAssignFacilitator,
  kpis,
  objectiveViews,
  updatesByKrId,
  sessionCheckInTracking,
  sessionTasks,
}: OkrReviewSessionWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const canEditSelected = Boolean(
    selected &&
      (canManageSessions || selected.facilitator_membership_id === currentMembershipId)
  );

  /** Nur Facilitator oder Session-Manage dürfen den Ablauf (Planen/Starten/Abschließen) auslösen — entspricht Server-RLS. */
  const canDriveWorkflow = canEditSelected;

  const canSaveSession = Boolean(selected && (canEditSelected || canAssignFacilitator));

  const [title, setTitle] = useState("");
  const [sessionType, setSessionType] = useState<OkrReviewSessionType>("mid_cycle");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [facilitatorId, setFacilitatorId] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [discussionNotes, setDiscussionNotes] = useState("");
  const [decisionsNext, setDecisionsNext] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [workflowActionConfirm, setWorkflowActionConfirm] = useState<
    null | "plan" | "start" | "complete"
  >(null);
  const [completeUnsavedPromptOpen, setCompleteUnsavedPromptOpen] = useState(false);
  const completeUnsavedTitleId = useId();
  const [taskIdPendingDelete, setTaskIdPendingDelete] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
  const [newTaskDueLocal, setNewTaskDueLocal] = useState("");
  /** „Review erfassen“-Panel ein-/ausblenden (Animation). */
  const [capturePanelOpen, setCapturePanelOpen] = useState(true);

  useEffect(() => {
    if (!selected) {
      setTitle("");
      setSessionType("mid_cycle");
      setScheduledLocal("");
      setFacilitatorId(currentMembershipId);
      setSummary("");
      setMeetingNotes("");
      setDiscussionNotes("");
      setDecisionsNext("");
      return;
    }
    setTitle(selected.title);
    setSessionType(selected.session_type as OkrReviewSessionType);
    setScheduledLocal(toDatetimeLocalValue(selected.scheduled_at));
    setFacilitatorId(selected.facilitator_membership_id ?? currentMembershipId);
    setSummary(selected.summary ?? "");
    setMeetingNotes(selected.meeting_notes ?? "");
    setDiscussionNotes(selected.discussion_notes ?? "");
    setDecisionsNext(selected.decisions_next_steps ?? "");
  }, [selected, currentMembershipId]);

  useEffect(() => {
    setDeleteConfirmOpen(false);
  }, [selectedSessionId]);

  useEffect(() => {
    setWorkflowActionConfirm(null);
  }, [selectedSessionId]);

  useEffect(() => {
    setCompleteUnsavedPromptOpen(false);
  }, [selectedSessionId]);

  useEffect(() => {
    setTaskIdPendingDelete(null);
  }, [selectedSessionId]);

  useEffect(() => {
    setNewTaskTitle("");
    setNewTaskAssigneeId("");
    setNewTaskDueLocal("");
  }, [selectedSessionId]);

  const responsibleLabelForMembership = useMemo(() => {
    const m = new Map(
      responsibles.map((r) => [r.membershipId.trim().toLowerCase(), r.fullName])
    );
    return (membershipId: string | null) => {
      if (!membershipId) return "—";
      const k = membershipId.trim().toLowerCase();
      return m.get(k) ?? `${membershipId.slice(0, 8)}…`;
    };
  }, [responsibles]);

  const serverStatus = (selected?.status ?? "draft") as OkrReviewSessionStatus;
  const meetingFieldsVisible =
    serverStatus === "in_progress" ||
    serverStatus === "completed" ||
    serverStatus === "cancelled";
  const sessionTasksVisible =
    serverStatus === "in_progress" || serverStatus === "completed";

  const workflowDisabledTitle = !canDriveWorkflow
    ? "Nur Facilitator oder Session-Verwalter (okr.review.session.manage) können Planen, Starten und Abschließen auslösen."
    : undefined;

  const workflowPlanActive =
    canDriveWorkflow &&
    !pending &&
    serverStatus !== "cancelled" &&
    serverStatus === "draft";
  const workflowStartActive =
    canDriveWorkflow &&
    !pending &&
    serverStatus !== "cancelled" &&
    serverStatus === "scheduled";
  const workflowCompleteActive =
    canDriveWorkflow &&
    !pending &&
    serverStatus !== "cancelled" &&
    serverStatus === "in_progress";

  const facilitatorLabel = useMemo(() => {
    const id = selected?.facilitator_membership_id;
    if (!id) return "—";
    return responsibles.find((r) => r.membershipId === id)?.fullName ?? id.slice(0, 8);
  }, [selected, responsibles]);

  const facilitatorChoicesForCreate = useMemo(() => {
    if (canAssignFacilitator) return responsibles;
    return responsibles.filter((r) => r.membershipId === currentMembershipId);
  }, [canAssignFacilitator, responsibles, currentMembershipId]);

  const isSessionFormDirty = useMemo(() => {
    if (!selected) return false;
    if (title.trim() !== (selected.title ?? "").trim()) return true;
    if (sessionType !== (selected.session_type as OkrReviewSessionType)) return true;
    if (scheduledLocal !== toDatetimeLocalValue(selected.scheduled_at)) return true;
    const serverFac = selected.facilitator_membership_id ?? currentMembershipId;
    if (facilitatorId !== serverFac) return true;
    if ((summary ?? "") !== (selected.summary ?? "")) return true;
    if ((meetingNotes ?? "") !== (selected.meeting_notes ?? "")) return true;
    if ((discussionNotes ?? "") !== (selected.discussion_notes ?? "")) return true;
    if ((decisionsNext ?? "") !== (selected.decisions_next_steps ?? "")) return true;
    return false;
  }, [
    selected,
    title,
    sessionType,
    scheduledLocal,
    facilitatorId,
    currentMembershipId,
    summary,
    meetingNotes,
    discussionNotes,
    decisionsNext,
  ]);

  const persistSessionFields = useCallback(async (): Promise<boolean> => {
    if (!selected) return false;
    if (canEditSelected) {
      const r = await updateOkrReviewSessionAction({
        sessionId: selected.id,
        title,
        sessionType,
        scheduledAtIso: fromDatetimeLocalValue(scheduledLocal),
        facilitatorMembershipId: canAssignFacilitator ? facilitatorId : undefined,
        summary,
        meetingNotes,
        discussionNotes,
        decisionsNextSteps: decisionsNext,
      });
      if ("error" in r && r.error) {
        window.alert(r.error);
        return false;
      }
      return true;
    }
    if (canAssignFacilitator) {
      const r = await updateOkrReviewSessionAction({
        sessionId: selected.id,
        facilitatorMembershipId: facilitatorId,
      });
      if ("error" in r && r.error) {
        window.alert(r.error);
        return false;
      }
      return true;
    }
    return false;
  }, [
    selected,
    canEditSelected,
    canAssignFacilitator,
    title,
    sessionType,
    scheduledLocal,
    facilitatorId,
    summary,
    meetingNotes,
    discussionNotes,
    decisionsNext,
  ]);

  function pushSession(id: string | null) {
    const q = new URLSearchParams(searchQuery);
    if (id) q.set("session", id);
    else q.delete("session");
    router.push(`/okr/review?${q.toString()}`);
  }

  return (
    <>
    <div className="space-y-3">
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => setCapturePanelOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          aria-expanded={capturePanelOpen}
          aria-controls="review-capture-panel"
          title={capturePanelOpen ? "Review-Panel ausblenden" : "Review erfassen einblenden"}
        >
          <span className="text-sm tabular-nums text-zinc-600" aria-hidden>
            {capturePanelOpen ? "◀" : "▶"}
          </span>
          {capturePanelOpen ? "Panel ausblenden" : "Review erfassen"}
        </button>
      </div>

      <div
        className={`flex flex-col xl:flex-row xl:items-start ${
          capturePanelOpen ? "gap-6" : "gap-0"
        }`}
      >
        <div
          className={`min-h-0 overflow-hidden transition-[max-height,opacity,width] duration-300 ease-in-out motion-reduce:transition-none ${
            capturePanelOpen
              ? "max-h-[min(10000px,calc(100vh+2000px))] opacity-100 xl:w-[380px] xl:shrink-0"
              : "pointer-events-none max-h-0 opacity-0 xl:w-0 xl:shrink-0"
          }`}
        >
          <article
            id="review-capture-panel"
            className="brand-card p-6 max-xl:max-w-none xl:w-[380px] xl:max-w-[380px] xl:shrink-0"
          >
        <h2 className="text-lg font-semibold text-zinc-900">Review erfassen</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Neue OKR-Review-Sessions hier anlegen. Pflichtfelder ausfüllen — der Status wird automatisch als
          Entwurf gespeichert. Bestehende Sessions unten wählen; Details rechts bearbeiten.
        </p>
        {canManageSessions ? (
          facilitatorChoicesForCreate.length === 0 ? (
            <p className="mt-4 text-xs text-amber-800">
              Review anlegen ist derzeit nicht möglich: kein Facilitator wählbar. Ohne Berechtigung{" "}
              <span className="font-mono">okr.review.facilitator.assign</span> können Sie nur sich selbst
              zuweisen — Ihre Mitgliedschaft fehlt in der Responsibles-Liste.
            </p>
          ) : (
            <CreateOkrReviewSessionForm
              cycleInstanceId={cycleInstanceId}
              okrCycleId={okrCycleId}
              facilitatorChoices={facilitatorChoicesForCreate}
              currentMembershipId={currentMembershipId}
              canAssignFacilitator={canAssignFacilitator}
              pending={pending}
              startTransition={startTransition}
              onCreated={(sessionId) => {
                pushSession(sessionId);
                router.refresh();
              }}
            />
          )
        ) : (
          <p className="mt-4 text-sm text-zinc-600">
            Lesemodus oder ohne Berechtigung: Review-Sessions können nicht angelegt werden (
            <span className="font-mono">okr.review.session.manage</span>).
          </p>
        )}

        <h3 className="mt-8 text-sm font-semibold text-zinc-900">Vorhandene Sessions</h3>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Noch keine Review-Sessions für diesen Zeitraum.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pushSession(s.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    s.id === selectedSessionId
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  }`}
                >
                  <span className="font-medium text-zinc-900">{s.title || "Ohne Titel"}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {SESSION_TYPE_LABEL[s.session_type] ?? s.session_type} ·{" "}
                    {STATUS_LABEL[s.status] ?? s.status}
                    {s.scheduled_at ? ` · ${formatSessionWhen(s.scheduled_at)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>
        </div>

      <div className="min-w-0 flex-1">
      <div className="brand-card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Review-Zustand</span>
          {selected ? (
            <>
              <ReviewSessionStatusPill status={serverStatus} />
              <span className="text-xs text-zinc-500">
                {SESSION_TYPE_LABEL[sessionType] ?? sessionType}
                {scheduledLocal
                  ? ` · Termin ${formatSessionWhen(fromDatetimeLocalValue(scheduledLocal))}`
                  : selected.scheduled_at
                    ? ` · Termin ${formatSessionWhen(selected.scheduled_at)}`
                    : ""}
              </span>
              <span className="min-w-0 max-w-full truncate text-sm font-medium text-zinc-900 sm:ml-auto sm:max-w-[min(100%,20rem)] sm:text-left">
                {title.trim() || selected.title || "Ohne Titel"}
              </span>
            </>
          ) : (
            <p className="text-sm text-zinc-600">
              Keine Session gewählt — links eine Session auswählen oder eine neue Review anlegen.
            </p>
          )}
        </div>

        <div className="space-y-4 p-4">
        <div className="brand-card space-y-3 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Tracking (nur Lesen)</h3>
          <p className="text-xs text-zinc-500">
            Zeitraum: {okrCycleLabel} · Fortschritt aus Check-ins — Tab{" "}
            <Link href={`/okr/tracking?okrCycle=${encodeURIComponent(okrCycleId)}`} className="underline">
              Tracking
            </Link>{" "}
            für Updates.
          </p>
          <OkrKpiBar kpis={kpis} okrCycleId={okrCycleId} />
          <p className="text-xs text-zinc-600">{objectiveViews.length} Objectives</p>
        </div>

        {!selected ? (
          <p className="brand-card p-4 text-sm text-zinc-600">Session wählen oder neu anlegen.</p>
        ) : (
          <div className="brand-card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Session</h3>
                {serverStatus !== "in_progress" ? (
                  <p className="text-xs text-zinc-500">Facilitator: {facilitatorLabel}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <>
                  <button
                    type="button"
                    title={workflowDisabledTitle}
                    className={`px-3 py-1.5 text-xs font-medium ${workflowPlanActive ? "brand-btn" : "brand-btn-secondary"}`}
                    disabled={
                      !canDriveWorkflow ||
                      pending ||
                      serverStatus === "cancelled" ||
                      serverStatus !== "draft"
                    }
                    onClick={() => setWorkflowActionConfirm("plan")}
                  >
                    {serverStatus === "cancelled"
                      ? "Planen"
                      : serverStatus === "draft"
                        ? "Planen"
                        : geplantAmLabel(selected.scheduled_at)}
                  </button>
                  <button
                    type="button"
                    title={workflowDisabledTitle}
                    className={`px-3 py-1.5 text-xs font-medium ${workflowStartActive ? "brand-btn" : "brand-btn-secondary"}`}
                    disabled={
                      !canDriveWorkflow ||
                      pending ||
                      serverStatus === "cancelled" ||
                      serverStatus !== "scheduled"
                    }
                    onClick={() => setWorkflowActionConfirm("start")}
                  >
                    {startenButtonLabel(serverStatus, selected.started_at ?? null)}
                  </button>
                  <button
                    type="button"
                    title={workflowDisabledTitle}
                    className={`px-3 py-1.5 text-xs font-medium ${workflowCompleteActive ? "brand-btn" : "brand-btn-secondary"}`}
                    disabled={
                      !canDriveWorkflow ||
                      pending ||
                      serverStatus === "cancelled" ||
                      serverStatus !== "in_progress"
                    }
                    onClick={() => {
                      if (isSessionFormDirty && canSaveSession) {
                        setCompleteUnsavedPromptOpen(true);
                      } else {
                        setWorkflowActionConfirm("complete");
                      }
                    }}
                  >
                    {serverStatus === "cancelled"
                      ? "Abschließen"
                      : serverStatus === "completed"
                        ? "Abgeschlossen"
                        : "Abschließen"}
                  </button>
                </>
                {canManageSessions && sessionIsDeletable(selected.status) ? (
                  <button
                    type="button"
                    className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-800"
                    disabled={pending}
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    Löschen
                  </button>
                ) : null}
              </div>
            </div>

            {serverStatus === "scheduled" && sessionCheckInTracking ? (
              <div className="pt-1">
                <SessionCheckInTrackingPanel tracking={sessionCheckInTracking} />
              </div>
            ) : null}

            {serverStatus !== "in_progress" ? (
              <>
                <label className="block text-xs text-zinc-600">
                  Titel
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!canEditSelected}
                    className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-600">
                  Typ
                  <select
                    value={sessionType}
                    onChange={(e) => setSessionType(e.target.value as OkrReviewSessionType)}
                    disabled={!canEditSelected}
                    className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="mid_cycle">Mid-Cycle</option>
                    <option value="end_of_cycle">Ende des Zeitraums</option>
                  </select>
                </label>
                <label className="block text-xs text-zinc-600">
                  Termin
                  <input
                    type="datetime-local"
                    value={scheduledLocal}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                    disabled={!canEditSelected}
                    className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="block text-xs text-zinc-600">
                  <span className="block">Facilitator (OKR Process Owner)</span>
                  {canAssignFacilitator ? (
                    <select
                      value={facilitatorId}
                      onChange={(e) => setFacilitatorId(e.target.value)}
                      disabled={!selected}
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      {responsibles.map((r) => (
                        <option key={r.membershipId} value={r.membershipId}>
                          {r.fullName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800">
                      {facilitatorLabel}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <OkrReviewObjectiveDeck
                objectiveViews={objectiveViews}
                updatesByKrId={updatesByKrId}
                resetKey={selectedSessionId}
              />
            )}
            {meetingFieldsVisible ? (
              <>
                <label className="block text-xs text-zinc-600">
                  Zusammenfassung
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    disabled={!canEditSelected}
                    rows={2}
                    className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-600">
                  Meeting-Notizen
                  <textarea
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    disabled={!canEditSelected}
                    rows={3}
                    className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-600">
                  Diskussion
                  <textarea
                    value={discussionNotes}
                    onChange={(e) => setDiscussionNotes(e.target.value)}
                    disabled={!canEditSelected}
                    rows={3}
                    className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-600">
                  Entscheidungen / Nächste Schritte
                  <textarea
                    value={decisionsNext}
                    onChange={(e) => setDecisionsNext(e.target.value)}
                    disabled={!canEditSelected}
                    rows={3}
                    className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </>
            ) : null}
            {sessionTasksVisible ? (
              <div className="space-y-2 border-t border-zinc-200 pt-4">
                <h4 className="text-xs font-semibold text-zinc-800">To-Dos aus dem Meeting</h4>
                <ul className="space-y-2">
                  {sessionTasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-zinc-50/80 px-2 py-1.5"
                    >
                      <input
                        type="checkbox"
                        checked={t.is_done}
                        disabled={!canEditSelected || pending}
                        onChange={() => {
                          startTransition(async () => {
                            const r = await updateOkrReviewSessionTaskAction({
                              taskId: t.id,
                              isDone: !t.is_done,
                            });
                            if ("error" in r && r.error) window.alert(r.error);
                            else router.refresh();
                          });
                        }}
                        className="rounded border-zinc-400"
                      />
                      <div className="min-w-0 flex-1">
                        <span
                          className={`block text-sm ${
                            t.is_done ? "text-zinc-500 line-through" : "text-zinc-900"
                          }`}
                        >
                          {t.title}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-zinc-500">
                          Verantwortlich: {responsibleLabelForMembership(t.assignee_membership_id ?? null)}
                        </span>
                        {canEditSelected ? (
                          <label className="mt-2 block text-[10px] font-medium text-zinc-600">
                            Termin
                            <input
                              key={`${t.id}-${t.updated_at}`}
                              type="datetime-local"
                              defaultValue={toDatetimeLocalValue(t.due_at)}
                              disabled={pending}
                              onBlur={(e) => {
                                const iso = fromDatetimeLocalValue(e.target.value);
                                if (!iso) {
                                  window.alert("Bitte einen gültigen Termin setzen.");
                                  e.target.value = toDatetimeLocalValue(t.due_at);
                                  return;
                                }
                                if (new Date(iso).getTime() === new Date(t.due_at).getTime()) {
                                  return;
                                }
                                startTransition(async () => {
                                  const r = await updateOkrReviewSessionTaskAction({
                                    taskId: t.id,
                                    dueAtIso: iso,
                                  });
                                  if ("error" in r && r.error) window.alert(r.error);
                                  else router.refresh();
                                });
                              }}
                              className="mt-0.5 w-full max-w-[14.5rem] rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                            />
                          </label>
                        ) : (
                          <span className="mt-0.5 block text-[10px] text-zinc-500">
                            Termin: {formatSessionWhen(t.due_at)}
                          </span>
                        )}
                      </div>
                      {canEditSelected ? (
                        <button
                          type="button"
                          className="text-xs text-rose-700 underline disabled:opacity-50"
                          disabled={pending}
                          onClick={() => setTaskIdPendingDelete(t.id)}
                        >
                          Entfernen
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {canEditSelected ? (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-medium text-zinc-700">
                      Verantwortliche Person
                      <select
                        value={newTaskAssigneeId}
                        onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                        disabled={pending}
                        className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="">Bitte wählen …</option>
                        {responsibles.map((r) => (
                          <option key={r.membershipId} value={r.membershipId}>
                            {r.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px] font-medium text-zinc-700">
                      Termin *
                      <input
                        type="datetime-local"
                        value={newTaskDueLocal}
                        onChange={(e) => setNewTaskDueLocal(e.target.value)}
                        disabled={pending}
                        required
                        className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Aufgabe / To-Do …"
                        disabled={pending}
                        className="min-w-[12rem] flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        disabled={
                          pending ||
                          !newTaskTitle.trim() ||
                          !newTaskAssigneeId.trim() ||
                          !fromDatetimeLocalValue(newTaskDueLocal)
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          const tit = newTaskTitle.trim();
                          const aid = newTaskAssigneeId.trim();
                          const dueIso = fromDatetimeLocalValue(newTaskDueLocal);
                          if (!tit || !aid || !dueIso) return;
                          startTransition(async () => {
                            const r = await createOkrReviewSessionTaskAction({
                              sessionId: selected.id,
                              title: tit,
                              assigneeMembershipId: aid,
                              dueAtIso: dueIso,
                            });
                            if ("error" in r && r.error) window.alert(r.error);
                            else {
                              setNewTaskTitle("");
                              setNewTaskAssigneeId("");
                              setNewTaskDueLocal("");
                              router.refresh();
                            }
                          });
                        }}
                      >
                        Hinzufügen
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {canSaveSession ? (
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => {
                  startTransition(async () => {
                    const ok = await persistSessionFields();
                    if (ok) router.refresh();
                  });
                }}
              >
                Speichern
              </button>
            ) : (
              <p className="text-sm text-zinc-600">
                Session-Inhalte: nur Facilitator oder Session-Manage. Facilitator-Zuweisung: Berechtigung
                okr.review.facilitator.assign.
              </p>
            )}
          </div>
        )}
        </div>
      </div>
      </div>
    </div>
    </div>

    {deleteConfirmOpen && selected && canManageSessions && sessionIsDeletable(selected.status) ? (
      <ConfirmDialog
        title="Review-Session löschen?"
        description={
          <>
            <p>
              Die Session „
              <span className="font-medium text-zinc-800">{selected.title || "Ohne Titel"}</span>“ (Status:{" "}
              {STATUS_LABEL[selected.status] ?? selected.status}) wird unwiderruflich entfernt. Das kann nicht
              rückgängig gemacht werden.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Nur möglich, solange die Review nicht gestartet oder abgeschlossen ist.
            </p>
          </>
        }
        confirmLabel="Endgültig löschen"
        pending={pending}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            const r = await deleteOkrReviewSessionAction({ sessionId: selected.id });
            setDeleteConfirmOpen(false);
            if ("error" in r && r.error) window.alert(r.error);
            else {
              pushSession(null);
              router.refresh();
            }
          });
        }}
      />
    ) : null}
    {completeUnsavedPromptOpen && selected ? (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
        <button
          type="button"
          aria-label="Schließen"
          className="absolute inset-0 bg-zinc-900/50"
          onClick={pending ? undefined : () => setCompleteUnsavedPromptOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={completeUnsavedTitleId}
          className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
        >
          <h2 id={completeUnsavedTitleId} className="text-base font-semibold text-zinc-900">
            Ungespeicherte Änderungen
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Im Session-Formular gibt es Änderungen, die noch nicht gespeichert sind. Vor dem
            Abschließen speichern?
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setCompleteUnsavedPromptOpen(false)}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCompleteUnsavedPromptOpen(false);
                setWorkflowActionConfirm("complete");
              }}
              className="rounded-md border border-zinc-400 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
            >
              Ohne Speichern abschließen
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCompleteUnsavedPromptOpen(false);
                startTransition(async () => {
                  const ok = await persistSessionFields();
                  if (!ok) return;
                  const r = await updateOkrReviewSessionAction({
                    sessionId: selected.id,
                    status: "completed",
                  });
                  if ("error" in r && r.error) window.alert(r.error);
                  else router.refresh();
                });
              }}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Speichern und abschließen
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {workflowActionConfirm && selected ? (
      <ConfirmDialog
        title={WORKFLOW_CONFIRM_COPY[workflowActionConfirm].title}
        description={WORKFLOW_CONFIRM_COPY[workflowActionConfirm].description}
        confirmLabel={WORKFLOW_CONFIRM_COPY[workflowActionConfirm].confirmLabel}
        pending={pending}
        onCancel={() => setWorkflowActionConfirm(null)}
        onConfirm={() => {
          const act = workflowActionConfirm;
          const sessionId = selected.id;
          setWorkflowActionConfirm(null);
          startTransition(async () => {
            const nextStatus =
              act === "plan" ? "scheduled" : act === "start" ? "in_progress" : "completed";
            const r = await updateOkrReviewSessionAction({
              sessionId,
              status: nextStatus,
            });
            if ("error" in r && r.error) window.alert(r.error);
            else router.refresh();
          });
        }}
      />
    ) : null}
    {taskIdPendingDelete ? (
      <ConfirmDialog
        title="Aufgabe entfernen?"
        description="Die Aufgabe wird aus der Session gelöscht."
        confirmLabel="Entfernen"
        pending={pending}
        onCancel={() => setTaskIdPendingDelete(null)}
        onConfirm={() => {
          const id = taskIdPendingDelete;
          setTaskIdPendingDelete(null);
          startTransition(async () => {
            const r = await deleteOkrReviewSessionTaskAction({ taskId: id });
            if ("error" in r && r.error) window.alert(r.error);
            else router.refresh();
          });
        }}
      />
    ) : null}
    </>
  );
}

function CreateOkrReviewSessionForm(props: {
  cycleInstanceId: string;
  okrCycleId: string;
  facilitatorChoices: OkrResponsibleOption[];
  currentMembershipId: string;
  canAssignFacilitator: boolean;
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onCreated: (sessionId: string) => void;
}) {
  const {
    cycleInstanceId,
    okrCycleId,
    facilitatorChoices,
    currentMembershipId,
    canAssignFacilitator,
    pending,
    startTransition,
    onCreated,
  } = props;

  const defaultFacilitator =
    facilitatorChoices.find((r) => r.membershipId === currentMembershipId)?.membershipId ??
    facilitatorChoices[0]?.membershipId ??
    "";

  const [newTitle, setNewTitle] = useState("");
  const [newSessionType, setNewSessionType] = useState<OkrReviewSessionType>("mid_cycle");
  const [newScheduledLocal, setNewScheduledLocal] = useState("");
  const [newFacilitatorId, setNewFacilitatorId] = useState(defaultFacilitator);

  useEffect(() => {
    const d =
      facilitatorChoices.find((r) => r.membershipId === currentMembershipId)?.membershipId ??
      facilitatorChoices[0]?.membershipId ??
      "";
    if (!d) return;
    setNewFacilitatorId((prev) =>
      prev !== "" && facilitatorChoices.some((c) => c.membershipId === prev) ? prev : d
    );
  }, [facilitatorChoices, currentMembershipId]);

  const scheduledIso = fromDatetimeLocalValue(newScheduledLocal);
  const createReviewCanSubmit =
    newTitle.trim().length > 0 &&
    newScheduledLocal.trim().length > 0 &&
    scheduledIso != null &&
    newFacilitatorId.trim().length > 0;

  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-dashed border-zinc-300 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!createReviewCanSubmit || !scheduledIso) return;
        startTransition(async () => {
          const r = await createOkrReviewSessionAction({
            cycleInstanceId,
            okrCycleId,
            title: newTitle.trim(),
            sessionType: newSessionType,
            scheduledAtIso: scheduledIso,
            facilitatorMembershipId: newFacilitatorId.trim(),
          });
          if ("error" in r && r.error) {
            window.alert(r.error);
            return;
          }
          if ("sessionId" in r && r.sessionId) {
            setNewTitle("");
            setNewSessionType("mid_cycle");
            setNewScheduledLocal("");
            setNewFacilitatorId(defaultFacilitator);
            onCreated(r.sessionId);
          }
        });
      }}
    >
      <p className="text-sm font-medium text-zinc-800">Neue Review-Session</p>
      <p className="mt-1 text-xs text-zinc-500">
        Status beim Anlegen: <span className="font-medium text-zinc-700">Entwurf</span> (automatisch).
      </p>
      <label className="block text-xs text-zinc-600">
        Titel *
        <input
          name="title"
          required
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-zinc-600">
        Typ *
        <select
          name="session_type"
          required
          value={newSessionType}
          onChange={(e) => setNewSessionType(e.target.value as OkrReviewSessionType)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="mid_cycle">Mid-Cycle</option>
          <option value="end_of_cycle">Ende des Zeitraums</option>
        </select>
      </label>
      <label className="block text-xs text-zinc-600">
        Termin *
        <input
          name="scheduled_at"
          type="datetime-local"
          required
          value={newScheduledLocal}
          onChange={(e) => setNewScheduledLocal(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-zinc-600">
        Facilitator (OKR Process Owner) *
        <select
          name="facilitator_membership_id"
          required
          value={newFacilitatorId}
          onChange={(e) => setNewFacilitatorId(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        >
          {facilitatorChoices.map((r) => (
            <option key={r.membershipId} value={r.membershipId}>
              {r.fullName}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[10px] text-zinc-500">
          {canAssignFacilitator
            ? "Alle Responsibles der Organisation wählbar."
            : "Mit Ihrer Rolle können Sie nur sich selbst als Facilitator setzen."}
        </span>
      </label>
      <button
        type="submit"
        disabled={pending || !createReviewCanSubmit}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Review anlegen
      </button>
    </form>
  );
}
