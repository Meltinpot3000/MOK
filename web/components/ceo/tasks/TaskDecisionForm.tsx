"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { decideApprovalTaskAction } from "@/lib/tasks/approval-actions";

export function TaskDecisionForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  const run = (decision: "approve" | "reject" | "request_changes") => {
    startTransition(async () => {
      const r = await decideApprovalTaskAction({
        taskId,
        decision,
        comment: comment.trim() || null,
      });
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      router.push("/my-tasks?filter=completed");
      router.refresh();
    });
  };

  return (
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-medium text-zinc-600">
        Kommentar (optional)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("approve")}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("reject")}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("request_changes")}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          
          Reqüst Changes
        </button>
      </div>
    </div>
  );
}
