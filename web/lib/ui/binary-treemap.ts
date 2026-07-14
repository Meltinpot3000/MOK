export type BinaryTreemapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BinaryTreemapItem = {
  id: string;
  weight: number;
};

export type BinaryTreemapNode = BinaryTreemapItem &
  BinaryTreemapRect & {
    compact: boolean;
    tiny: boolean;
  };

const MIN_WEIGHT = 0.1;
const DEFAULT_GAP = 2;
const COMPACT_WIDTH = 90;
const COMPACT_HEIGHT = 56;
const TINY_WIDTH = 40;
const TINY_HEIGHT = 24;

export function safeTreemapWeight(weight: number): number {
  const n = Number(weight);
  return Math.max(Number.isFinite(n) ? n : 0, MIN_WEIGHT);
}

function insetRect(rect: BinaryTreemapRect, gap: number): BinaryTreemapRect {
  const inset = gap / 2;
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    width: Math.max(0, rect.width - gap),
    height: Math.max(0, rect.height - gap),
  };
}

function markSizeFlags(rect: BinaryTreemapRect): Pick<BinaryTreemapNode, "compact" | "tiny"> {
  return {
    compact: rect.width < COMPACT_WIDTH || rect.height < COMPACT_HEIGHT,
    tiny: rect.width < TINY_WIDTH || rect.height < TINY_HEIGHT,
  };
}

/**
 * Recursive binary bisection: largest item first, remainder split along long axis.
 */
export function layoutBinaryTreemap(
  items: BinaryTreemapItem[],
  width: number,
  height: number,
  options: { gap?: number } = {}
): BinaryTreemapNode[] {
  const gap = options.gap ?? DEFAULT_GAP;
  if (width <= 0 || height <= 0 || items.length === 0) return [];

  const rects: Array<BinaryTreemapItem & BinaryTreemapRect> = [];
  layoutBinaryTreemapRecursive(
    items.map((item) => ({ id: item.id, weight: safeTreemapWeight(item.weight) })),
    { x: 0, y: 0, width, height },
    gap,
    rects
  );

  return rects.map((rect) => ({
    ...rect,
    ...markSizeFlags(rect),
  }));
}

function layoutBinaryTreemapRecursive(
  items: Array<{ id: string; weight: number }>,
  rect: BinaryTreemapRect,
  gap: number,
  out: Array<BinaryTreemapItem & BinaryTreemapRect>
): void {
  if (items.length === 0 || rect.width <= 0 || rect.height <= 0) return;

  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  if (sorted.length === 1) {
    out.push({ id: sorted[0].id, ...insetRect(rect, gap) });
    return;
  }

  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return;

  const largest = sorted[0];
  const share = largest.weight / total;
  const horizontal = rect.width >= rect.height;

  if (horizontal) {
    const firstWidth = rect.width * share;
    const firstRect = insetRect(
      { x: rect.x, y: rect.y, width: firstWidth, height: rect.height },
      gap
    );
    const restRect = {
      x: rect.x + firstWidth,
      y: rect.y,
      width: Math.max(0, rect.width - firstWidth),
      height: rect.height,
    };
    out.push({ id: largest.id, ...firstRect });
    layoutBinaryTreemapRecursive(sorted.slice(1), restRect, gap, out);
    return;
  }

  const firstHeight = rect.height * share;
  const firstRect = insetRect(
    { x: rect.x, y: rect.y, width: rect.width, height: firstHeight },
    gap
  );
  const restRect = {
    x: rect.x,
    y: rect.y + firstHeight,
    width: rect.width,
    height: Math.max(0, rect.height - firstHeight),
  };
  out.push({ id: largest.id, ...firstRect });
  layoutBinaryTreemapRecursive(sorted.slice(1), restRect, gap, out);
}

export const BINARY_TREEMAP_FIELD_HEADER_HEIGHT = 38;
export const BINARY_TREEMAP_FIELD_PADDING = 4;

export function innerFieldBodyRect(fieldRect: BinaryTreemapRect): BinaryTreemapRect {
  const padding = BINARY_TREEMAP_FIELD_PADDING;
  const headerHeight = BINARY_TREEMAP_FIELD_HEADER_HEIGHT;
  return {
    x: fieldRect.x + padding,
    y: fieldRect.y + headerHeight,
    width: Math.max(0, fieldRect.width - padding * 2),
    height: Math.max(0, fieldRect.height - headerHeight - padding),
  };
}
