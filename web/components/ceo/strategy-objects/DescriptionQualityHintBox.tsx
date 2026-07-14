import type { DescriptionQualityViewModel } from "@/lib/strategy-cycle/description-quality-view";
import { DescriptionQualityBadge } from "@/components/ceo/strategy-objects/DescriptionQualityBadge";

type Props = {
  quality: DescriptionQualityViewModel;
};

export function DescriptionQualityHintBox({ quality }: Props) {
  if (quality.isAnalysable || quality.issues.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/40 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-zinc-900">Systemhinweis zur Beschreibung</p>
        <DescriptionQualityBadge status={quality.displayStatus} compact />
      </div>
      {quality.hintDe ? <p className="mt-2 text-xs text-zinc-700">{quality.hintDe}</p> : null}
      {quality.issueLabelsDe.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-zinc-700">
          {quality.issueLabelsDe.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-zinc-600">
        <span className="font-medium text-zinc-800">Empfehlung:</span> {quality.recommendationDe}
      </p>
    </div>
  );
}
