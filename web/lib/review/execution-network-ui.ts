/**
 * Layout und Styling für das Review-Umsetzungsnetzwerk (eigenständig vom Strategie-Wirkpfad).
 */
import type { ExecutionNetworkNode, ExecutionNetworkNodeKind } from "./execution-network-graph";
import type { ReviewStatus } from "./key-result-progress";

export const EXECUTION_NETWORK_NODE_WIDTH = 176;
export const EXECUTION_NETWORK_NODE_MIN_HEIGHT = 56;
export const EXECUTION_NETWORK_NODE_TITLE_LINE_HEIGHT = 14;
export const EXECUTION_NETWORK_NODE_SUBTITLE_LINE_HEIGHT = 12;
export const EXECUTION_NETWORK_NODE_PAD_TOP = 12;
export const EXECUTION_NETWORK_NODE_TITLE_MAX_CHARS = 22;
export const EXECUTION_NETWORK_NODE_MAX_TITLE_LINES = 4;
export const EXECUTION_NETWORK_MAP_ASPECT_RATIO = 9 / 16;
export const EXECUTION_NETWORK_COLUMN_GAP = 72;
export const EXECUTION_NETWORK_ROW_GAP = 14;
export const EXECUTION_NETWORK_PAD_X = 36;
export const EXECUTION_NETWORK_PAD_Y = 52;
export const EXECUTION_NETWORK_COLUMN_HEADER = 28;

export const EXECUTION_NETWORK_COLUMN_ORDER: ExecutionNetworkNodeKind[] = [
  "direction",
  "program",
  "annual_target",
  "initiative",
  "signal",
  "feedback",
];

/** Spaltenindex für Layout (Programm und Jahresziel teilen Spalte 1). */
export const EXECUTION_NETWORK_LAYOUT_COLUMN: Record<ExecutionNetworkNodeKind, number> = {
  direction: 0,
  program: 1,
  annual_target: 1,
  initiative: 2,
  signal: 3,
  feedback: 3,
};

export const EXECUTION_NETWORK_COLUMN_LABEL: Record<number, string> = {
  0: "Stoßrichtungen",
  1: "Programme / Jahresziele",
  2: "Initiativen",
  3: "Review-Signale / Maßnahmen",
};

export const EXECUTION_NETWORK_NODE_COLOR: Record<ExecutionNetworkNodeKind, string> = {
  direction: "#2563eb",
  program: "#0d9488",
  annual_target: "#64748b",
  initiative: "#7c3aed",
  signal: "#dc2626",
  feedback: "#d97706",
};

export type PositionedExecutionNetworkNode = ExecutionNetworkNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
  titleLines: string[];
};

export function wrapExecutionNetworkNodeTitle(
  title: string,
  maxLineChars = EXECUTION_NETWORK_NODE_TITLE_MAX_CHARS
): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLineChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.length > maxLineChars ? `${word.slice(0, maxLineChars - 1)}…` : word;
    }
    if (lines.length >= EXECUTION_NETWORK_NODE_MAX_TITLE_LINES) break;
  }
  if (current && lines.length < EXECUTION_NETWORK_NODE_MAX_TITLE_LINES) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

export function measureExecutionNetworkNodeHeight(titleLines: string[], hasSubtitle: boolean): number {
  const titleHeight = titleLines.length * EXECUTION_NETWORK_NODE_TITLE_LINE_HEIGHT;
  const subtitleHeight = hasSubtitle ? EXECUTION_NETWORK_NODE_SUBTITLE_LINE_HEIGHT + 4 : 0;
  return Math.max(
    EXECUTION_NETWORK_NODE_MIN_HEIGHT,
    EXECUTION_NETWORK_NODE_PAD_TOP + titleHeight + subtitleHeight + 14
  );
}

export function layoutExecutionNetworkNodes(
  nodes: ExecutionNetworkNode[],
  mapWidth: number
): { positioned: PositionedExecutionNetworkNode[]; contentWidth: number; contentHeight: number } {
  const columnCount = 4;
  const columnWidth =
    (mapWidth - EXECUTION_NETWORK_PAD_X * 2 - EXECUTION_NETWORK_COLUMN_GAP * (columnCount - 1)) /
    columnCount;

  const byColumn = new Map<number, ExecutionNetworkNode[]>();
  for (const node of nodes) {
    const col = EXECUTION_NETWORK_LAYOUT_COLUMN[node.kind];
    const list = byColumn.get(col) ?? [];
    list.push(node);
    byColumn.set(col, list);
  }

  for (const [, list] of byColumn) {
    list.sort((a, b) => a.title.localeCompare(b.title, "de"));
  }

  const positioned: PositionedExecutionNetworkNode[] = [];
  let maxY = EXECUTION_NETWORK_PAD_Y + EXECUTION_NETWORK_COLUMN_HEADER;

  for (let col = 0; col < columnCount; col++) {
    const colNodes = byColumn.get(col) ?? [];
    let y = EXECUTION_NETWORK_PAD_Y + EXECUTION_NETWORK_COLUMN_HEADER;

    for (const node of colNodes) {
      const titleLines = wrapExecutionNetworkNodeTitle(node.title);
      const height = measureExecutionNetworkNodeHeight(titleLines, Boolean(node.subtitle));
      const x = EXECUTION_NETWORK_PAD_X + col * (columnWidth + EXECUTION_NETWORK_COLUMN_GAP);
      positioned.push({
        ...node,
        x,
        y,
        width: EXECUTION_NETWORK_NODE_WIDTH,
        height,
        column: col,
        titleLines,
      });
      y += height + EXECUTION_NETWORK_ROW_GAP;
      maxY = Math.max(maxY, y);
    }
  }

  const contentWidth = mapWidth;
  const contentHeight = Math.max(400, maxY + EXECUTION_NETWORK_PAD_Y);
  return { positioned, contentWidth, contentHeight };
}

export function executionNetworkEdgePath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sw: number,
  sh: number,
  tw: number,
  th: number
): string {
  const x1 = sx + sw;
  const y1 = sy + sh / 2;
  const x2 = tx;
  const y2 = ty + th / 2;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

export function executionNetworkHealthStroke(
  health: ReviewStatus | "no_coverage" | "unclear" | "neutral",
  selected: boolean,
  dimmed: boolean
): string {
  if (selected) return "#18181b";
  if (dimmed) return "#d4d4d8";
  const colors: Record<string, string> = {
    on_track: "#16a34a",
    at_risk: "#d97706",
    off_track: "#dc2626",
    no_coverage: "#a1a1aa",
    unclear: "#a1a1aa",
    neutral: "#94a3b8",
  };
  return colors[health] ?? "#94a3b8";
}

export function executionNetworkHealthLabelDe(
  health: ReviewStatus | "no_coverage" | "unclear" | "neutral"
): string {
  const labels: Record<string, string> = {
    on_track: "Auf Kurs",
    at_risk: "Gefährdet",
    off_track: "Kritisch",
    no_coverage: "Keine operative Abdeckung",
    unclear: "Unklar",
    neutral: "—",
  };
  return labels[health] ?? health;
}

export function computeExecutionNetworkMapViewportHeight(
  mapWidth: number,
  maxViewportHeight: number
): number {
  const aspectHeight = Math.round(mapWidth * EXECUTION_NETWORK_MAP_ASPECT_RATIO);
  return Math.min(maxViewportHeight, Math.max(420, aspectHeight));
}
