import {
  okrObjectiveLifecycleBadgeClass,
  okrObjectiveLifecycleLabelDe,
} from "@/lib/okr/okr-objective-lifecycle";

export function OkrObjectiveLifecycleBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${okrObjectiveLifecycleBadgeClass(status)}`}
      title="OKR-Lifecycle-Status"
    >
      {okrObjectiveLifecycleLabelDe(status)}
    </span>
  );
}
