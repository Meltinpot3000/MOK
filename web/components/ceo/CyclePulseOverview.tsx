import type { ReactNode } from "react";
import { CyclePulseDiagram } from "@/components/ceo/CyclePulseDiagram";
import type { CyclePulseSnapshots, PlanningCycle } from "@/lib/ceo/queries";
import { formatProgressVsPlanWeeksShortDe } from "@/lib/ceo/cycle-content-progress";
import { pickPlanningCycle, scopePlanningCycles } from "@/lib/ceo/pick-planning-cycle";

type CyclePulseOverviewProps = {
  cycles: PlanningCycle[];
  nowIso: string;
  cyclePulse?: CyclePulseSnapshots;
  fillHeight?: boolean;
};

const TIME_ARC_COLOR = "#94a3b8";
const CONTENT_ON_TRACK_COLOR = "#059669";
const CONTENT_BEHIND_COLOR = "#d97706";

function toTime(value: string): number {
  return new Date(value).getTime();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-CH");
}

function contentArcColor(deltaPp: number | null): string {
  if (deltaPp == null) return CONTENT_ON_TRACK_COLOR;
  return deltaPp >= 0 ? CONTENT_ON_TRACK_COLOR : CONTENT_BEHIND_COLOR;
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function ProgressIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 12l3.5-4 2.5 2.5L13 5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PulseArcLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-zinc-600">
      <span className="inline-flex items-center gap-1.5">
        <ClockIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Äußerer Ring: Zeit</span>
        <span className="inline-block h-1.5 w-5 rounded-full" style={{ backgroundColor: TIME_ARC_COLOR }} />
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ProgressIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Innerer Ring: Fortschritt</span>
        <span
          className="inline-block h-1.5 w-5 rounded-full"
          style={{ backgroundColor: CONTENT_ON_TRACK_COLOR }}
        />
        <span className="text-zinc-500">· grün im Soll/voraus, gelb zurück</span>
      </span>
    </div>
  );
}

function CyclePlanDeltaLine({
  deltaPp,
  cycleStartIso,
  cycleEndIso,
}: {
  deltaPp: number | null;
  cycleStartIso?: string;
  cycleEndIso?: string;
}) {
  const label = formatProgressVsPlanWeeksShortDe(deltaPp, cycleStartIso, cycleEndIso);
  if (!label) return null;
  const onTrack = (deltaPp ?? 0) >= 0;
  return (
    <p
      className={`mt-2 rounded-md px-2 py-0.5 text-[10px] font-semibold leading-snug ${
        onTrack ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"
      }`}
    >
      {label}
    </p>
  );
}

export function CyclePulseOverview({
  cycles,
  nowIso,
  cyclePulse,
  fillHeight = false,
}: CyclePulseOverviewProps) {
  const nowMs = toTime(nowIso);
  const scope = scopePlanningCycles(cycles);
  const activeSchemeName =
    scope.find((cycle) => cycle.is_active_scheme)?.cycle_scheme_name ??
    cycles[0]?.cycle_scheme_name ??
    "Aktives Schema";

  const level1Cycles = scope.filter((cycle) => (cycle.level_no ?? 1) === 1);
  const level2Cycles = scope.filter((cycle) => (cycle.level_no ?? 1) === 2);
  const level3Cycles = scope.filter((cycle) => (cycle.level_no ?? 1) === 3);
  const level1Pick = pickPlanningCycle(level1Cycles, nowMs);
  const level2Pick = pickPlanningCycle(level2Cycles, nowMs);
  const level3Pick = pickPlanningCycle(level3Cycles, nowMs);

  const reviewPulse = cyclePulse?.review;
  const okrPulse = cyclePulse?.okr;

  const reviewTimePercent = reviewPulse?.timeProgressPercent ?? level2Pick.timeProgressPercent;
  const reviewContentPercent = reviewPulse?.contentProgressPercent ?? null;
  const reviewDeltaPp = reviewPulse?.deltaPp ?? null;

  const okrTimePercent = okrPulse?.timeProgressPercent ?? level3Pick.timeProgressPercent;
  const okrContentPercent = okrPulse?.contentProgressPercent ?? null;
  const okrDeltaPp = okrPulse?.deltaPp ?? null;

  const header = (
    <div
      className="shrink-0 rounded-xl p-5 text-white"
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--brand-accent) 0%, color-mix(in srgb, var(--brand-accent) 72%, white) 100%)",
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Zykluskarte</p>
      <h2 className="mt-2 text-xl font-semibold">Zyklusdarstellung über alle Ebenen</h2>
      <p className="mt-1 text-sm text-white/80">
        Schema: {activeSchemeName} | Stand: {formatDate(nowIso)}
      </p>
    </div>
  );

  const diagram = (
    <div className="flex flex-col items-center">
      <CyclePulseDiagram
        strategyTimePercent={level1Pick.timeProgressPercent}
        strategyLabel={
          <>
            <p className="text-2xl font-semibold text-zinc-900">Strategiezyklus</p>
            {level1Pick.cycle ? (
              <p className="mt-2 text-xs text-zinc-700">
                {formatDate(level1Pick.cycle.start_date)} – {formatDate(level1Pick.cycle.end_date)}
              </p>
            ) : null}
          </>
        }
        reviewTimePercent={reviewTimePercent}
        reviewContentPercent={reviewContentPercent}
        reviewContentColor={contentArcColor(reviewDeltaPp)}
        reviewLabel={
          <>
            <p className="text-xl font-semibold text-zinc-900">Reviewzyklus</p>
            {level2Pick.cycle ? (
              <p className="mt-2 text-[11px] text-zinc-700">
                {formatDate(level2Pick.cycle.start_date)} – {formatDate(level2Pick.cycle.end_date)}
              </p>
            ) : null}
            <CyclePlanDeltaLine
              deltaPp={reviewDeltaPp}
              cycleStartIso={level2Pick.cycle?.start_date}
              cycleEndIso={level2Pick.cycle?.end_date}
            />
          </>
        }
        okrTimePercent={okrTimePercent}
        okrContentPercent={okrContentPercent}
        okrContentColor={contentArcColor(okrDeltaPp)}
        okrLabel={
          <>
            <p className="text-lg font-semibold text-zinc-900">OKR Zyklus</p>
            {level3Pick.cycle ? (
              <p className="mt-1.5 max-w-[140px] text-[11px] leading-tight text-zinc-700">
                {formatDate(level3Pick.cycle.start_date)} – {formatDate(level3Pick.cycle.end_date)}
              </p>
            ) : null}
            <CyclePlanDeltaLine
              deltaPp={okrDeltaPp}
              cycleStartIso={level3Pick.cycle?.start_date}
              cycleEndIso={level3Pick.cycle?.end_date}
            />
          </>
        }
      />
      <PulseArcLegend />
    </div>
  );

  if (fillHeight) {
    return (
      <section className="brand-card flex flex-col overflow-hidden p-6">
        {header}
        <div className="mt-6 brand-surface rounded-xl p-4">
          <div className="flex items-center justify-center overflow-x-auto px-2 py-4">{diagram}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="brand-card overflow-hidden p-6">
      {header}
      <div className="mt-6 overflow-x-auto brand-surface rounded-xl p-4">{diagram}</div>
    </section>
  );
}
