import type { AnnualTargetSmartCheck } from "@/lib/annual-targets/types";

export function parseAnnualTargetSmartCheck(raw: unknown): AnnualTargetSmartCheck | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const keys = ["specific", "measurable", "achievable", "relevant", "time_bound"] as const;
  if (!keys.every((k) => typeof o[k] === "boolean")) return null;
  return {
    specific: o.specific as boolean,
    measurable: o.measurable as boolean,
    achievable: o.achievable as boolean,
    relevant: o.relevant as boolean,
    time_bound: o.time_bound as boolean,
  };
}

export function smartDimensionMark(ok: boolean | undefined): string {
  if (ok === true) return "✓";
  if (ok === false) return "—";
  return "·";
}
