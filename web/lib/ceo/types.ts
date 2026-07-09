/**
 * Reine Typen für Client-Komponenten — nicht aus @/lib/ceo/queries importieren
 * (dort liegt Server-Code; Turbopack kann sonst „module factory is not available“ werfen).
 */

import type { KpiCard } from "@/lib/ceo/kpis";
import type { OkrProgressPlanBucket } from "@/lib/okr/okr-progress-plan-bucket";

export type PlanningCycle = {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  level_no?: number;
  cycle_scheme_id?: string;
  cycle_scheme_name?: string;
  is_active_scheme?: boolean;
  legacy_planning_cycle_id?: string | null;
};

export type TenantBranding = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  status: "draft" | "published";
  branding_config?: Record<string, unknown> | null;
};

export type OkrObjectiveKpiRow = {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
};

export type OkrProgressPlanItem = {
  id: string;
  title: string;
  progressPercent: number;
  expectedProgressPercent: number;
  ownerDisplayName: string | null;
  bucket: OkrProgressPlanBucket;
};

export type CeoOverallProgressDetail = {
  cycleStart: string;
  cycleEnd: string;
  expectedProgressPercent: number;
  buckets: Record<OkrProgressPlanBucket, OkrProgressPlanItem[]>;
  okrCycleId: string | null;
};

export type KeyResult = {
  id: string;
  title: string;
  status: string;
  objective_id: string;
};

export type CeoAccessContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  membershipId: string;
  roleCodes: string[];
};

export type CyclePulseLevelSnapshot = {
  timeProgressPercent: number;
  contentProgressPercent: number | null;
  deltaPp: number | null;
  contentHint: string;
};

export type CyclePulseSnapshots = {
  review: CyclePulseLevelSnapshot | null;
  okr: CyclePulseLevelSnapshot | null;
};

export type CeoDashboardData = {
  cycles: PlanningCycle[];
  selectedCycle: PlanningCycle | null;
  previousCycle: PlanningCycle | null;
  objectives: OkrObjectiveKpiRow[];
  keyResults: KeyResult[];
  kpis: KpiCard[];
  overallProgressDetail: CeoOverallProgressDetail | null;
  cyclePulse: CyclePulseSnapshots;
};
