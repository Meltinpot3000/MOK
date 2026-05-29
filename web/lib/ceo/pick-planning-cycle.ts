import type { PlanningCycle } from "@/lib/ceo/queries";
import { linearCycleProgressPercent } from "@/lib/ceo/planning-cycle-time-progress";

function toTime(value: string): number {
  return new Date(value).getTime();
}

export type PickedPlanningCycle = {
  cycle: PlanningCycle | null;
  status: "laufend" | "nächster" | "letzter" | "leer";
  timeProgressPercent: number;
};

export function scopePlanningCycles(cycles: PlanningCycle[]): PlanningCycle[] {
  const activeSchemeCycles = cycles.filter((cycle) => cycle.is_active_scheme);
  return activeSchemeCycles.length > 0 ? activeSchemeCycles : cycles;
}

export function pickPlanningCycle(items: PlanningCycle[], nowMs: number): PickedPlanningCycle {
  const ordered = [...items].sort((a, b) => toTime(a.start_date) - toTime(b.start_date));
  const current = ordered.find((cycle) => toTime(cycle.start_date) <= nowMs && nowMs < toTime(cycle.end_date));
  if (current) {
    return {
      cycle: current,
      status: "laufend",
      timeProgressPercent: linearCycleProgressPercent(current.start_date, current.end_date, nowMs),
    };
  }

  const next = ordered.find((cycle) => toTime(cycle.start_date) > nowMs);
  if (next) {
    return { cycle: next, status: "nächster", timeProgressPercent: 0 };
  }

  const previous = [...ordered].reverse().find((cycle) => toTime(cycle.end_date) <= nowMs);
  if (previous) {
    return { cycle: previous, status: "letzter", timeProgressPercent: 100 };
  }

  return { cycle: null, status: "leer", timeProgressPercent: 0 };
}

export function pickPlanningCycleAtLevel(
  cycles: PlanningCycle[],
  levelNo: number,
  nowMs: number
): PickedPlanningCycle {
  return pickPlanningCycle(
    scopePlanningCycles(cycles).filter((cycle) => (cycle.level_no ?? 1) === levelNo),
    nowMs
  );
}
