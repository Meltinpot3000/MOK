import type {
  PositionedReferenceNetworkNode,
  ReferenceNetworkNode,
  ReferenceNodeKind,
  ReferenceNetworkZone,
} from "@/lib/strategy-network/types";

const NODE_WIDTH = 168;
const NODE_HEIGHT = 52;
const COLUMN_GAP = 28;
const ROW_GAP = 14;
const ZONE_PAD_X = 32;
const ZONE_PAD_Y = 48;
const ZONE_HEADER = 36;
const ZONE_GAP = 24;

const ZONE_ORDER: ReferenceNetworkZone[] = ["strategy", "execution", "review", "okr"];

const COLUMN_BY_KIND: Record<ReferenceNodeKind, number> = {
  unternehmensinfo: 0,
  analysis_entry: 1,
  analysis_cluster: 2,
  challenge: 3,
  direction: 4,
  strategy_objective: 5,
  program: 0,
  annual_target: 1,
  initiative: 2,
  review_session: 0,
  okr_objective: 0,
  key_result: 1,
};

const ZONE_LABEL: Record<ReferenceNetworkZone, string> = {
  strategy: "Strategiezyklus",
  execution: "Jahresplanung & Umsetzung",
  review: "Reviewzyklus",
  okr: "OKR-Zyklus",
};

export function layoutReferenceNetworkNodes(
  nodes: ReferenceNetworkNode[],
  viewportWidth: number
): {
  positioned: PositionedReferenceNetworkNode[];
  width: number;
  height: number;
  zoneBands: Array<{ zone: ReferenceNetworkZone; label: string; y: number; height: number }>;
} {
  const width = Math.max(viewportWidth, 1100);
  const byZone = new Map<ReferenceNetworkZone, ReferenceNetworkNode[]>();
  for (const zone of ZONE_ORDER) {
    byZone.set(zone, []);
  }
  for (const node of nodes) {
    byZone.get(node.zone)?.push(node);
  }

  const positioned: PositionedReferenceNetworkNode[] = [];
  const zoneBands: Array<{ zone: ReferenceNetworkZone; label: string; y: number; height: number }> = [];
  let yCursor = ZONE_PAD_Y;

  for (const zone of ZONE_ORDER) {
    const zoneNodes = byZone.get(zone) ?? [];
    if (zoneNodes.length === 0) continue;

    const columns = new Map<number, ReferenceNetworkNode[]>();
    for (const node of zoneNodes) {
      const col = COLUMN_BY_KIND[node.kind];
      const bucket = columns.get(col) ?? [];
      bucket.push(node);
      columns.set(col, bucket);
    }

    for (const [, bucket] of columns) {
      bucket.sort((a, b) => a.label.localeCompare(b.label, "de"));
    }

    const colIndices = [...columns.keys()].sort((a, b) => a - b);
    const maxRows = colIndices.reduce((max, col) => Math.max(max, columns.get(col)?.length ?? 0), 0);
    const zoneHeight = ZONE_HEADER + maxRows * (NODE_HEIGHT + ROW_GAP) + ZONE_PAD_Y;

    zoneBands.push({ zone, label: ZONE_LABEL[zone], y: yCursor, height: zoneHeight });

    const colCount = Math.max(colIndices.length, 1);
    const usableWidth = width - ZONE_PAD_X * 2;
    const colWidth = (usableWidth - (colCount - 1) * COLUMN_GAP) / colCount;

    for (const col of colIndices) {
      const bucket = columns.get(col) ?? [];
      const x = ZONE_PAD_X + col * (colWidth + COLUMN_GAP) + (colWidth - NODE_WIDTH) / 2;
      bucket.forEach((node, rowIndex) => {
        const y = yCursor + ZONE_HEADER + rowIndex * (NODE_HEIGHT + ROW_GAP);
        positioned.push({
          ...node,
          x,
          y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        });
      });
    }

    yCursor += zoneHeight + ZONE_GAP;
  }

  return {
    positioned,
    width,
    height: yCursor + ZONE_PAD_Y,
    zoneBands,
  };
}

export { NODE_WIDTH, NODE_HEIGHT };
