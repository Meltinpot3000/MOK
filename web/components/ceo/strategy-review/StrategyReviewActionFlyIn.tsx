"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStrategyReviewFeedbackDirty } from "@/components/ceo/strategy-review/strategy-review-feedback-dirty";
import {
  appendMeetingComment,
  formatMeetingCommentTime,
  meetingCommentInitials,
  parseMeetingNotesThread,
  serializeMeetingNotesThread,
  type StrategyReviewMeetingNotesThread,
} from "@/lib/strategy-review/meeting-notes-thread";

type Props = {
  mode: "feedback" | "meeting";
  /** Serialisierte Meeting-Notizen (JSON-Thread oder Legacy-Text) */
  notes: string;
  onNotesChange: (value: string) => void;
  /** Persistiert Notizen (z. B. nach neuem Kommentar). */
  onPersistNotes?: (serialized: string) => Promise<void>;
  canSave: boolean;
  canEditNotes?: boolean;
  pending: boolean;
  actorMembershipId: string;
  actorDisplayName: string;
  beforeSave?: () => Promise<void>;
};

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M15 3v4H9V3" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path
        d="M7 13h10v7H7v-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function StrategyReviewActionFlyIn({
  mode,
  notes,
  onNotesChange,
  onPersistNotes,
  canSave,
  canEditNotes = false,
  pending,
  actorMembershipId,
  actorDisplayName,
  beforeSave,
}: Props) {
  const { isDirty, runSave, clearDirty, markDirty } = useStrategyReviewFeedbackDirty();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const thread: StrategyReviewMeetingNotesThread = useMemo(
    () => parseMeetingNotesThread(notes),
    [notes]
  );

  useEffect(() => {
    if (!saveHint) return;
    const t = window.setTimeout(() => setSaveHint(null), 2800);
    return () => window.clearTimeout(t);
  }, [saveHint]);

  useEffect(() => {
    if (!expanded || mode !== "meeting") return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [expanded, mode, thread.comments.length]);

  const busy = pending || saving;
  const showNotes = mode === "meeting";

  const handleSaveStand = async () => {
    if (!canSave || busy) return;
    setSaving(true);
    setSaveHint(null);
    try {
      if (beforeSave) await beforeSave();
      const ok = await runSave();
      if (ok) {
        clearDirty();
        setSaveHint("Stand gespeichert");
      } else if (beforeSave) {
        setSaveHint("Notizen gespeichert — Entscheidungen noch offen");
      } else {
        setSaveHint(mode === "feedback" ? "Nichts zu speichern" : "Speichern unvollständig");
      }
    } catch {
      setSaveHint("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const handlePostComment = async () => {
    if (!canEditNotes || busy) return;
    const body = draft.trim();
    if (!body) return;
    const next = appendMeetingComment(thread, {
      authorMembershipId: actorMembershipId,
      authorName: actorDisplayName,
      body,
    });
    const serialized = serializeMeetingNotesThread(next);
    onNotesChange(serialized);
    setDraft("");
    setSaving(true);
    setSaveHint(null);
    try {
      if (onPersistNotes) {
        await onPersistNotes(serialized);
        setSaveHint("Kommentar gespeichert");
      } else {
        markDirty();
        setSaveHint("Kommentar hinzugefügt — Stand abspeichern");
      }
    } catch {
      setSaveHint("Kommentar konnte nicht gespeichert werden");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 sm:bottom-8 sm:right-8">
      {saveHint ? (
        <p className="pointer-events-none rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm">
          {saveHint}
        </p>
      ) : null}

      {!expanded ? (
        <button
          type="button"
          aria-label="Stand abspeichern"
          disabled={busy && !canSave}
          onClick={() => {
            if (canSave && !showNotes && isDirty) {
              void handleSaveStand();
              return;
            }
            setExpanded(true);
          }}
          className="pointer-events-auto relative inline-flex min-h-[3.25rem] items-center gap-2.5 rounded-full border-2 border-emerald-700 bg-emerald-600 px-5 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-emerald-900/25 transition hover:bg-emerald-500 hover:shadow-xl disabled:opacity-50"
        >
          <SaveIcon className="h-5 w-5 shrink-0" />
          <span>Stand abspeichern</span>
          {isDirty ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-amber-400"
              aria-hidden
            />
          ) : null}
        </button>
      ) : (
        <div className="pointer-events-auto flex w-[min(100vw-1.5rem,24rem)] flex-col overflow-hidden rounded-xl border border-[#edebe9] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between gap-2 border-b border-[#edebe9] bg-[#faf9f8] px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#242424]">
                {showNotes ? "Kommentare" : "Stand speichern"}
              </p>
              <p className="truncate text-[11px] text-[#616161]">
                {showNotes
                  ? `${thread.comments.length} Eintrag${thread.comments.length === 1 ? "" : "e"} im Verlauf`
                  : "Feedback zum Review sichern"}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#424242] hover:bg-[#f3f2f1]"
              onClick={() => setExpanded(false)}
              aria-expanded
            >
              Einklappen
              <ChevronIcon open />
            </button>
          </div>

          {showNotes ? (
            <>
              <div className="max-h-64 space-y-0 overflow-y-auto px-3 py-2">
                {thread.comments.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-[#616161]">
                    Noch keine Kommentare. Schreiben Sie den ersten Eintrag.
                  </p>
                ) : (
                  thread.comments.map((c, idx) => (
                    <div
                      key={c.id}
                      className={`flex gap-2.5 py-2.5 ${
                        idx < thread.comments.length - 1 ? "border-b border-[#f3f2f1]" : ""
                      }`}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6264a7] text-[11px] font-semibold text-white"
                        aria-hidden
                      >
                        {meetingCommentInitials(c.authorName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-[#242424]">{c.authorName}</span>
                          <span className="text-[11px] text-[#616161]">
                            {formatMeetingCommentTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-[#242424]">
                          {c.body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              <div className="border-t border-[#edebe9] bg-[#faf9f8] px-3 py-2.5">
                <div className="flex gap-2">
                  <div
                    className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6264a7] text-[11px] font-semibold text-white"
                    aria-hidden
                  >
                    {meetingCommentInitials(actorDisplayName || "?")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <textarea
                      rows={3}
                      value={draft}
                      disabled={!canEditNotes || busy}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Kommentar hinterlassen…"
                      className="w-full resize-none rounded-md border border-[#8a8886] bg-white px-2.5 py-2 text-sm text-[#242424] outline-none focus:border-[#6264a7] focus:ring-1 focus:ring-[#6264a7] disabled:bg-[#f3f2f1]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          void handlePostComment();
                        }
                      }}
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] text-[#616161]">Ctrl+Enter zum Senden</p>
                      <button
                        type="button"
                        disabled={!canEditNotes || busy || !draft.trim()}
                        onClick={() => void handlePostComment()}
                        className="rounded-md bg-[#6264a7] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#585a96] disabled:opacity-50"
                      >
                        Kommentar senden
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="px-3 py-3 text-xs leading-relaxed text-[#424242]">
              Speichert Ihre Bewertungen und Kommentare zum aktuellen Review-Stand.
            </div>
          )}

          <div className="border-t border-[#edebe9] bg-white p-3">
            <button
              type="button"
              disabled={!canSave || busy}
              onClick={() => void handleSaveStand()}
              className="inline-flex w-full min-h-[2.75rem] items-center justify-center gap-2 rounded-lg border-2 border-emerald-700 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-900/20 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <SaveIcon className="h-5 w-5" />
              {busy ? "Speichern…" : "Stand abspeichern"}
              {isDirty ? (
                <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden />
              ) : null}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
