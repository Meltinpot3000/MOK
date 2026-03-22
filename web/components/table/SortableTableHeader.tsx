"use client";

export type HeaderSortDirection = "asc" | "desc" | null;

type ButtonProps = {
  label: string;
  sortDirection: HeaderSortDirection;
  onRequestSort: () => void;
  buttonClassName?: string;
};

/** Nur der klickbare Kopf (ohne `<th>`), z. B. in Zellen mit Zusatzzeilen. */
export function SortableColumnHeaderButton({
  label,
  sortDirection,
  onRequestSort,
  buttonClassName = "",
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onRequestSort}
      title="Spalte sortieren"
      className={`inline-flex w-full max-w-full items-center gap-1 text-left ${buttonClassName}`.trim()}
    >
      <span className="min-w-0 flex-1">{label}</span>
      <span
        className="inline-flex shrink-0 flex-col text-[9px] leading-[0.65] text-zinc-400"
        aria-hidden
      >
        <span className={sortDirection === "asc" ? "text-zinc-900" : ""}>▲</span>
        <span className={sortDirection === "desc" ? "text-zinc-900" : ""}>▼</span>
      </span>
    </button>
  );
}

type SortableTableHeaderProps = ButtonProps & {
  className?: string;
};

/**
 * SharePoint-ähnlicher Spaltenkopf: Klick wechselt Sortierrichtung, `aria-sort` für Screenreader.
 */
export function SortableTableHeader({
  label,
  sortDirection,
  onRequestSort,
  className = "",
  buttonClassName = "",
}: SortableTableHeaderProps) {
  const ariaSort =
    sortDirection === "asc"
      ? "ascending"
      : sortDirection === "desc"
        ? "descending"
        : "none";

  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <SortableColumnHeaderButton
        label={label}
        sortDirection={sortDirection}
        onRequestSort={onRequestSort}
        buttonClassName={buttonClassName}
      />
    </th>
  );
}
