"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReviewTriggerState } from "@/lib/strategy-review/types";

type Props = {
  cycleInstanceId: string;
  trigger: ReviewTriggerState | null;
};

function focusParam(state: string | undefined): string {
  switch (state) {
    case "ready_for_review":
      return "meeting";
    case "in_progress":
      return "meeting";
    case "decision_captured":
      return "release";
    case "completed":
      return "summary";
    default:
      return "preparation";
  }
}

export function ReviewHeaderTrigger({ cycleInstanceId, trigger }: Props) {
  const href = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("instance", cycleInstanceId);
    if (trigger?.review_id) sp.set("review", trigger.review_id);
    sp.set("focus", focusParam(trigger?.state));
    return `/okr/strategy-review?${sp.toString()}`;
  }, [cycleInstanceId, trigger?.review_id, trigger?.state]);

  if (!trigger?.visible) return null;

  const st = trigger.state;
  const isPrep = st === "preparation" || st === "no_review" || st === "outside_lead_time";
  const isReady = st === "ready_for_review";
  const isRunning = st === "in_progress";
  const isDecided = st === "decision_captured";
  const isDone = st === "completed";

  const label =
    trigger.procedure_status === "released"
      ? "Review freigegeben"
      : trigger.label ||
        (isPrep ? "Strategy Review" : isReady ? "Review abhalten" : isRunning ? "Review läuft" : "Strategy Review");

  const variantClass = isReady
    ? "border-emerald-300/80 bg-emerald-50/90 text-emerald-950 shadow-sm hover:bg-emerald-100/90"
    : isRunning || isDecided
      ? "border-zinc-200 bg-zinc-50 text-zinc-700 cursor-default"
      : "border-amber-200/70 bg-amber-50/80 text-amber-950 hover:bg-amber-100/80";

  const clickable = !isRunning && !isDone;

  const inner = (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{label}</span>
      {trigger.is_override && (isReady || isPrep) ? (
        <span className="rounded bg-zinc-800/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700">
          forciert
        </span>
      ) : null}
    </span>
  );

  if (!clickable) {
    return (
      <div
        className={`inline-flex max-w-full items-center rounded-lg border px-3 py-2 text-sm font-medium ${variantClass}`}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex max-w-full items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${variantClass}`}
    >
      {inner}
    </Link>
  );
}
