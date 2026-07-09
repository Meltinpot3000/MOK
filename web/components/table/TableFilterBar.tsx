"use client";

export type TableFilterSelectOption = {
  value: string;
  label: string;
};

const LABEL_CLASS =
  "mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500";
const SELECT_CLASS =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs";
const INPUT_CLASS = "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs";

type TableFilterBarProps = {
  children: React.ReactNode;
  className?: string;
};

export function TableFilterBar({ children, className }: TableFilterBarProps) {
  return (
    <div className={`flex w-full min-w-0 max-w-full flex-wrap items-end gap-2${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

type TableFilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: TableFilterSelectOption[];
  allLabel?: string;
  className?: string;
};

export function TableFilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "Alle",
  className = "min-w-[120px] flex-1",
}: TableFilterSelectProps) {
  return (
    <div className={className}>
      <label className={LABEL_CLASS}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type TableFilterSearchProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
};

export function TableFilterSearch({
  value,
  onChange,
  label = "Suche Titel",
  placeholder = "…",
  className = "min-w-[160px] flex-[2]",
}: TableFilterSearchProps) {
  return (
    <div className={className}>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
    </div>
  );
}
