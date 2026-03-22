import type { ReviewStatus } from "@/lib/review/key-result-progress";

const LABELS: Record<ReviewStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

const STYLES: Record<ReviewStatus, string> = {
  on_track: "border-emerald-300 bg-emerald-50 text-emerald-900",
  at_risk: "border-amber-300 bg-amber-50 text-amber-900",
  off_track: "border-red-300 bg-red-50 text-red-900",
};

export function OkrStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
