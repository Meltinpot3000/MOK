"use client";

import { useCallback, useRef, useState } from "react";
import type { OkrContributionJobPollState } from "@/app/api/analysis-background-jobs/okr-contribution-status/route";

const POLL_INTERVAL_MS = 1_500;
const INITIAL_DELAY_MS = 400;
const MAX_POLL_MS = 120_000;
/** Job-Eintrag kann kurz nach dem ersten Refresh fehlen — bis dahin weiter pollen. */
const NONE_GRACE_MS = 20_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

async function fetchContributionPollState(
  cycleInstanceId: string,
  okrObjectiveId: string,
  signal: AbortSignal
): Promise<OkrContributionJobPollState | null> {
  const params = new URLSearchParams({
    cycle_instance_id: cycleInstanceId,
    okr_objective_id: okrObjectiveId,
  });
  const res = await fetch(`/api/analysis-background-jobs/okr-contribution-status?${params}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { state?: OkrContributionJobPollState };
  return body.state ?? null;
}

/**
 * Nach OKR-Mutationen: sofort router.refresh(), dann pollen bis Contribution-Job fertig ist.
 * Gilt für alle Trigger auf der Planungsseite (Speichern, Pills, KR anlegen/löschen, …).
 */
export function useOkrContributionAssessmentRefresh(input: {
  contributionAssessmentEnabled: boolean;
  cycleInstanceId: string;
  refresh: () => Promise<void>;
}) {
  const { contributionAssessmentEnabled, cycleInstanceId, refresh } = input;
  const [assessingObjectiveIds, setAssessingObjectiveIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const abortByObjective = useRef(new Map<string, AbortController>());

  const refreshAfterMutation = useCallback(
    async (
      okrObjectiveId?: string,
      options?: { pollContributionAssessment?: boolean }
    ) => {
      await refresh();
      if (options?.pollContributionAssessment === false) return;
      if (!contributionAssessmentEnabled || !okrObjectiveId) return;

      abortByObjective.current.get(okrObjectiveId)?.abort();
      const controller = new AbortController();
      abortByObjective.current.set(okrObjectiveId, controller);

      setAssessingObjectiveIds((prev) => {
        const next = new Set(prev);
        next.add(okrObjectiveId);
        return next;
      });

      const started = Date.now();

      try {
        await sleep(INITIAL_DELAY_MS, controller.signal);

        while (Date.now() - started < MAX_POLL_MS) {
          const state = await fetchContributionPollState(
            cycleInstanceId,
            okrObjectiveId,
            controller.signal
          );

          if (state === "pending") {
            await sleep(POLL_INTERVAL_MS, controller.signal);
            continue;
          }

          if (state === "completed" || state === "failed") {
            await refresh();
            return;
          }

          if (Date.now() - started >= NONE_GRACE_MS) return;
          await sleep(POLL_INTERVAL_MS, controller.signal);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      } finally {
        if (abortByObjective.current.get(okrObjectiveId) === controller) {
          abortByObjective.current.delete(okrObjectiveId);
        }
        setAssessingObjectiveIds((prev) => {
          const next = new Set(prev);
          next.delete(okrObjectiveId);
          return next;
        });
      }
    },
    [contributionAssessmentEnabled, cycleInstanceId, refresh]
  );

  return { refreshAfterMutation, assessingObjectiveIds };
}
