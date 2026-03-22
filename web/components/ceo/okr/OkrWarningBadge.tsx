import type { OkrWarningKind } from "@/lib/okr/okr-cycle-view-model";

const COPY: Record<OkrWarningKind, string> = {
  no_direction: "Keine Stoßrichtung",
  kr_no_initiative: "KR ohne Initiative",
  initiative_no_kr: "Initiative ohne KR",
  no_checkin_stale: "Kein Check-in (alt)",
  overdue: "Fälligkeit überschritten",
  all_kr_no_initiative: "Alle KRs ohne Initiative",
};

export function OkrWarningBadge({ kind }: { kind: OkrWarningKind }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
      {COPY[kind]}
    </span>
  );
}
