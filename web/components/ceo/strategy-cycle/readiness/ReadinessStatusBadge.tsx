"use client";

import type { ReadinessBand, ReadinessStatus } from "@/lib/strategy-cycle/design-readiness-snapshot";
import {
  bandBadgeClass,
  readinessBandLabelDe,
  readinessStatusLabelDe,
  statusBadgeClass,
} from "./readiness-ui";

const baseClass =
  "inline-flex max-w-full items-center justify-center rounded-full border font-medium leading-tight whitespace-normal text-center";

type StatusBadgeProps = {
  kind: "status";
  value: ReadinessStatus;
  compact?: boolean;
  className?: string;
};

type BandBadgeProps = {
  kind: "band";
  value: ReadinessBand;
  compact?: boolean;
  className?: string;
};

export function ReadinessStatusBadge(props: StatusBadgeProps | BandBadgeProps) {
  const compact = props.compact ?? false;
  const size = compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";

  const label =
    props.kind === "status"
      ? readinessStatusLabelDe(props.value)
      : readinessBandLabelDe(props.value);

  const color =
    props.kind === "status"
      ? statusBadgeClass(props.value)
      : bandBadgeClass(props.value);

  return (
    <span className={`${baseClass} ${size} ${color} ${props.className ?? ""}`}>{label}</span>
  );
}
