"use client";

import dynamic from "next/dynamic";
import type { StrategyCycleOverviewProps } from "./StrategyCycleOverview";

const StrategyCycleOverviewClient = dynamic(
  () => import("./StrategyCycleOverview").then((m) => m.StrategyCycleOverview),
  {
    ssr: false,
    loading: () => (
      <div className="brand-card p-6">
        <p className="text-sm text-zinc-600">Wird geladen …</p>
      </div>
    ),
  }
);

export function StrategyCycleOverviewLoader(props: StrategyCycleOverviewProps) {
  return <StrategyCycleOverviewClient {...props} />;
}
