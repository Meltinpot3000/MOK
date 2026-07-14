import type { ImpactPathNode, ImpactPathNodeKind } from "@/lib/strategy-cycle/impact-path-graph";

export const IMPACT_PATH_NODE_WIDTH = 176;
export const IMPACT_PATH_NODE_MIN_HEIGHT = 56;
/** @deprecated Nutze dynamische Knotenhöhe via measureImpactPathNodeHeight */
export const IMPACT_PATH_NODE_HEIGHT = IMPACT_PATH_NODE_MIN_HEIGHT;
export const IMPACT_PATH_NODE_TITLE_LINE_HEIGHT = 14;
export const IMPACT_PATH_NODE_LIFECYCLE_LINE_HEIGHT = 12;
export const IMPACT_PATH_NODE_PAD_TOP = 12;
export const IMPACT_PATH_NODE_TITLE_MAX_CHARS = 22;
export const IMPACT_PATH_NODE_MAX_TITLE_LINES = 4;
export const IMPACT_PATH_MAP_ASPECT_RATIO = 9 / 16;
export const IMPACT_PATH_COLUMN_GAP = 80;
export const IMPACT_PATH_ROW_GAP = 14;
export const IMPACT_PATH_PAD_X = 40;
export const IMPACT_PATH_PAD_Y = 56;
export const IMPACT_PATH_COLUMN_HEADER = 28;

export const IMPACT_PATH_COLUMN_ORDER: ImpactPathNodeKind[] = [
  "analysis_entry",
  "challenge",
  "direction",
  "objective",
];

export const IMPACT_PATH_COLUMN_LABEL: Record<ImpactPathNodeKind, string> = {
  analysis_entry: "Analyse-Einträge",
  challenge: "Herausforderungen",
  direction: "Stoßrichtungen",
  objective: "Ziele",
};

export const IMPACT_PATH_NODE_COLOR: Record<ImpactPathNodeKind, string> = {
  analysis_entry: "#94a3b8",
  challenge: "#dc2626",
  direction: "#2563eb",
  objective: "#7c3aed",
};

export type PositionedImpactPathNode = ImpactPathNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
  titleLines: string[];
};

export function wrapImpactPathNodeTitle(
  title: string,
  maxLineChars = IMPACT_PATH_NODE_TITLE_MAX_CHARS
): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLineChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (word.length > maxLineChars) {
      lines.push(`${word.slice(0, maxLineChars - 1)}…`);
      current = "";
    } else {
      current = word;
    }
    if (lines.length >= IMPACT_PATH_NODE_MAX_TITLE_LINES) break;
  }

  if (lines.length < IMPACT_PATH_NODE_MAX_TITLE_LINES && current) {
    lines.push(current);
  }

  return lines.slice(0, IMPACT_PATH_NODE_MAX_TITLE_LINES);
}

export function measureImpactPathNodeHeight(
  titleLineCount: number,
  hasLifecycleLabel: boolean
): number {
  const titleBlock = Math.max(1, titleLineCount) * IMPACT_PATH_NODE_TITLE_LINE_HEIGHT;
  const lifecycleBlock = hasLifecycleLabel ? IMPACT_PATH_NODE_LIFECYCLE_LINE_HEIGHT + 6 : 0;
  return Math.max(
    IMPACT_PATH_NODE_MIN_HEIGHT,
    IMPACT_PATH_NODE_PAD_TOP + titleBlock + lifecycleBlock + 10
  );
}

export function computeImpactPathMapViewportHeight(
  width: number,
  maxViewportHeight?: number
): number {
  const aspectHeight = Math.round(width * IMPACT_PATH_MAP_ASPECT_RATIO);
  const minHeight = 480;
  if (maxViewportHeight == null) {
    return Math.max(minHeight, aspectHeight);
  }
  return Math.max(minHeight, Math.min(aspectHeight, maxViewportHeight));
}

export function layoutImpactPathNodes(
  nodes: ImpactPathNode[],
  viewportWidth: number
): {
  positioned: PositionedImpactPathNode[];
  width: number;
  height: number;
  columnXs: number[];
} {
  const width = Math.max(viewportWidth, 980);
  const byKind = new Map<ImpactPathNodeKind, ImpactPathNode[]>();
  for (const kind of IMPACT_PATH_COLUMN_ORDER) {
    byKind.set(kind, []);
  }
  for (const node of nodes) {
    byKind.get(node.kind)?.push(node);
  }
  for (const [, bucket] of byKind) {
    bucket.sort((a, b) => a.title.localeCompare(b.title, "de"));
  }

  const columnXs = IMPACT_PATH_COLUMN_ORDER.map(
    (_, i) => IMPACT_PATH_PAD_X + i * (IMPACT_PATH_NODE_WIDTH + IMPACT_PATH_COLUMN_GAP)
  );

  const maxRows = Math.max(
    1,
    ...IMPACT_PATH_COLUMN_ORDER.map((kind) => byKind.get(kind)?.length ?? 0)
  );

  const positioned: PositionedImpactPathNode[] = [];
  const columnBottoms: number[] = [];

  for (let col = 0; col < IMPACT_PATH_COLUMN_ORDER.length; col += 1) {
    const kind = IMPACT_PATH_COLUMN_ORDER[col];
    const bucket = byKind.get(kind) ?? [];
    let y = IMPACT_PATH_PAD_Y + IMPACT_PATH_COLUMN_HEADER;

    for (const node of bucket) {
      const titleLines = wrapImpactPathNodeTitle(node.title);
      const height = measureImpactPathNodeHeight(
        titleLines.length,
        Boolean(node.lifecycleLabel)
      );
      positioned.push({
        ...node,
        column: col,
        titleLines,
        x: columnXs[col],
        y,
        width: IMPACT_PATH_NODE_WIDTH,
        height,
      });
      y += height + IMPACT_PATH_ROW_GAP;
    }

    columnBottoms.push(y + IMPACT_PATH_PAD_Y);
  }

  const height = Math.max(
    IMPACT_PATH_PAD_Y +
      IMPACT_PATH_COLUMN_HEADER +
      maxRows * (IMPACT_PATH_NODE_MIN_HEIGHT + IMPACT_PATH_ROW_GAP) +
      IMPACT_PATH_PAD_Y,
    ...columnBottoms,
    IMPACT_PATH_PAD_Y + IMPACT_PATH_COLUMN_HEADER + IMPACT_PATH_NODE_MIN_HEIGHT + IMPACT_PATH_PAD_Y
  );

  return { positioned, width, height, columnXs };
}

export function impactPathEdgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  h1: number,
  w2: number,
  h2: number
): string {
  const sx = x1 + w1;
  const sy = y1 + h1 / 2;
  const tx = x2;
  const ty = y2 + h2 / 2;
  const midX = (sx + tx) / 2;
  return `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
}

export function statusStrokeColor(status: string, selected: boolean, dimmed: boolean): string {
  if (dimmed) return "rgba(161,161,170,0.25)";
  if (selected) return "#18181b";
  if (status === "green") return "#059669";
  if (status === "yellow") return "#d97706";
  if (status === "red") return "#dc2626";
  return "rgba(63,63,70,0.55)";
}

export function statusLabelDe(status: string): string {
  if (status === "green") return "Grün";
  if (status === "yellow") return "Gelb";
  if (status === "red") return "Rot";
  return "Unklar";
}

export function statusBadgeClass(status: string): string {
  if (status === "green") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "yellow") return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "red") return "border-red-300 bg-red-50 text-red-800";
  return "border-zinc-300 bg-zinc-100 text-zinc-700";
}
