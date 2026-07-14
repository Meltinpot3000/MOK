"use client";

import {
  IMPACT_PATH_COLUMN_LABEL,
  IMPACT_PATH_NODE_COLOR,
  IMPACT_PATH_NODE_LIFECYCLE_LINE_HEIGHT,
  IMPACT_PATH_NODE_PAD_TOP,
  IMPACT_PATH_NODE_TITLE_LINE_HEIGHT,
  type PositionedImpactPathNode,
} from "@/components/ceo/strategy-cycle/impact-path/impact-path-ui";

type ImpactPathNodeShapeProps = {
  node: PositionedImpactPathNode;
  dimmed: boolean;
  selected: boolean;
  onSelect: () => void;
};

export function ImpactPathNodeShape({ node, dimmed, selected, onSelect }: ImpactPathNodeShapeProps) {
  const lifecycleY =
    IMPACT_PATH_NODE_PAD_TOP +
    node.titleLines.length * IMPACT_PATH_NODE_TITLE_LINE_HEIGHT +
    6;
  const lifecycleText = node.lifecycleLabel ?? IMPACT_PATH_COLUMN_LABEL[node.kind];
  const notAnalysable = node.isAnalysable === false;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`${IMPACT_PATH_COLUMN_LABEL[node.kind]}: ${node.title}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <rect
        width={node.width}
        height={node.height}
        rx={10}
        fill={dimmed ? "rgba(255,255,255,0.55)" : notAnalysable ? "#fffbeb" : "#ffffff"}
        stroke={selected ? "#18181b" : notAnalysable ? "#d97706" : "rgba(0,0,0,0.1)"}
        strokeWidth={selected ? 2 : notAnalysable ? 1.5 : 1}
        strokeDasharray={notAnalysable && !selected ? "5 3" : undefined}
        opacity={dimmed ? 0.35 : 1}
      />
      <rect
        x={0}
        y={0}
        width={4}
        height={node.height}
        rx={2}
        fill={IMPACT_PATH_NODE_COLOR[node.kind]}
        opacity={dimmed ? 0.35 : 1}
      />
      <text
        x={12}
        y={IMPACT_PATH_NODE_PAD_TOP + 10}
        className="fill-zinc-900 text-[11px] font-semibold"
        opacity={dimmed ? 0.4 : 1}
        pointerEvents="none"
      >
        {node.titleLines.map((line, index) => (
          <tspan key={`${node.id}-title-${index}`} x={12} dy={index === 0 ? 0 : IMPACT_PATH_NODE_TITLE_LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
      <text
        x={12}
        y={lifecycleY}
        className="fill-zinc-500 text-[10px]"
        opacity={dimmed ? 0.4 : 1}
        pointerEvents="none"
      >
        {lifecycleText}
      </text>
      {notAnalysable ? (
        <>
          <rect
            x={node.width - 58}
            y={6}
            width={52}
            height={16}
            rx={8}
            fill="#fef3c7"
            stroke="#d97706"
            strokeWidth={0.75}
            opacity={dimmed ? 0.45 : 1}
            pointerEvents="none"
          />
          <text
            x={node.width - 32}
            y={17}
            textAnchor="middle"
            className="fill-amber-900 text-[9px] font-semibold"
            opacity={dimmed ? 0.45 : 1}
            pointerEvents="none"
          >
            {node.analysabilityLabelDe ?? "Prüfen"}
          </text>
        </>
      ) : null}
    </g>
  );
}
