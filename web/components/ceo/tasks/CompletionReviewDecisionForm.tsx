"use client";

import { useState, useTransition } from "react";
import { decideCompletionReviewTaskAction } from "@/lib/tasks/completion-review-actions";

export function CompletionReviewDecisionForm({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  const run = (decision: "approve" | "reject") => {
    const trimmed = comment.trim();
    if (decision === "reject" && !trimmed) {
      window.alert("Kommentar ist bei Ablehnung Pflicht.");
      return;
    }
    startTransition(async () => {
      const r = await decideCompletionReviewTaskAction({
        taskId,
        decision,
        comment: trimmed || null,
      });
      if (r && "error" in r) {
        window.alert(r.error);
      }
    });
  };

  return (
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-medium text-zinc-600">
        Kommentar {comment.trim() ? "" : "(bei Ablehnung Pflicht)"}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          placeholder="Begründung bei Ablehnung oder optionaler Hinweis bei Bestätigung …"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("approve")}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          100 % bestätigen
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("reject")}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Ablehnen
        </button>
      </div>
    </div>
  );
}
