import type { OrganizationUnit } from "@/lib/phase0/queries";
import type { OrganizationGraphOverlayMap } from "@/lib/organization-graph/queries";

type OrganizationHierarchyGraphProps = {
  units: OrganizationUnit[];
  overlays?: OrganizationGraphOverlayMap;
};

type TreeNode = OrganizationUnit & { children: TreeNode[] };
type PositionedNode = TreeNode & { x: number; y: number };
type Edge = { from: PositionedNode; to: PositionedNode };

const NODE_WIDTH = 260;
const NODE_HEIGHT = 132;
const H_GAP = 44;
const V_GAP = 58;
const PADDING = 24;

function buildChildMap(units: OrganizationUnit[]): Map<string | null, OrganizationUnit[]> {
  const childMap = new Map<string | null, OrganizationUnit[]>();
  for (const unit of units) {
    const key = unit.parent_id ?? null;
    const bucket = childMap.get(key) ?? [];
    bucket.push(unit);
    childMap.set(key, bucket);
  }

  for (const [, children] of childMap.entries()) {
    children.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  return childMap;
}

function buildTree(unit: OrganizationUnit, childMap: Map<string | null, OrganizationUnit[]>): TreeNode {
  return {
    ...unit,
    children: (childMap.get(unit.id) ?? []).map((child) => buildTree(child, childMap)),
  };
}

function layoutTree(root: TreeNode, rootOffsetX: number) {
  let nextLeafX = rootOffsetX;
  const nodes: PositionedNode[] = [];
  const edges: Edge[] = [];

  function walk(node: TreeNode, depth: number): {
    positioned: PositionedNode;
    leftLeafX: number;
    rightLeafX: number;
  } {
    const y = PADDING + depth * (NODE_HEIGHT + V_GAP);
    const positionedChildren = node.children.map((child) => walk(child, depth + 1));

    let x: number;
    let leftLeafX: number;
    let rightLeafX: number;
    if (positionedChildren.length === 0) {
      x = nextLeafX;
      leftLeafX = x;
      rightLeafX = x;
      nextLeafX += NODE_WIDTH + H_GAP;
    } else {
      leftLeafX = Math.min(...positionedChildren.map((child) => child.leftLeafX));
      rightLeafX = Math.max(...positionedChildren.map((child) => child.rightLeafX));
      x = (leftLeafX + rightLeafX) / 2;
    }

    const positionedNode: PositionedNode = { ...node, x, y };
    nodes.push(positionedNode);
    for (const child of positionedChildren) {
      edges.push({ from: positionedNode, to: child.positioned });
    }
    return { positioned: positionedNode, leftLeafX, rightLeafX };
  }

  walk(root, 0);
  return {
    nodes,
    edges,
    nextLeafX,
  };
}

function nodeLabel(typeName: string | null | undefined): string {
  if (!typeName || typeName.length === 0) return "-";
  const normalized = typeName.trim().toLowerCase();
  const translations: Record<string, string> = {
    organization: "Organisation",
    division: "Bereich",
    "business unit": "Gesch\u00E4ftseinheit",
    business_unit: "Gesch\u00E4ftseinheit",
    function: "Funktion",
    department: "Abteilung",
    team: "Team",
    program: "Programm",
    region: "Region",
    legal_entity: "Rechtseinheit",
    "legal entity": "Rechtseinheit",
  };
  return translations[normalized] ?? typeName;
}

function preview(values: string[]): string {
  if (values.length === 0) return "keine";
  if (values.length <= 2) return values.join(", ");
  return `${values[0]}, ${values[1]} +${values.length - 2}`;
}

function splitLabel(text: string, maxCharsPerLine: number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["-"];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, Math.max(1, maxCharsPerLine - 1)) + "…");
      current = "";
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length > maxLines) return lines.slice(0, maxLines);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length >= maxCharsPerLine ? `${last.slice(0, Math.max(1, maxCharsPerLine - 1))}…` : `${last}…`;
  }
  return lines;
}

export function OrganizationHierarchyGraph({ units, overlays = {} }: OrganizationHierarchyGraphProps) {
  const activeUnits = units.filter((unit) => unit.status === "active");
  const childMap = buildChildMap(activeUnits);
  const roots = (childMap.get(null) ?? []).map((root) => buildTree(root, childMap));

  if (roots.length === 0) return <p className="text-sm text-zinc-500">Keine aktiven Organisationseinheiten vorhanden.</p>;

  let cursorX = PADDING + NODE_WIDTH / 2;
  const allNodes: PositionedNode[] = [];
  const allEdges: Edge[] = [];
  for (const root of roots) {
    const laidOut = layoutTree(root, cursorX);
    allNodes.push(...laidOut.nodes);
    allEdges.push(...laidOut.edges);
    cursorX = laidOut.nextLeafX + NODE_WIDTH;
  }

  const width = Math.max(
    PADDING * 2 + NODE_WIDTH,
    Math.ceil(Math.max(...allNodes.map((node) => node.x)) + NODE_WIDTH / 2 + PADDING)
  );
  const height = Math.max(
    PADDING * 2 + NODE_HEIGHT,
    Math.ceil(Math.max(...allNodes.map((node) => node.y)) + NODE_HEIGHT + PADDING)
  );

  return (
    <div className="org-graph-wrap overflow-x-auto pb-3">
      <svg width={width} height={height} role="img" aria-label="Hierarchischer Organisationsgraph">
        {allEdges.map((edge) => {
          const startX = edge.from.x;
          const startY = edge.from.y + NODE_HEIGHT;
          const endX = edge.to.x;
          const endY = edge.to.y;
          const midY = (startY + endY) / 2;
          const path = `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`;
          return (
            <path
              key={`${edge.from.id}-${edge.to.id}`}
              d={path}
              fill="none"
              stroke="color-mix(in srgb, var(--brand-primary) 26%, #d4d4d8)"
              strokeWidth="1"
            />
          );
        })}
        {allNodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x - NODE_WIDTH / 2}, ${node.y})`}>
            <title>{`${node.name}
Verantwortliche: ${preview(overlays[node.id]?.responsibles ?? [])}
Industrien: ${preview(overlays[node.id]?.industries ?? [])}
Geschaeftsmodelle: ${preview(overlays[node.id]?.businessModels ?? [])}`}</title>
            <rect
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx="8"
              ry="8"
              fill="#fff"
              stroke="color-mix(in srgb, var(--brand-primary) 18%, #d4d4d8)"
            />
            <text
              x={NODE_WIDTH / 2}
              y={20}
              textAnchor="middle"
              fontSize="10"
              fill="color-mix(in srgb, var(--brand-secondary) 55%, #52525b)"
              style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
            >
              {node.code}
            </text>
            <text
              x={NODE_WIDTH / 2}
              y={40}
              textAnchor="middle"
              fontSize="13"
              fill="color-mix(in srgb, var(--brand-secondary) 80%, #18181b)"
              style={{ fontWeight: 600 }}
            >
              {splitLabel(node.name, 28, 2).map((line, index) => (
                <tspan key={`${node.id}-name-${index}`} x={NODE_WIDTH / 2} dy={index === 0 ? 0 : 14}>
                  {line}
                </tspan>
              ))}
            </text>
            <text
              x={NODE_WIDTH / 2}
              y={70}
              textAnchor="middle"
              fontSize="10"
              fill="color-mix(in srgb, var(--brand-secondary) 60%, #52525b)"
            >
              {nodeLabel(node.unit_type?.name ?? node.unit_type?.code)}
            </text>
            <rect x={12} y={74} width={74} height={18} rx={9} fill="#dbeafe" />
            <text x={49} y={86} textAnchor="middle" fontSize="9" fill="#1d4ed8" style={{ fontWeight: 700 }}>
              Verantwortl. {overlays[node.id]?.responsibles.length ?? 0}
            </text>
            <rect x={92} y={74} width={74} height={18} rx={9} fill="#fef3c7" />
            <text x={129} y={86} textAnchor="middle" fontSize="9" fill="#b45309" style={{ fontWeight: 700 }}>
              Industrien {overlays[node.id]?.industries.length ?? 0}
            </text>
            <rect x={172} y={74} width={76} height={18} rx={9} fill="#d1fae5" />
            <text x={210} y={86} textAnchor="middle" fontSize="9" fill="#047857" style={{ fontWeight: 700 }}>
              Modelle {overlays[node.id]?.businessModels.length ?? 0}
            </text>
            <text
              x={NODE_WIDTH / 2}
              y={108}
              textAnchor="middle"
              fontSize="9"
              fill="color-mix(in srgb, var(--brand-secondary) 45%, #52525b)"
            >
              {preview(overlays[node.id]?.responsibles ?? [])}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
