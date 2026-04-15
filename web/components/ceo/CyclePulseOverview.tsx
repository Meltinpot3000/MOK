import type { PlanningCycle } from "@/lib/ceo/queries";
import { linearCycleProgressPercent } from "@/lib/ceo/planning-cycle-time-progress";

type CyclePulseOverviewProps = {
  cycles: PlanningCycle[];
  nowIso: string;
  /** Volle Höhe in einer Flex-Zeile (z. B. neben Leitkennzahlen), oben/unten bündig mit dem Partner-Panel. */
  fillHeight?: boolean;
};

type LevelSnapshot = {
  label: string;
  cycle: PlanningCycle | null;
  status: "laufend" | "n\u00E4chster" | "letzter" | "leer";
  progressPercent: number;
};

function toTime(value: string): number {
  return new Date(value).getTime();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-CH");
}

function overlaps(a: PlanningCycle, b: PlanningCycle): boolean {
  return toTime(a.start_date) < toTime(b.end_date) && toTime(b.start_date) < toTime(a.end_date);
}

function pickCycle(
  items: PlanningCycle[],
  nowMs: number
): { cycle: PlanningCycle | null; status: LevelSnapshot["status"]; progressPercent: number } {
  const ordered = [...items].sort((a, b) => toTime(a.start_date) - toTime(b.start_date));
  const current = ordered.find((cycle) => toTime(cycle.start_date) <= nowMs && nowMs < toTime(cycle.end_date));
  if (current) {
    const progressPercent = linearCycleProgressPercent(current.start_date, current.end_date, nowMs);
    return { cycle: current, status: "laufend", progressPercent };
  }

  const next = ordered.find((cycle) => toTime(cycle.start_date) > nowMs);
  if (next) return { cycle: next, status: "n\u00E4chster", progressPercent: 0 };

  const previous = [...ordered].reverse().find((cycle) => toTime(cycle.end_date) <= nowMs);
  if (previous) return { cycle: previous, status: "letzter", progressPercent: 100 };

  return { cycle: null, status: "leer", progressPercent: 0 };
}

function getSegmentIndex(segments: PlanningCycle[], nowMs: number): number {
  if (segments.length === 0) return -1;
  const currentIndex = segments.findIndex(
    (cycle) => toTime(cycle.start_date) <= nowMs && nowMs < toTime(cycle.end_date)
  );
  if (currentIndex >= 0) return currentIndex;

  const nextIndex = segments.findIndex((cycle) => toTime(cycle.start_date) > nowMs);
  if (nextIndex >= 0) return nextIndex;
  return segments.length - 1;
}

function buildRingStyle(progressPercent: number, colorVar: string) {
  const progress = Math.round(progressPercent);
  return {
    backgroundImage: `conic-gradient(${colorVar} ${progress}%, color-mix(in srgb, ${colorVar} 16%, white) ${progress}% 100%)`,
  };
}

export function CyclePulseOverview({ cycles, nowIso, fillHeight = false }: CyclePulseOverviewProps) {
  const nowMs = toTime(nowIso);
  const activeSchemeCycles = cycles.filter((cycle) => cycle.is_active_scheme);
  const scope = activeSchemeCycles.length > 0 ? activeSchemeCycles : cycles;
  const activeSchemeName =
    activeSchemeCycles[0]?.cycle_scheme_name ?? cycles[0]?.cycle_scheme_name ?? "Aktives Schema";

  const level1Cycles = scope.filter((cycle) => (cycle.level_no ?? 1) === 1);
  const level2Cycles = scope.filter((cycle) => (cycle.level_no ?? 1) === 2);
  const level3Cycles = scope.filter((cycle) => (cycle.level_no ?? 1) === 3);

  const level1Pick = pickCycle(level1Cycles, nowMs);
  const level2Pick = pickCycle(level2Cycles, nowMs);
  const level3Pick = pickCycle(level3Cycles, nowMs);

  const levels: LevelSnapshot[] = [
    {
      label: "Strategie (L1)",
      cycle: level1Pick.cycle,
      status: level1Pick.status,
      progressPercent: level1Pick.progressPercent,
    },
    {
      label: "Review (L2)",
      cycle: level2Pick.cycle,
      status: level2Pick.status,
      progressPercent: level2Pick.progressPercent,
    },
    {
      label: "OKR (L3)",
      cycle: level3Pick.cycle,
      status: level3Pick.status,
      progressPercent: level3Pick.progressPercent,
    },
  ];

  const okrAnchor = level2Pick.cycle;
  const okrSegments = okrAnchor
    ? level3Cycles
        .filter((cycle) => overlaps(cycle, okrAnchor))
        .sort((a, b) => toTime(a.start_date) - toTime(b.start_date))
    : level3Cycles.sort((a, b) => toTime(a.start_date) - toTime(b.start_date));
  const activeOkrSegmentIndex = getSegmentIndex(okrSegments, nowMs);
  const okrSegmentCount = Math.max(okrSegments.length, 1);
  const okrSegmentDeg = 360 / okrSegmentCount;
  const okrActiveStart = Math.max(0, activeOkrSegmentIndex) * okrSegmentDeg;
  const okrActiveEnd = okrActiveStart + okrSegmentDeg;

  const header = (
    <div
      className="shrink-0 rounded-xl p-5 text-white"
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--brand-accent) 0%, color-mix(in srgb, var(--brand-accent) 72%, white) 100%)",
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Cycle Map</p>
      <h2 className="mt-2 text-xl font-semibold">Zyklusdarstellung ueber alle Ebenen</h2>
      <p className="mt-1 text-sm text-white/80">
        Schema: {activeSchemeName} | Stand: {formatDate(nowIso)}
      </p>
    </div>
  );

  const diagram = (
    <div className="mx-auto flex max-w-[980px] items-center justify-center py-6">
          <div
            className="relative z-10 h-[350px] w-[350px] rounded-full p-[14px] shadow-xl"
            style={buildRingStyle(levels[0].progressPercent, "var(--brand-primary)")}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full text-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, white)" }}
            >
              <p className="text-2xl font-semibold text-zinc-900">Strategiezyklus</p>
              <p className="mt-2 text-base font-medium text-zinc-800">{Math.round(levels[0].progressPercent)}%</p>
              {levels[0].cycle ? (
                <p className="mt-2 text-xs text-zinc-700">
                  {formatDate(levels[0].cycle.start_date)} - {formatDate(levels[0].cycle.end_date)}
                </p>
              ) : null}
            </div>
          </div>

          <div
            className="relative z-20 -ml-14 h-[260px] w-[260px] rounded-full p-[12px] shadow-lg opacity-80"
            style={buildRingStyle(levels[1].progressPercent, "var(--brand-secondary)")}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full text-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--brand-secondary) 10%, white)" }}
            >
              <p className="text-xl font-semibold text-zinc-900">Reviewzyklus</p>
              <p className="mt-2 text-sm font-medium text-zinc-800">{Math.round(levels[1].progressPercent)}%</p>
              {levels[1].cycle ? (
                <p className="mt-2 text-[11px] text-zinc-700">
                  {formatDate(levels[1].cycle.start_date)} - {formatDate(levels[1].cycle.end_date)}
                </p>
              ) : null}
            </div>
          </div>

          <div
            className="relative z-30 -ml-14 h-[190px] w-[190px] rounded-full p-[10px] shadow-lg opacity-80"
            style={{
              backgroundImage: [
                `repeating-conic-gradient(from -90deg, transparent 0deg ${okrSegmentDeg - 1}deg, rgba(255,255,255,0.9) ${okrSegmentDeg - 1}deg ${okrSegmentDeg}deg)`,
                `conic-gradient(from -90deg, transparent ${okrActiveStart}deg, var(--brand-accent) ${okrActiveStart}deg ${okrActiveEnd}deg, transparent ${okrActiveEnd}deg 360deg)`,
                `conic-gradient(var(--brand-accent) ${Math.round(levels[2].progressPercent)}%, color-mix(in srgb, var(--brand-accent) 20%, white) ${Math.round(levels[2].progressPercent)}% 100%)`,
              ].join(", "),
            }}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full text-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 12%, white)" }}
            >
              <p className="text-lg font-semibold text-zinc-900">OKR Zyklus</p>
              <p className="mt-1 text-sm font-medium text-zinc-800">{Math.round(levels[2].progressPercent)}%</p>
              {levels[2].cycle ? (
                <p className="mt-2 max-w-[150px] text-[11px] leading-tight text-zinc-700">
                  {formatDate(levels[2].cycle.start_date)} - {formatDate(levels[2].cycle.end_date)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
  );

  if (fillHeight) {
    return (
      <section className="brand-card flex h-full min-h-0 flex-col overflow-hidden p-6">
        {header}
        <div className="mt-6 flex min-h-0 flex-1 flex-col brand-surface rounded-xl p-4">
          <div className="flex min-h-0 flex-1 items-center justify-center py-6">{diagram}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="brand-card overflow-hidden p-6">
      {header}
      <div className="mt-6 brand-surface rounded-xl p-4">{diagram}</div>
    </section>
  );
}
