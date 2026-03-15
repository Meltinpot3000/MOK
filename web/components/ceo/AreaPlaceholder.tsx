type AreaPlaceholderProps = {
  title: string;
  purpose: string;
  audience: string;
};

export function AreaPlaceholder({ title, purpose, audience }: AreaPlaceholderProps) {
  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fachbereich</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-600">{purpose}</p>
      </header>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Zielgruppe</h2>
        <p className="mt-2 text-sm text-zinc-600">{audience}</p>
      </section>

      <section className="brand-surface border-dashed p-6">
        <p className="text-sm text-zinc-600">
          Dieser Bereich ist auf dem neuen Phase-0-Fundament vorbereitet und wird in der nächsten
          Iteration mit den vollständigen Datenobjekten, KPIs und Drilldowns ausgebaut.
        </p>
      </section>
    </div>
  );
}
