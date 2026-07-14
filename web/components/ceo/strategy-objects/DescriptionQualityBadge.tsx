import type { DescriptionQualityDisplayStatus } from "@/lib/strategy-cycle/description-quality-view";
import { descriptionQualityDisplayLabelDe } from "@/lib/strategy-cycle/description-quality-view";

type Props = {
  status: DescriptionQualityDisplayStatus;
  compact?: boolean;
};

function badgeClass(status: DescriptionQualityDisplayStatus): string {
  switch (status) {
    case "ok":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "review":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "rework":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }
}

export function DescriptionQualityBadge({ status, compact = false }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${badgeClass(status)} ${
        compact ? "text-[10px]" : "text-xs"
      }`}
    >
      {descriptionQualityDisplayLabelDe(status)}
    </span>
  );
}
