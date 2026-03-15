"use client";

type FilterPanelProps = {
  analysisTypeFilter: string;
  setAnalysisTypeFilter: (value: string) => void;
  minImpact: number;
  setMinImpact: (value: number) => void;
  minConfidence: number;
  setMinConfidence: (value: number) => void;
  minProximity: number;
  setMinProximity: (value: number) => void;
  minSupport: number;
  setMinSupport: (value: number) => void;
  minRepulsion: number;
  setMinRepulsion: (value: number) => void;
  linkTypeFilter: string;
  setLinkTypeFilter: (value: string) => void;
  selectedIndustryIds: string[];
  setSelectedIndustryIds: (ids: string[]) => void;
  selectedBusinessModelIds: string[];
  setSelectedBusinessModelIds: (ids: string[]) => void;
  selectedOperatingModelIds: string[];
  setSelectedOperatingModelIds: (ids: string[]) => void;
  industries: Array<{ id: string; name: string }>;
  businessModels: Array<{ id: string; name: string }>;
  operatingModels: Array<{ id: string; name: string }>;
};

function toggleSelection(items: string[], id: string) {
  if (items.includes(id)) return items.filter((item) => item !== id);
  return [...items, id];
}

function MultiSelectChips({
  title,
  options,
  selectedIds,
  onToggle,
}: {
  title: string;
  options: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-700">{title}</p>
      <div className="flex flex-wrap gap-1">
        {options.length === 0 ? (
          <span className="text-xs text-zinc-500">Keine Optionen</span>
        ) : (
          options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              className={`rounded border px-2 py-1 text-xs ${
                selectedIds.includes(option.id)
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              {option.name}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function FilterPanel({
  analysisTypeFilter,
  setAnalysisTypeFilter,
  minImpact,
  setMinImpact,
  minConfidence,
  setMinConfidence,
  minProximity,
  setMinProximity,
  minSupport,
  setMinSupport,
  minRepulsion,
  setMinRepulsion,
  linkTypeFilter,
  setLinkTypeFilter,
  selectedIndustryIds,
  setSelectedIndustryIds,
  selectedBusinessModelIds,
  setSelectedBusinessModelIds,
  selectedOperatingModelIds,
  setSelectedOperatingModelIds,
  industries,
  businessModels,
  operatingModels,
}: FilterPanelProps) {
  return (
    <aside className="rounded-md border border-zinc-200 bg-white p-3">
      <h3 className="mb-3 text-sm font-semibold text-zinc-900">Filter</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 [&>div]:min-w-0">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-600">Analyse-Typ</span>
            <select
              value={analysisTypeFilter}
              onChange={(event) => setAnalysisTypeFilter(event.target.value)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs"
            >
              <option value="all">Alle</option>
              <option value="environment">Umfeld</option>
              <option value="company">Unternehmen</option>
              <option value="competitor">Wettbewerb</option>
              <option value="swot">SWOT</option>
              <option value="workshop">Workshop</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-600">Link-Typ</span>
            <select
              value={linkTypeFilter}
              onChange={(event) => setLinkTypeFilter(event.target.value)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs"
            >
              <option value="all">Alle</option>
              <option value="related_to">related_to</option>
              <option value="causes">causes</option>
              <option value="supports">supports</option>
              <option value="contradicts">contradicts</option>
              <option value="amplifies">amplifies</option>
              <option value="depends_on">depends_on</option>
              <option value="duplicates">duplicates</option>
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <span>Min Impact</span>
              <span className="text-zinc-700">{minImpact}/5</span>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={minImpact}
              onChange={(event) => setMinImpact(Number(event.target.value))}
              className="w-full accent-[var(--brand-primary)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <span>Min Link Confidence</span>
              <span className="text-zinc-700">{minConfidence}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minConfidence}
              onChange={(event) => setMinConfidence(Number(event.target.value))}
              className="w-full accent-[var(--brand-primary)]"
            />
          </label>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <span>Min Naehe</span>
              <span className="text-zinc-700">{minProximity}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minProximity}
              onChange={(event) => setMinProximity(Number(event.target.value))}
              className="w-full accent-[var(--brand-primary)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <span>Min Unterstuetzung</span>
              <span className="text-zinc-700">{minSupport}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minSupport}
              onChange={(event) => setMinSupport(Number(event.target.value))}
              className="w-full accent-[var(--brand-primary)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <span>Min Abstossung</span>
              <span className="text-zinc-700">{minRepulsion}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minRepulsion}
              onChange={(event) => setMinRepulsion(Number(event.target.value))}
              className="w-full accent-[var(--brand-primary)]"
            />
          </label>
        </div>

        <div className="space-y-3">
          <MultiSelectChips
            title="Industry"
            options={industries}
            selectedIds={selectedIndustryIds}
            onToggle={(id) => setSelectedIndustryIds(toggleSelection(selectedIndustryIds, id))}
          />
          <MultiSelectChips
            title="Business Model"
            options={businessModels}
            selectedIds={selectedBusinessModelIds}
            onToggle={(id) => setSelectedBusinessModelIds(toggleSelection(selectedBusinessModelIds, id))}
          />
          <MultiSelectChips
            title="Operating Model"
            options={operatingModels}
            selectedIds={selectedOperatingModelIds}
            onToggle={(id) => setSelectedOperatingModelIds(toggleSelection(selectedOperatingModelIds, id))}
          />
        </div>
      </div>
    </aside>
  );
}
