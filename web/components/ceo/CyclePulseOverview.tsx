import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
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

const CYCLE_LINKS = {
  strategy: "/strategy-cycle",
  review: "/reviews",
  okr: "/okr/dashboard",
} as const;

function toTime(value: string): number {
  return new Date(value).getTime();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-CH");
}

function buildFullRingStyle(progressPercent: number, arcColor: string, trackMixPercent = 20): CSSProperties {
  const progress = Math.round(progressPercent);
  return {
    backgroundImage: `conic-gradient(from -90deg, ${arcColor} 0deg ${progress * 3.6}deg, color-mix(in srgb, ${arcColor} ${trackMixPercent}%, white) ${progress * 3.6}deg 360deg)`,
  };
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

function CyclePulseLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`block shrink-0 rounded-full transition hover:z-40 hover:scale-[1.02] hover:shadow-xl focus-visible:z-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}

type TimeContentRingProps = {
  className: string;
  outerPadding: string;
  innerPadding: string;
  timePercent: number;
  contentPercent: number | null;
  deltaPp: number | null;
  children: ReactNode;
};

function TimeContentRing({
  className,
  outerPadding,
  innerPadding,
  timePercent,
  contentPercent,
  deltaPp,
  children,
}: TimeContentRingProps) {
  const hasContent = contentPercent != null;
  return (
    <div
      className={`rounded-full shadow-lg ${className} ${outerPadding}`}
      style={buildFullRingStyle(timePercent, TIME_ARC_COLOR, 28)}
    >
      <div
        className={`h-full w-full rounded-full ${hasContent ? innerPadding : ""}`}
        style={hasContent ? buildFullRingStyle(contentPercent, contentArcColor(deltaPp), 22) : undefined}
      >
        {children}
      </div>
    </div>
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
      <div className="mx-auto flex max-w-[980px] items-center justify-center py-4">
        <CyclePulseLink
          href={CYCLE_LINKS.strategy}
          label="Zum Strategiezyklus"
          className="relative z-10"
        >
          <div
            className="h-[320px] w-[320px] rounded-full p-[12px] shadow-xl sm:h-[340px] sm:w-[340px]"
            style={buildFullRingStyle(level1Pick.timeProgressPercent, TIME_ARC_COLOR, 24)}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full text-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, white)" }}
            >
              <p className="text-2xl font-semibold text-zinc-900">Strategiezyklus</p>
              {level1Pick.cycle ? (
                <p className="mt-2 text-xs text-zinc-700">
                  {formatDate(level1Pick.cycle.start_date)} – {formatDate(level1Pick.cycle.end_date)}
                </p>
              ) : null}
            </div>
          </div>
        </CyclePulseLink>

        <CyclePulseLink
          href={CYCLE_LINKS.review}
          label="Zum Reviewzyklus"
          className="relative z-20 -ml-14 sm:-ml-16"
        >
          <TimeContentRing
            className="h-[240px] w-[240px] sm:h-[255px] sm:w-[255px]"
            outerPadding="p-[11px]"
            innerPadding="p-[9px]"
            timePercent={reviewTimePercent}
            contentPercent={reviewContentPercent}
            deltaPp={reviewDeltaPp}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full text-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--brand-secondary) 10%, white)" }}
            >
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
            </div>
          </TimeContentRing>
        </CyclePulseLink>

        <CyclePulseLink
          href={CYCLE_LINKS.okr}
          label="Zum OKR-Zyklus"
          className="relative z-30 -ml-10 sm:-ml-12"
        >
          <TimeContentRing
            className="h-[175px] w-[175px] sm:h-[190px] sm:w-[190px]"
            outerPadding="p-[9px]"
            innerPadding="p-[7px]"
            timePercent={okrTimePercent}
            contentPercent={okrContentPercent}
            deltaPp={okrDeltaPp}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full text-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 10%, white)" }}
            >
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
            </div>
          </TimeContentRing>
        </CyclePulseLink>
      </div>
      <PulseArcLegend />
    </div>
  );

  if (fillHeight) {
    return (
      <section className="brand-card flex h-full min-h-0 flex-col overflow-hidden p-6">
        {header}
        <div className="mt-6 flex min-h-0 flex-1 flex-col brand-surface rounded-xl p-4">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-x-auto py-2">{diagram}</div>
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
