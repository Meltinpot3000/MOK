import type { KpiCard } from "@/lib/ceo/kpis";

type KpiCardsProps = {
  items: KpiCard[];
};

export function KpiCards({ items }: KpiCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <article
          key={item.label}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {item.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{item.value}</p>
          {item.hint ? <p className="mt-2 text-xs text-zinc-500">{item.hint}</p> : null}
        </article>
      ))}
    </section>
  );
}
