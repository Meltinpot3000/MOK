"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";

const TIME_ARC_COLOR = "#94a3b8";

const CYCLE_LINKS = {
  strategy: "/strategy-cycle",
  review: "/reviews",
  okr: "/okr/dashboard",
} as const;

type RingKey = keyof typeof CYCLE_LINKS;

function buildFullRingStyle(progressPercent: number, arcColor: string, trackMixPercent = 20): CSSProperties {
  const progress = Math.round(progressPercent);
  return {
    backgroundImage: `conic-gradient(from -90deg, ${arcColor} 0deg ${progress * 3.6}deg, color-mix(in srgb, ${arcColor} ${trackMixPercent}%, white) ${progress * 3.6}deg 360deg)`,
  };
}

function CyclePulseRingLink({
  ring,
  href,
  label,
  className,
  zBase,
  isHovered,
  isDimmed,
  onHover,
  children,
}: {
  ring: RingKey;
  href: string;
  label: string;
  className?: string;
  zBase: number;
  isHovered: boolean;
  isDimmed: boolean;
  onHover: (ring: RingKey | null) => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      onMouseEnter={() => onHover(ring)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(ring)}
      onBlur={() => onHover(null)}
      className={`relative block shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${className ?? ""} ${
        isHovered
          ? "shadow-2xl ring-4 ring-indigo-400/45"
          : isDimmed
            ? "opacity-75 shadow-md"
            : "shadow-lg"
      }`}
      style={{
        zIndex: isHovered ? 50 : zBase,
        transformOrigin: "center",
        transition: "transform 0.2s ease-out, box-shadow 0.2s ease-out",
        transform: isHovered ? "scale(1.05) translateY(-2px)" : "scale(1) translateY(0)",
      }}
    >
      {children}
    </Link>
  );
}

export type CyclePulseDiagramProps = {
  strategyTimePercent: number;
  strategyLabel: ReactNode;
  reviewTimePercent: number;
  reviewContentPercent: number | null;
  reviewContentColor: string;
  reviewLabel: ReactNode;
  okrTimePercent: number;
  okrContentPercent: number | null;
  okrContentColor: string;
  okrLabel: ReactNode;
};

function TimeContentRing({
  className,
  outerPadding,
  innerPadding,
  timePercent,
  contentPercent,
  contentColor,
  children,
}: {
  className: string;
  outerPadding: string;
  innerPadding: string;
  timePercent: number;
  contentPercent: number | null;
  contentColor: string;
  children: ReactNode;
}) {
  const hasContent = contentPercent != null;
  return (
    <div
      className={`rounded-full ${className} ${outerPadding}`}
      style={buildFullRingStyle(timePercent, TIME_ARC_COLOR, 28)}
    >
      <div
        className={`h-full w-full rounded-full ${hasContent ? innerPadding : ""}`}
        style={hasContent ? buildFullRingStyle(contentPercent, contentColor, 22) : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function CyclePulseDiagram({
  strategyTimePercent,
  strategyLabel,
  reviewTimePercent,
  reviewContentPercent,
  reviewContentColor,
  reviewLabel,
  okrTimePercent,
  okrContentPercent,
  okrContentColor,
  okrLabel,
}: CyclePulseDiagramProps) {
  const [hovered, setHovered] = useState<RingKey | null>(null);

  const dim = (ring: RingKey) => hovered != null && hovered !== ring;

  return (
    <div className="flex flex-col items-center px-2 py-4">
      <div className="relative mx-auto flex max-w-[980px] items-center justify-center">
        <CyclePulseRingLink
          ring="strategy"
          href={CYCLE_LINKS.strategy}
          label="Zum Strategiezyklus"
          className="-mr-0"
          zBase={10}
          isHovered={hovered === "strategy"}
          isDimmed={dim("strategy")}
          onHover={setHovered}
        >
          <div
            className="h-[320px] w-[320px] rounded-full p-[12px] sm:h-[340px] sm:w-[340px]"
            style={buildFullRingStyle(strategyTimePercent, TIME_ARC_COLOR, 24)}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full text-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, white)" }}
            >
              {strategyLabel}
            </div>
          </div>
        </CyclePulseRingLink>

        <CyclePulseRingLink
          ring="review"
          href={CYCLE_LINKS.review}
          label="Zum Reviewzyklus"
          className="-ml-14 sm:-ml-16"
          zBase={20}
          isHovered={hovered === "review"}
          isDimmed={dim("review")}
          onHover={setHovered}
        >
          <TimeContentRing
            className="h-[240px] w-[240px] sm:h-[255px] sm:w-[255px]"
            outerPadding="p-[11px]"
            innerPadding="p-[9px]"
            timePercent={reviewTimePercent}
            contentPercent={reviewContentPercent}
            contentColor={reviewContentColor}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full text-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--brand-secondary) 10%, white)" }}
            >
              {reviewLabel}
            </div>
          </TimeContentRing>
        </CyclePulseRingLink>

        <CyclePulseRingLink
          ring="okr"
          href={CYCLE_LINKS.okr}
          label="Zum OKR-Zyklus"
          className="-ml-10 sm:-ml-12"
          zBase={30}
          isHovered={hovered === "okr"}
          isDimmed={dim("okr")}
          onHover={setHovered}
        >
          <TimeContentRing
            className="h-[175px] w-[175px] sm:h-[190px] sm:w-[190px]"
            outerPadding="p-[9px]"
            innerPadding="p-[7px]"
            timePercent={okrTimePercent}
            contentPercent={okrContentPercent}
            contentColor={okrContentColor}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full text-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 10%, white)" }}
            >
              {okrLabel}
            </div>
          </TimeContentRing>
        </CyclePulseRingLink>
      </div>
    </div>
  );
}
