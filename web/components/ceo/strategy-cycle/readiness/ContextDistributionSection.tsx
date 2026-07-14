"use client";

import type {
  ContextDistributions,
  DesignReadinessFocus,
} from "@/lib/strategy-cycle/design-readiness-snapshot";
import { DonutDistributionChart } from "./DonutDistributionChart";

type Props = {
  focus: DesignReadinessFocus;
  contextDistributions: ContextDistributions;
};

function focusLabel(focus: DesignReadinessFocus): string {
  return focus === "challenges" ? "Herausforderungen" : "Stoßrichtungen";
}

function dominantHint(
  focus: DesignReadinessFocus,
  industries: ContextDistributions["challengesFocus"]["industries"],
  businessModels: ContextDistributions["challengesFocus"]["businessModels"]
): string | null {
  const parts: string[] = [];
  const topIndustry = industries.items.find((i) => i.totalCount > 0);
  const topBm = businessModels.items.find((i) => i.totalCount > 0);

  if (topIndustry) {
    const inactiveShare =
      topIndustry.totalCount > 0
        ? Math.round((topIndustry.inactiveCount / topIndustry.totalCount) * 100)
        : 0;
    if (inactiveShare >= 40) {
      parts.push(
        `${topIndustry.label} dominiert bei Industrien, aber ein Teil ist noch nicht aktiv.`
      );
    } else if (topIndustry.activeCount > 0) {
      parts.push(`${topIndustry.label} ist der stärkste Industrie-Schwerpunkt.`);
    }
  }

  if (topBm && topBm.id !== topIndustry?.id) {
    const inactiveShare =
      topBm.totalCount > 0 ? Math.round((topBm.inactiveCount / topBm.totalCount) * 100) : 0;
    if (inactiveShare >= 40) {
      parts.push(
        `${topBm.label} dominiert bei Geschäftsmodellen, aber ein Teil ist noch nicht wirksam.`
      );
    }
  }

  if (parts.length === 0 && industries.totalAssignments + businessModels.totalAssignments > 0) {
    return focus === "challenges"
      ? "Schwerpunkte zeigen, wo Herausforderungen kontextuell gebündelt sind — unabhängig von der Dimensionsabdeckung oben."
      : "Schwerpunkte zeigen, wo Stoßrichtungen kontextuell gebündelt sind — unabhängig von der Dimensionsabdeckung oben.";
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

export function ContextDistributionSection({ focus, contextDistributions }: Props) {
  const data =
    focus === "challenges"
      ? contextDistributions.challengesFocus
      : contextDistributions.directionsFocus;

  const hint = dominantHint(focus, data.industries, data.businessModels);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-zinc-900">
          Kontext-Schwerpunkte im aktuellen Fokus: {focusLabel(focus)}
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          Dunkel = aktiv / wirksam, hell = nicht aktiv. Mehrfachzuordnungen möglich.
        </p>
        {hint ? <p className="mt-1 text-[11px] text-zinc-700">{hint}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <DonutDistributionChart title="Industrien" group={data.industries} />
        <DonutDistributionChart title="Geschäftsmodelle" group={data.businessModels} />
      </div>
    </section>
  );
}
