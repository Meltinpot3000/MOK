import type { DesignFieldStatus } from "@/lib/strategy-cycle/design-fields-treemap";
import { designFieldStatusLabelDe } from "@/lib/strategy-cycle/design-fields-treemap";
import type { TreemapVisualStatus } from "@/lib/strategy-cycle/design-fields-treemap-layout";

export type DesignFieldPaletteStyle = {
  bg: string;
  border: string;
  header: string;
  headerText: string;
  childBg: string;
  childBorder: string;
  childHover: string;
};

export const DESIGN_FIELD_PALETTE: DesignFieldPaletteStyle[] = [
  {
    bg: "bg-sky-50",
    border: "border-sky-300",
    header: "bg-sky-700",
    headerText: "text-white",
    childBg: "bg-sky-100",
    childBorder: "border-sky-200",
    childHover: "hover:bg-sky-200",
  },
  {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    header: "bg-emerald-700",
    headerText: "text-white",
    childBg: "bg-emerald-100",
    childBorder: "border-emerald-200",
    childHover: "hover:bg-emerald-200",
  },
  {
    bg: "bg-violet-50",
    border: "border-violet-300",
    header: "bg-violet-700",
    headerText: "text-white",
    childBg: "bg-violet-100",
    childBorder: "border-violet-200",
    childHover: "hover:bg-violet-200",
  },
  {
    bg: "bg-amber-50",
    border: "border-amber-300",
    header: "bg-amber-700",
    headerText: "text-white",
    childBg: "bg-amber-100",
    childBorder: "border-amber-200",
    childHover: "hover:bg-amber-200",
  },
  {
    bg: "bg-cyan-50",
    border: "border-cyan-300",
    header: "bg-cyan-700",
    headerText: "text-white",
    childBg: "bg-cyan-100",
    childBorder: "border-cyan-200",
    childHover: "hover:bg-cyan-200",
  },
];

export const UNASSIGNED_FIELD_STYLE: DesignFieldPaletteStyle & {
  badge: string;
  dashed: string;
} = {
  bg: "bg-orange-50",
  border: "border-orange-300",
  dashed: "border-dashed",
  header: "bg-orange-100",
  headerText: "text-orange-950",
  childBg: "bg-white",
  childBorder: "border-orange-200",
  childHover: "hover:bg-orange-50",
  badge: "bg-orange-50 text-orange-700 border-orange-300",
};

export const STATUS_STYLES: Record<
  TreemapVisualStatus,
  { badge: string; marker: string; label: string }
> = {
  good: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    marker: "bg-emerald-500",
    label: "Gut",
  },
  warning: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    marker: "bg-amber-500",
    label: "Prüfen",
  },
  critical: {
    badge: "bg-red-50 text-red-700 border-red-200",
    marker: "bg-red-500",
    label: "Kritisch",
  },
  unknown: {
    badge: "bg-zinc-50 text-zinc-600 border-zinc-200",
    marker: "bg-zinc-400",
    label: "Offen",
  },
};

export function paletteForField(paletteIndex: number, isUnassigned?: boolean): DesignFieldPaletteStyle {
  if (isUnassigned) return UNASSIGNED_FIELD_STYLE;
  if (paletteIndex < 0) return DESIGN_FIELD_PALETTE[0];
  return DESIGN_FIELD_PALETTE[paletteIndex % DESIGN_FIELD_PALETTE.length];
}

export function statusBadgeClass(status: TreemapVisualStatus): string {
  return STATUS_STYLES[status].badge;
}

export function statusLabelDe(status: TreemapVisualStatus): string {
  return STATUS_STYLES[status].label;
}

/** @deprecated Use statusBadgeClass with TreemapVisualStatus in treemap views */
export function designFieldStatusBadgeClass(status: DesignFieldStatus): string {
  switch (status) {
    case "strong":
      return STATUS_STYLES.good.badge;
    case "medium":
      return STATUS_STYLES.warning.badge;
    case "weak":
      return STATUS_STYLES.critical.badge;
    default:
      return STATUS_STYLES.unknown.badge;
  }
}

export function designFieldTileSurfaceClass(
  _status: DesignFieldStatus,
  isUngroupedBacklog: boolean
): string {
  if (isUngroupedBacklog) {
    return `${UNASSIGNED_FIELD_STYLE.bg} ${UNASSIGNED_FIELD_STYLE.border} ${UNASSIGNED_FIELD_STYLE.dashed}`;
  }
  return "bg-zinc-50 border-zinc-200 border-solid";
}

export function compactDirectionLabel(label: string, compact: boolean): string {
  if (!compact) return label;
  const codeMatch = label.match(/^([A-Z0-9_]+)/);
  if (codeMatch) return codeMatch[1];
  return label.length > 18 ? `${label.slice(0, 16)}…` : label;
}

export { designFieldStatusLabelDe };

export const DESIGN_TAB_HREF = "/strategy-cycle?l1=strategic-directions&l2=design";
export const STRATEGY_MATRIX_HREF = "/strategy-cycle?l1=strategic-directions&l2=strategy-matrix";
