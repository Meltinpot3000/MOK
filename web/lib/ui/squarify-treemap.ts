export type TreemapLayoutItem = { id: string; weight: number };

export type TreemapRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HierarchicalTreemapField = {
  id: string;
  weight: number;
  children: TreemapLayoutItem[];
};

export type HierarchicalTreemapRect = TreemapRect & {
  parentId: string | null;
  kind: "field" | "direction";
};

const MIN_WEIGHT = 0.01;
const DEFAULT_GAP = 3;
const FIELD_INSET = 6;
const FIELD_HEADER_RESERVE = 30;

function normalizeWeights(items: TreemapLayoutItem[]): Array<{ id: string; weight: number }> {
  return items.map((item) => ({
    id: item.id,
    weight: Math.max(MIN_WEIGHT, item.weight),
  }));
}

function worstRatio(row: number[], length: number): number {
  if (row.length === 0 || length <= 0) return Infinity;
  const sum = row.reduce((s, v) => s + v, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  const l2 = length * length;
  return Math.max((l2 * max) / sum, sum / (l2 * min));
}

function layoutRow(
  row: Array<{ id: string; weight: number }>,
  rect: { x: number; y: number; width: number; height: number },
  horizontal: boolean,
  out: TreemapRect[]
): { x: number; y: number; width: number; height: number } {
  const sum = row.reduce((s, item) => s + item.weight, 0);
  if (sum <= 0) return rect;

  let offset = 0;
  if (horizontal) {
    const rowHeight = rect.height;
    for (const item of row) {
      const w = (item.weight / sum) * rect.width;
      out.push({
        id: item.id,
        x: rect.x + offset,
        y: rect.y,
        width: w,
        height: rowHeight,
      });
      offset += w;
    }
    return {
      x: rect.x,
      y: rect.y + rowHeight,
      width: rect.width,
      height: Math.max(0, rect.height - rowHeight),
    };
  }

  const rowWidth = rect.width;
  for (const item of row) {
    const h = (item.weight / sum) * rect.height;
    out.push({
      id: item.id,
      x: rect.x,
      y: rect.y + offset,
      width: rowWidth,
      height: h,
    });
    offset += h;
  }
  return {
    x: rect.x + rowWidth,
    y: rect.y,
    width: Math.max(0, rect.width - rowWidth),
    height: rect.height,
  };
}

function squarify(
  items: Array<{ id: string; weight: number }>,
  rect: { x: number; y: number; width: number; height: number },
  out: TreemapRect[]
): void {
  if (items.length === 0 || rect.width <= 0 || rect.height <= 0) return;

  if (items.length === 1) {
    out.push({ id: items[0].id, ...rect });
    return;
  }

  const horizontal = rect.width >= rect.height;
  const length = horizontal ? rect.height : rect.width;
  const row: Array<{ id: string; weight: number }> = [];
  let remaining = [...items];

  while (remaining.length > 0) {
    const next = remaining[0];
    const candidate = [...row, next];
    if (row.length === 0 || worstRatio(candidate.map((i) => i.weight), length) <= worstRatio(row.map((i) => i.weight), length)) {
      row.push(next);
      remaining.shift();
    } else {
      break;
    }
  }

  const nextRect = layoutRow(row, rect, horizontal, out);
  squarify(remaining, nextRect, out);
}

/** Layout by weight only — status/color must not influence rects. */
export function squarifyTreemap(
  items: TreemapLayoutItem[],
  width: number,
  height: number
): TreemapRect[] {
  if (width <= 0 || height <= 0) return [];
  if (items.length === 0) return [];

  const normalized = normalizeWeights(items);
  const total = normalized.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) {
    return [{ id: normalized[0].id, x: 0, y: 0, width, height }];
  }

  const sorted = [...normalized].sort((a, b) => b.weight - a.weight);
  const out: TreemapRect[] = [];
  squarify(sorted, { x: 0, y: 0, width, height }, out);
  return out;
}

function insetRect(rect: TreemapRect, gap: number): TreemapRect {
  const inset = gap / 2;
  return {
    id: rect.id,
    x: rect.x + inset,
    y: rect.y + inset,
    width: Math.max(0, rect.width - gap),
    height: Math.max(0, rect.height - gap),
  };
}

/**
 * Two-level treemap: fields fill the viewport; directions nest inside each field by weight.
 */
export function squarifyHierarchicalTreemap(
  fields: HierarchicalTreemapField[],
  width: number,
  height: number,
  options: { gap?: number; fieldInset?: number; headerReserve?: number } = {}
): HierarchicalTreemapRect[] {
  const gap = options.gap ?? DEFAULT_GAP;
  const fieldInset = options.fieldInset ?? FIELD_INSET;
  const headerReserve = options.headerReserve ?? FIELD_HEADER_RESERVE;
  if (width <= 0 || height <= 0 || fields.length === 0) return [];

  const fieldRects = squarifyTreemap(
    fields.map((f) => ({ id: f.id, weight: f.weight })),
    width,
    height
  ).map((rect) => insetRect(rect, gap));

  const out: HierarchicalTreemapRect[] = [];

  for (const fieldRect of fieldRects) {
    out.push({ ...fieldRect, parentId: null, kind: "field" });

    const field = fields.find((f) => f.id === fieldRect.id);
    const children = field?.children ?? [];
    if (children.length === 0 || fieldRect.width < 12 || fieldRect.height < 12) continue;

    const innerX = fieldRect.x + fieldInset;
    const innerY = fieldRect.y + fieldInset + headerReserve;
    const innerW = Math.max(0, fieldRect.width - fieldInset * 2);
    const innerH = Math.max(0, fieldRect.height - fieldInset * 2 - headerReserve);
    if (innerW < 8 || innerH < 8) continue;

    const childRects = squarifyTreemap(children, innerW, innerH).map((rect) => insetRect(rect, 2));
    for (const childRect of childRects) {
      out.push({
        ...childRect,
        x: innerX + childRect.x,
        y: innerY + childRect.y,
        parentId: fieldRect.id,
        kind: "direction",
      });
    }
  }

  return out;
}
