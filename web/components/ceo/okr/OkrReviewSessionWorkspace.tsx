"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OkrCycleKpis, OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import type { OkrReviewSessionRow } from "@/lib/okr/review-sessions";
import type { OkrResponsibleOption } from "@/lib/okr/planning-data";
import { OkrKpiBar } from "@/components/ceo/okr/OkrKpiBar";
import {
  createOkrReviewSessionAction,
  deleteOkrReviewSessionAction,
  updateOkrReviewSessionAction,
  type OkrReviewSessionStatus,
  type OkrReviewSessionType,
} from "@/app/(ceo)/okr-workspace/actions";

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

  const canSaveSession = Boolean(selected && (canEditSelected || canAssignFacilitator));

  const [title, setTitle] = useState("");
  const [sessionType, setSessionType] = useState<OkrReviewSessionType>("mid_cycle");
  const [status, setStatus] = useState<OkrReviewSessionStatus>("draft");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [facilitatorId, setFacilitatorId] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [discussionNotes, setDiscussionNotes] = useState("");
  const [decisionsNext, setDecisionsNext] = useState("");

  useEffect(() => {
    if (!selected) {
      setTitle("");
      setSessionType("mid_cycle");
      setStatus("draft");
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
    setStatus(selected.status as OkrReviewSessionStatus);
    setScheduledLocal(toDatetimeLocalValue(selected.scheduled_at));
    setFacilitatorId(selected.facilitator_membership_id ?? currentMembershipId);
    setSummary(selected.summary ?? "");
    setMeetingNotes(selected.meeting_notes ?? "");
    setDiscussionNotes(selected.discussion_notes ?? "");
    setDecisionsNext(selected.decisions_next_steps ?? "");
  }, [selected, currentMembershipId]);

  const facilitatorLabel = useMemo(() => {
    const id = selected?.facilitator_membership_id;
    if (!id) return "—";
    return responsibles.find((r) => r.membershipId === id)?.fullName ?? id.slice(0, 8);
  }, [selected, responsibles]);

  function pushSession(id: string | null) {
    const q = new URLSearchParams(searchQuery);
    if (id) q.set("session", id);
    else q.delete("session");
    router.push(`/okr/review?${q.toString()}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Sessions</h2>
          {canManageSessions ? (
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              onClick={() => {
                startTransition(async () => {
                  const r = await createOkrReviewSessionAction({
                    cycleInstanceId,
                    okrCycleId,
                    sessionType: "mid_cycle",
                  });
                  if ("error" in r && r.error) {
                    window.alert(r.error);
                    return;
                  }
                  if ("sessionId" in r && r.sessionId) pushSession(r.sessionId);
                });
              }}
            >
              Review anlegen
            </button>
          ) : null}
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-600">Noch keine Review-Sessions für diesen Zeitraum.</p>
        ) : (
          <ul className="space-y-1">
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
      </div>

      <div className="space-y-4">
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
                <p className="text-xs text-zinc-500">Facilitator: {facilitatorLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEditSelected ? (
                  <>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs"
                      disabled={pending || status !== "draft"}
                      onClick={() => {
                        startTransition(async () => {
                          const r = await updateOkrReviewSessionAction({
                            sessionId: selected.id,
                            status: "scheduled",
                          });
                          if ("error" in r && r.error) window.alert(r.error);
                          else router.refresh();
                        });
                      }}
                    >
                      Planen
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const r = await updateOkrReviewSessionAction({
                            sessionId: selected.id,
                            status: "in_progress",
                          });
                          if ("error" in r && r.error) window.alert(r.error);
                          else router.refresh();
                        });
                      }}
                    >
                      Starten
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const r = await updateOkrReviewSessionAction({
                            sessionId: selected.id,
                            status: "completed",
                          });
                          if ("error" in r && r.error) window.alert(r.error);
                          else router.refresh();
                        });
                      }}
                    >
                      Abschließen
                    </button>
                  </>
                ) : null}
                {canManageSessions && selected.status === "draft" ? (
                  <button
                    type="button"
                    className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-800"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Session löschen?")) return;
                      startTransition(async () => {
                        const r = await deleteOkrReviewSessionAction({ sessionId: selected.id });
                        if ("error" in r && r.error) window.alert(r.error);
                        else {
                          pushSession(null);
                          router.refresh();
                        }
                      });
                    }}
                  >
                    Löschen
                  </button>
                ) : null}
              </div>
            </div>

            <label className="block text-xs text-zinc-600">
              Titel
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEditSelected}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
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
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OkrReviewSessionStatus)}
                  disabled={!canEditSelected}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  {Object.entries(STATUS_LABEL).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
            {canSaveSession ? (
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => {
                  startTransition(async () => {
                    if (canEditSelected) {
                      const r = await updateOkrReviewSessionAction({
                        sessionId: selected.id,
                        title,
                        sessionType,
                        status,
                        scheduledAtIso: fromDatetimeLocalValue(scheduledLocal),
                        facilitatorMembershipId: canAssignFacilitator ? facilitatorId : undefined,
                        summary,
                        meetingNotes,
                        discussionNotes,
                        decisionsNextSteps: decisionsNext,
                      });
                      if ("error" in r && r.error) window.alert(r.error);
                      else router.refresh();
                    } else if (canAssignFacilitator) {
                      const r = await updateOkrReviewSessionAction({
                        sessionId: selected.id,
                        facilitatorMembershipId: facilitatorId,
                      });
                      if ("error" in r && r.error) window.alert(r.error);
                      else router.refresh();
                    }
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
  );
}
