import type { ReactNode } from "react";

export type SentinelStatusBannerVariant = "sky" | "amber" | "emerald" | "zinc";

const VARIANT_CLASS: Record<SentinelStatusBannerVariant, string> = {
  sky: "border-sky-300 bg-sky-50 text-sky-900",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800",
  zinc: "border-zinc-200 bg-zinc-50 text-zinc-600",
};

type Props = {
  variant?: SentinelStatusBannerVariant;
  children: ReactNode;
  className?: string;
  role?: "status" | "alert";
  "aria-live"?: "polite" | "assertive" | "off";
};

export function SentinelStatusBanner({
  variant = "sky",
  children,
  className = "",
  role,
  "aria-live": ariaLive,
}: Props) {
  return (
    <p
      role={role}
      aria-live={ariaLive}
      className={`rounded-md border p-3 text-sm ${VARIANT_CLASS[variant]} ${className}`.trim()}
    >
      {children}
    </p>
  );
}
