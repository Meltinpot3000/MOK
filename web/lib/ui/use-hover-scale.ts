"use client";

import { useState, type CSSProperties } from "react";

const BASE_TRANSITION: CSSProperties = {
  transformOrigin: "center",
  transition: "transform 0.2s ease-out, box-shadow 0.2s ease-out",
};

export type HoverScaleOptions = {
  scale?: number;
  translateY?: number;
  disabled?: boolean;
};

/** Hover-Vergrößerung per State + inline transform (gleiches Prinzip wie Zykluskreise). */
export function useHoverScale(options: HoverScaleOptions = {}) {
  const { scale = 1.03, translateY = -2, disabled = false } = options;
  const [hovered, setHovered] = useState(false);

  const style: CSSProperties = {
    ...BASE_TRANSITION,
    transform:
      hovered && !disabled
        ? `scale(${scale}) translateY(${translateY}px)`
        : "scale(1) translateY(0)",
  };

  return {
    hovered,
    onMouseEnter: () => {
      if (!disabled) setHovered(true);
    },
    onMouseLeave: () => setHovered(false),
    style,
  };
}
