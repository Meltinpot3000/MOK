"use client";

import {
  EXECUTION_NETWORK_NODE_COLOR,
  EXECUTION_NETWORK_NODE_PAD_TOP,
  EXECUTION_NETWORK_NODE_TITLE_LINE_HEIGHT,
  type PositionedExecutionNetworkNode,
} from "@/lib/review/execution-network-ui";

type ExecutionNetworkNodeShapeProps = {
  node: PositionedExecutionNetworkNode;
  selected: boolean;
  dimmed?: boolean;
  onSelect: () => void;
};

export function ExecutionNetworkNodeShape({
  node,
  selected,
  dimmed = false,
  onSelect,
}: ExecutionNetworkNodeShapeProps) {
  const isAnnualTarget = node.kind === "annual_target";
  const isProgram = node.kind === "program";
  const subtitleY =
    EXECUTION_NETWORK_NODE_PAD_TOP +
    node.titleLines.length * EXECUTION_NETWORK_NODE_TITLE_LINE_HEIGHT +
    4;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={node.title}
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
        fill={dimmed ? "rgba(255,255,255,0.55)" : isAnnualTarget ? "#f8fafc" : "#ffffff"}
        stroke={selected ? "#18181b" : isAnnualTarget ? "#cbd5e1" : "rgba(0,0,0,0.1)"}
        strokeWidth={selected ? 2 : isAnnualTarget ? 1 : 1}
        strokeDasharray={isAnnualTarget ? "4 3" : undefined}
        opacity={dimmed ? 0.45 : 1}
      />
      <rect
        x={0}
        y={0}
        width={4}
        height={node.height}
        rx={2}
        fill={EXECUTION_NETWORK_NODE_COLOR[node.kind]}
      />
      <text
        x={12}
        y={EXECUTION_NETWORK_NODE_PAD_TOP + 10}
        className={`text-[11px] font-semibold ${isAnnualTarget ? "fill-zinc-600" : "fill-zinc-900"}`}
        pointerEvents="none"
        opacity={dimmed ? 0.4 : 1}
      >
        {node.titleLines.map((line, index) => (
          <tspan
            key={`${node.id}-title-${index}`}
            x={12}
            dy={index === 0 ? 0 : EXECUTION_NETWORK_NODE_TITLE_LINE_HEIGHT}
          >
            {line}
          </tspan>
        ))}
      </text>
      {node.subtitle ? (
        <text x={12} y={subtitleY} className="fill-zinc-500 text-[10px]" pointerEvents="none">
          {node.subtitle}
        </text>
      ) : null}
      {node.badge ? (
        <>
          <rect
            x={node.width - 54}
            y={6}
            width={48}
            height={16}
            rx={8}
            fill={isProgram ? "#ccfbf1" : isAnnualTarget ? "#f1f5f9" : "#f4f4f5"}
            stroke={isProgram ? "#0d9488" : "#94a3b8"}
            strokeWidth={0.75}
            pointerEvents="none"
          />
          <text
            x={node.width - 30}
            y={17}
            textAnchor="middle"
            className={`text-[9px] font-semibold ${isProgram ? "fill-teal-900" : "fill-zinc-600"}`}
            pointerEvents="none"
          >
            {node.badge.length > 8 ? `${node.badge.slice(0, 7)}…` : node.badge}
          </text>
        </>
      ) : null}
    </g>
  );
}
