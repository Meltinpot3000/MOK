import type { PositionedNode } from "@/components/analysis-visualization/types";

type LabelPlacement = {
  text: string;
  textX: number;
  textY: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  lineX1: number;
  lineY1: number;
  lineX2: number;
  lineY2: number;
};

function intersects(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }) {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildNodeLabelPlacements(
  nodes: PositionedNode[],
  selectedNodeId: string | null,
  centerX: number,
  centerY: number,
  maxChars: number
): Map<string, LabelPlacement> {
  const sorted = [...nodes].sort((a, b) => {
    if (a.id === selectedNodeId) return -1;
    if (b.id === selectedNodeId) return 1;
    return b.impact - a.impact;
  });

  const placements = new Map<string, LabelPlacement>();
  const placedBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const nodeCollisionBoxes = nodes.map((node) => {
    const nodeX = centerX + node.x;
    const nodeY = centerY + node.y;
    const radius = Math.max(3, (5 + node.impact * 1.9) * 0.5) + 2;
    return {
      id: node.id,
      x1: nodeX - radius,
      y1: nodeY - radius,
      x2: nodeX + radius,
      y2: nodeY + radius,
    };
  });

  for (const node of sorted) {
    const text = node.label.length > maxChars ? `${node.label.slice(0, maxChars)}...` : node.label;
    const labelWidth = Math.max(36, text.length * 6.2);
    const labelHeight = 12;
    const padX = 3;
    const padY = 2;
    const nodeX = centerX + node.x;
    const nodeY = centerY + node.y;

    const offsets = [0, 14, 28, 42, 56];
    const candidates: Array<{ x: number; baselineY: number; side: "left" | "right" }> = [];
    for (const offset of offsets) {
      candidates.push({ x: nodeX + 12, baselineY: nodeY - 8 - offset, side: "right" });
      candidates.push({ x: nodeX + 12, baselineY: nodeY + 8 + offset, side: "right" });
      candidates.push({ x: nodeX - 12 - labelWidth, baselineY: nodeY - 8 - offset, side: "left" });
      candidates.push({ x: nodeX - 12 - labelWidth, baselineY: nodeY + 8 + offset, side: "left" });
    }

    let chosen: { x: number; baselineY: number; side: "left" | "right" } | null = null;
    let chosenBox: { x1: number; y1: number; x2: number; y2: number } | null = null;

    for (const candidate of candidates) {
      const box = {
        x1: candidate.x - padX,
        y1: candidate.baselineY - labelHeight + padY - 1,
        x2: candidate.x + labelWidth + padX,
        y2: candidate.baselineY + padY + 1,
      };
      const overlapsLabels = placedBoxes.some((placed) => intersects(box, placed));
      const overlapsNodes = nodeCollisionBoxes.some((nodeBox) => nodeBox.id !== node.id && intersects(box, nodeBox));
      if (!overlapsLabels && !overlapsNodes) {
        chosen = candidate;
        chosenBox = box;
        break;
      }
    }

    if (!chosen || !chosenBox) {
      const fallback = candidates[0] ?? { x: nodeX + 12, baselineY: nodeY - 8, side: "right" as const };
      let fallbackBaseline = fallback.baselineY;
      let box = {
        x1: fallback.x - padX,
        y1: fallbackBaseline - labelHeight + padY - 1,
        x2: fallback.x + labelWidth + padX,
        y2: fallbackBaseline + padY + 1,
      };
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const overlapsLabels = placedBoxes.some((placed) => intersects(box, placed));
        const overlapsNodes = nodeCollisionBoxes.some((nodeBox) => nodeBox.id !== node.id && intersects(box, nodeBox));
        if (!overlapsLabels && !overlapsNodes) break;
        fallbackBaseline += 12;
        box = {
          x1: fallback.x - padX,
          y1: fallbackBaseline - labelHeight + padY - 1,
          x2: fallback.x + labelWidth + padX,
          y2: fallbackBaseline + padY + 1,
        };
      }
      chosen = { ...fallback, baselineY: fallbackBaseline };
      chosenBox = box;
    }

    placedBoxes.push(chosenBox);

    const lineEndX = chosen.side === "right" ? chosenBox.x1 - 2 : chosenBox.x2 + 2;
    const lineEndY = clamp(nodeY, chosenBox.y1 + 2, chosenBox.y2 - 2);
    const radius = Math.max(3, (5 + node.impact * 1.9) * 0.5);
    const vx = lineEndX - nodeX;
    const vy = lineEndY - nodeY;
    const dist = Math.max(1, Math.hypot(vx, vy));
    const lineStartX = nodeX + (vx / dist) * (radius + 1);
    const lineStartY = nodeY + (vy / dist) * (radius + 1);

    placements.set(node.id, {
      text,
      textX: chosen.x - nodeX,
      textY: chosen.baselineY - nodeY,
      boxX: chosenBox.x1 - nodeX,
      boxY: chosenBox.y1 - nodeY,
      boxWidth: chosenBox.x2 - chosenBox.x1,
      boxHeight: chosenBox.y2 - chosenBox.y1,
      lineX1: lineStartX - nodeX,
      lineY1: lineStartY - nodeY,
      lineX2: lineEndX - nodeX,
      lineY2: lineEndY - nodeY,
    });
  }

  return placements;
}
