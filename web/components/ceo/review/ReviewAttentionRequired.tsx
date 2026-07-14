import type { ReviewAttentionItem } from "@/lib/review/review-attention-rules";

type ReviewAttentionRequiredProps = {
  items: ReviewAttentionItem[];
  maxItems?: number;
  showHeading?: boolean;
};

export function ReviewAttentionRequired({
  items,
  maxItems,
  showHeading = true,
}: ReviewAttentionRequiredProps) {
  const list = maxItems !== undefined ? items.slice(0, maxItems) : items;

  return (
    <section className="brand-card p-6">
      {showHeading ? (
        <>
          <h2 className="text-lg font-semibold text-zinc-900">Handlungsbedarf</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Regelbasierte Auffälligkeiten — nicht durch niedrigen Fortschritt allein.
          </p>
        </>
      ) : null}
      {list.length === 0 ? (
        <p className={`text-sm text-zinc-600 ${showHeading ? "mt-4" : "mt-0"}`}>
          
          Keine Einträge nach den aktuellen Regeln.
        </p>
      ) : (
        <ul className={`space-y-3 ${showHeading ? "mt-4" : "mt-0"}`}>
          {list.map((item) => (
            <li
              key={item.id}
              className="brand-surface rounded-md border border-zinc-200 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    item.severity === "high"
                      ? "bg-red-100 text-red-800"
                      : item.severity === "medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {item.severity === "high" ? "Hoch" : item.severity === "medium" ? "Mittel" : "Niedrig"}
                </span>
                <span className="font-medium text-zinc-900">{item.title}</span>
              </div>
              <p className="mt-1 text-zinc-600">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
