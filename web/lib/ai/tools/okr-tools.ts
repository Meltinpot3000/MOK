import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import {
  getDefaultOkrCycleInstanceId,
  getKeyResultsForObjectives,
  getOkrCycles,
} from "@/lib/okr/queries";
import { pickDefaultOkrCycle } from "@/lib/okr/pick-default-okr-cycle";
import {
  OKR_LINEAR_AT_RISK_GAP_PP,
  OKR_LINEAR_OFF_TRACK_GAP_PP,
  OKR_STALE_CHECKIN_DAYS,
} from "@/lib/okr/okr-cycle-view-model";

import type { AiContextSource } from "@/lib/ai/types";
import type { AiToolDefinition, AiToolExecuteArgs, AiToolResult } from "./types";

const cycleInputSchema = z.object({
  cycleInstanceId: z.string().uuid().optional(),
});

async function resolveCycleInstanceId(args: {
  explicitCycleInstanceId?: string | null;
  uiCycleId?: string | null;
  organizationId: string;
  supabase?: SupabaseClient;
}): Promise<string | null> {
  if (args.explicitCycleInstanceId) return args.explicitCycleInstanceId;
  if (args.uiCycleId) return args.uiCycleId;
  const defaultFromSession = await getDefaultOkrCycleInstanceId(
    args.organizationId,
    args.supabase
  );
  if (defaultFromSession) return defaultFromSession;
  if (!args.supabase) return null;
  const { data } = await args.supabase
    .schema("app")
    .from("okr_cycles")
    .select("cycle_instance_id")
    .eq("organization_id", args.organizationId)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.cycle_instance_id as string | null | undefined) ?? null;
}

export const getCurrentOkrCycleTool: AiToolDefinition<typeof cycleInputSchema> = {
  name: "get_current_okr_cycle",
  description:
    "Liefert die OKR-Zyklen der Organisation (mit Default-Auswahl: aktiver Quartalszyklus oder naechster).",
  domain: "okr",
  mode: "read",
  requiredCapabilities: ["nav.okr-workspace.read", "okr.read"],
  inputSchema: cycleInputSchema,
  inputSchemaHint: "{ cycleInstanceId?: uuid }",
  dataClassification: "internal",
  async execute({
    userContext,
    uiContext,
    input,
    supabase,
  }: AiToolExecuteArgs<unknown>): Promise<AiToolResult> {
    const parsed = cycleInputSchema.parse(input);
    const cycleInstanceId = await resolveCycleInstanceId({
      explicitCycleInstanceId: parsed.cycleInstanceId ?? null,
      uiCycleId: uiContext?.cycleId ?? null,
      organizationId: userContext.organizationId,
      supabase,
    });
    if (!cycleInstanceId) {
      return {
        toolName: "get_current_okr_cycle",
        success: false,
        data: null,
        outputSummary:
          "Kein cycleInstanceId verfuegbar (weder Input/UI noch ableitbarer Default-Zyklus).",
        error: "missing_cycle_instance_id",
      };
    }
    const cycles = await getOkrCycles(userContext.organizationId, cycleInstanceId, supabase);
    const cyclesForPick = cycles.map((c) => ({
      id: c.id,
      start_date: c.start_date,
      end_date: c.end_date,
      status: c.status,
    }));
    const defaultId = pickDefaultOkrCycle(cyclesForPick);
    const data = {
      cycleInstanceId,
      defaultOkrCycleId: defaultId,
      okrCycles: cycles.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        startDate: c.start_date,
        endDate: c.end_date,
        status: c.status,
        isDefault: c.id === defaultId,
      })),
    };
    return {
      toolName: "get_current_okr_cycle",
      success: true,
      data,
      outputSummary: `${cycles.length} OKR-Zyklen geladen; Default: ${defaultId ?? "(kein)"}.`,
      contextSources: cycles.map(
        (c): AiContextSource => ({
          sourceType: "okr_cycle",
          sourceId: c.id,
          sourceTitle: c.name,
          classification: "internal",
          relevanceScore: c.id === defaultId ? 1.0 : 0.4,
          sourceReason: c.id === defaultId ? "Default-Zyklus" : "Verfuegbarer Zyklus",
        })
      ),
    };
  },
};

const objectivesInputSchema = z.object({
  cycleInstanceId: z.string().uuid().optional(),
  preferredOkrCycleId: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const ownerCountsInputSchema = z.object({
  cycleInstanceId: z.string().uuid().optional(),
  cycle: z.enum(["current"]).optional(),
  organizationScope: z.enum(["visible", "own", "team"]).optional(),
  preferredOkrCycleId: z.string().uuid().nullable().optional(),
  limitOwners: z.number().int().min(1).max(50).optional(),
});

export const getOkrObjectiveOwnerCountsTool: AiToolDefinition<typeof ownerCountsInputSchema> = {
  name: "get_okr_objective_owner_counts",
  description:
    "Zaehlt sichtbare OKR-Objectives pro Owner im (aktuellen) Zyklus und liefert ein Ranking.",
  domain: "okr",
  mode: "read",
  requiredCapabilities: ["nav.okr-workspace.read"],
  inputSchema: ownerCountsInputSchema,
  inputSchemaHint:
    "{ cycleInstanceId?: uuid, cycle?: 'current', organizationScope?: 'visible'|'own'|'team', preferredOkrCycleId?: uuid|null, limitOwners?: number }",
  dataClassification: "internal",
  async execute({ userContext, uiContext, input, supabase }: AiToolExecuteArgs<unknown>): Promise<AiToolResult> {
    const parsed = ownerCountsInputSchema.parse(input);
    const cycleInstanceId = await resolveCycleInstanceId({
      explicitCycleInstanceId: parsed.cycleInstanceId ?? null,
      uiCycleId: uiContext?.cycleId ?? null,
      organizationId: userContext.organizationId,
      supabase,
    });
    if (!cycleInstanceId) {
      return {
        toolName: "get_okr_objective_owner_counts",
        success: false,
        data: null,
        outputSummary: "Kein cycleInstanceId verfuegbar (weder Input/UI noch Default).",
        error: "missing_cycle_instance_id",
      };
    }

    const ctx = await getOkrCycleContext(
      userContext.organizationId,
      cycleInstanceId,
      parsed.preferredOkrCycleId ?? null,
      supabase
    );

    const selectedCycle =
      ctx.workspace.selectedOkrCycleId != null
        ? ctx.workspace.okrCycles.find((c) => c.id === ctx.workspace.selectedOkrCycleId) ?? null
        : null;
    const cycleLabel =
      selectedCycle?.name ??
      selectedCycle?.code ??
      (selectedCycle?.start_date && selectedCycle?.end_date
        ? `${selectedCycle.start_date} - ${selectedCycle.end_date}`
        : `cycle:${cycleInstanceId.slice(0, 8)}`);

    const statsByOwner = new Map<
      string,
      {
        ownerMembershipId: string | null;
        ownerDisplayName: string;
        objectiveCount: number;
        objectiveIds: string[];
        objectiveTitles: string[];
      }
    >();
    for (const view of ctx.objectiveViews) {
      const ownerId = view.objective.ownerMembershipId ?? "unassigned";
      const existing = statsByOwner.get(ownerId) ?? {
        ownerMembershipId: view.objective.ownerMembershipId ?? null,
        ownerDisplayName:
          view.objective.ownerDisplayName ??
          (view.objective.ownerMembershipId ? "Person ohne Namen" : "Nicht zugewiesen"),
        objectiveCount: 0,
        objectiveIds: [],
        objectiveTitles: [],
      };
      existing.objectiveCount += 1;
      existing.objectiveIds.push(view.objective.id);
      existing.objectiveTitles.push(view.objective.title);
      statsByOwner.set(ownerId, existing);
    }
    const limitOwners = parsed.limitOwners ?? 10;
    const rawRanking = [...statsByOwner.entries()]
      .map(([ownerMembershipId, stat]) => ({
        id: ownerMembershipId,
        ownerMembershipId: stat.ownerMembershipId,
        ownerDisplayName: stat.ownerDisplayName,
        objectiveCount: stat.objectiveCount,
        objectiveIds: stat.objectiveIds,
        objectiveTitles: stat.objectiveTitles,
      }))
      .sort(
        (a, b) =>
          b.objectiveCount - a.objectiveCount ||
          (a.ownerMembershipId ?? "").localeCompare(b.ownerMembershipId ?? "")
      )
      .slice(0, limitOwners);

    const topCount = rawRanking[0]?.objectiveCount ?? 0;
    const ownerRanking = rawRanking.map((row, index) => ({
      ...row,
      rank: index + 1,
      topObjectiveCount: topCount,
      noData: false,
    }));
    const ownerRankingWithNoData =
      ownerRanking.length > 0
        ? ownerRanking
        : [
            {
              id: "__none__",
              ownerMembershipId: null,
              ownerDisplayName: "Keine Ownerdaten im aktuellen Zyklus",
              objectiveCount: 0,
              objectiveIds: [],
              objectiveTitles: [],
              rank: 0,
              topObjectiveCount: 0,
              noData: true,
            },
          ];
    const topOwners = ownerRanking
      .filter((r) => r.objectiveCount === topCount && topCount > 0)
      .map((r) => r.ownerMembershipId);

    return {
      toolName: "get_okr_objective_owner_counts",
      success: true,
      data: {
        cycleInstanceId,
        cycleLabel,
        totalObjectives: ctx.objectiveViews.length,
        ownerCount: ownerRanking.length,
        topObjectiveCount: topCount,
        topOwnerMembershipIds: topOwners,
        ownerRanking: ownerRankingWithNoData,
      },
      outputSummary:
        ctx.objectiveViews.length === 0
          ? "Im aktuellen Zyklus sind keine sichtbaren Objectives vorhanden."
          : `Owner-Ranking erstellt: ${ownerRanking.length} Owner, Top=${topCount} Objective(s).`,
      contextSources: ownerRankingWithNoData.map(
        (row): AiContextSource => ({
          sourceType: "okr_owner_stats",
          sourceId: row.id,
          sourceTitle:
            row.ownerMembershipId === "unassigned"
              ? "Nicht zugewiesen"
              : row.ownerMembershipId ?? "Keine Ownerdaten im aktuellen Zyklus",
          classification: "internal",
          relevanceScore: topCount > 0 ? row.objectiveCount / topCount : 1.0,
          sourceReason: row.noData ? "0 sichtbare Objectives im aktuellen Zyklus" : `${row.objectiveCount} Objective(s)`,
        })
      ),
    };
  },
};

export const getVisibleOkrObjectivesTool: AiToolDefinition<typeof objectivesInputSchema> = {
  name: "get_visible_okr_objectives",
  description:
    "Listet sichtbare OKR-Objectives mit Rollup-Status, Fortschritt, Owner und KR-Anzahl. Wrapper um getOkrCycleContext.",
  domain: "okr",
  mode: "read",
  requiredCapabilities: ["nav.okr-workspace.read"],
  inputSchema: objectivesInputSchema,
  inputSchemaHint:
    "{ cycleInstanceId?: uuid, preferredOkrCycleId?: uuid|null, limit?: number }",
  dataClassification: "internal",
  maxResults: 30,
  async execute({
    userContext,
    uiContext,
    input,
    supabase,
  }: AiToolExecuteArgs<unknown>): Promise<AiToolResult> {
    const parsed = objectivesInputSchema.parse(input);
    const cycleInstanceId = await resolveCycleInstanceId({
      explicitCycleInstanceId: parsed.cycleInstanceId ?? null,
      uiCycleId: uiContext?.cycleId ?? null,
      organizationId: userContext.organizationId,
      supabase,
    });
    if (!cycleInstanceId) {
      return {
        toolName: "get_visible_okr_objectives",
        success: false,
        data: null,
        outputSummary: "Kein cycleInstanceId verfuegbar (weder Input/UI noch Default).",
        error: "missing_cycle_instance_id",
      };
    }
    const ctx = await getOkrCycleContext(
      userContext.organizationId,
      cycleInstanceId,
      parsed.preferredOkrCycleId ?? null,
      supabase
    );
    const limit = parsed.limit ?? 30;
    const objectives = ctx.objectiveViews.slice(0, limit).map((view) => ({
      id: view.objective.id,
      title: view.objective.title,
      status: view.objective.status,
      ownerMembershipId: view.objective.ownerMembershipId,
      rollupProgressPercent: view.rollupProgressPercent,
      rollupStatus: view.rollupStatus,
      keyResultCount: view.keyResults.length,
      warnings: view.warnings,
      lastActivityAt: view.lastActivityAt,
    }));
    return {
      toolName: "get_visible_okr_objectives",
      success: true,
      data: {
        cycleInstanceId,
        kpis: ctx.kpis,
        totalObjectives: ctx.objectiveViews.length,
        objectives,
      },
      outputSummary: `${ctx.objectiveViews.length} Objectives sichtbar (KPIs: total=${ctx.kpis.objectiveCount}, kritisch=${ctx.kpis.criticalCount}).`,
      contextSources: objectives.map(
        (o): AiContextSource => ({
          sourceType: "okr_objective",
          sourceId: o.id,
          sourceTitle: o.title,
          classification: "internal",
          relevanceScore:
            o.rollupStatus === "off_track" ? 0.95 : o.rollupStatus === "at_risk" ? 0.8 : 0.5,
          sourceReason: `Status=${o.rollupStatus}, Progress=${Math.round(o.rollupProgressPercent)}%`,
        })
      ),
    };
  },
};

const krInputSchema = z.object({
  okrObjectiveIds: z.array(z.string().uuid()).min(1).max(50),
});

export const getKeyResultsForObjectivesTool: AiToolDefinition<typeof krInputSchema> = {
  name: "get_key_results_for_objectives",
  description:
    "Liefert Key Results fuer eine Liste von OKR-Objective-IDs (mit Status, Metrik, Zielwerten).",
  domain: "okr",
  mode: "read",
  requiredCapabilities: ["nav.okr-workspace.read"],
  inputSchema: krInputSchema,
  inputSchemaHint: "{ okrObjectiveIds: uuid[] (1-50) }",
  dataClassification: "internal",
  async execute({ userContext, input }: AiToolExecuteArgs<unknown>): Promise<AiToolResult> {
    const parsed = krInputSchema.parse(input);
    const krs = await getKeyResultsForObjectives(
      userContext.organizationId,
      parsed.okrObjectiveIds
    );
    const data = {
      objectiveIds: parsed.okrObjectiveIds,
      keyResults: krs.map((k) => ({
        id: k.id,
        objectiveId: k.okr_objective_id,
        title: k.title,
        status: k.status,
        metricType: k.metric_type,
        startValue: k.start_value,
        targetValue: k.target_value,
        currentValue: k.current_value,
        unit: k.measurement_unit,
      })),
    };
    return {
      toolName: "get_key_results_for_objectives",
      success: true,
      data,
      outputSummary: `${krs.length} Key Results fuer ${parsed.okrObjectiveIds.length} Objectives.`,
      contextSources: data.keyResults.map(
        (k): AiContextSource => ({
          sourceType: "key_result",
          sourceId: k.id,
          sourceTitle: k.title,
          classification: "internal",
          relevanceScore: 0.6,
          sourceReason: `Status=${k.status}`,
        })
      ),
    };
  },
};

// ---------------------------------------------------------------------------
// calculate_okr_risk_signals — DETERMINISTIC pure logic, KEIN LLM-Aufruf.
// Die Regeln sind oben dokumentiert (Plan §6, calculate_okr_risk_signals).
// ---------------------------------------------------------------------------

const riskInputSchema = z.object({
  cycleInstanceId: z.string().uuid().optional(),
  preferredOkrCycleId: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type OkrRiskSignal = {
  objectiveId: string;
  objectiveTitle: string;
  rollupStatus: "on_track" | "at_risk" | "off_track";
  rollupProgressPercent: number;
  riskScore: number;
  reasons: string[];
  staleCheckIn: boolean;
  blockedKeyResultCount: number;
  atRiskKeyResultCount: number;
};

function classifyKrStatus(status: string | null | undefined): "blocked" | "at_risk" | "ok" {
  if (status === "blocked") return "blocked";
  if (status === "at_risk") return "at_risk";
  return "ok";
}

function isStale(isoDate: string | null | undefined, nowMs: number): boolean {
  if (!isoDate) return true;
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return true;
  const ageMs = nowMs - parsed;
  return ageMs > OKR_STALE_CHECKIN_DAYS * 24 * 60 * 60 * 1000;
}

export function computeOkrRiskSignalsFromContext(
  ctx: { objectiveViews: Array<{
    objective: { id: string; title: string; status?: string | null };
    keyResults: Array<{ keyResult: { status?: string | null }; lastCheckInAt: string | null; reviewStatus: "on_track" | "at_risk" | "off_track" }>;
    rollupProgressPercent: number;
    rollupStatus: "on_track" | "at_risk" | "off_track";
    lastActivityAt: string | null;
    warnings: string[];
  }> },
  options?: { limit?: number; nowMs?: number }
): OkrRiskSignal[] {
  const nowMs = options?.nowMs ?? Date.now();
  const limit = options?.limit ?? 20;
  const signals: OkrRiskSignal[] = [];

  for (const view of ctx.objectiveViews) {
    const reasons: string[] = [];
    const blockedKeyResultCount = view.keyResults.filter(
      (kr) => classifyKrStatus(kr.keyResult.status) === "blocked"
    ).length;
    const atRiskKeyResultCount = view.keyResults.filter(
      (kr) => classifyKrStatus(kr.keyResult.status) === "at_risk" || kr.reviewStatus !== "on_track"
    ).length;
    const stale = isStale(view.lastActivityAt, nowMs);

    let riskScore = 0;
    if (view.rollupStatus === "off_track") {
      riskScore += 0.5;
      reasons.push(`rollupStatus=off_track (Rueckstand > ${OKR_LINEAR_OFF_TRACK_GAP_PP}pp)`);
    } else if (view.rollupStatus === "at_risk") {
      riskScore += 0.3;
      reasons.push(`rollupStatus=at_risk (Rueckstand > ${OKR_LINEAR_AT_RISK_GAP_PP}pp)`);
    }
    if (blockedKeyResultCount > 0) {
      riskScore += 0.2 * Math.min(blockedKeyResultCount, 3);
      reasons.push(`${blockedKeyResultCount} Key Result(s) im Status 'blocked'`);
    }
    if (atRiskKeyResultCount > 0) {
      riskScore += 0.1 * Math.min(atRiskKeyResultCount, 5);
      reasons.push(`${atRiskKeyResultCount} Key Result(s) at_risk/off_track`);
    }
    if (stale) {
      riskScore += 0.15;
      reasons.push(`Kein Check-in oder Aktivitaet in den letzten ${OKR_STALE_CHECKIN_DAYS} Tagen`);
    }
    if (view.warnings.length > 0) {
      riskScore += 0.05 * view.warnings.length;
      reasons.push(`Warnungen: ${view.warnings.join(", ")}`);
    }

    if (riskScore <= 0) continue;

    signals.push({
      objectiveId: view.objective.id,
      objectiveTitle: view.objective.title,
      rollupStatus: view.rollupStatus,
      rollupProgressPercent: Math.round(view.rollupProgressPercent),
      riskScore: Math.round(Math.min(1, riskScore) * 100) / 100,
      reasons,
      staleCheckIn: stale,
      blockedKeyResultCount,
      atRiskKeyResultCount,
    });
  }

  signals.sort((a, b) => b.riskScore - a.riskScore || a.objectiveTitle.localeCompare(b.objectiveTitle));
  return signals.slice(0, limit);
}

export const calculateOkrRiskSignalsTool: AiToolDefinition<typeof riskInputSchema> = {
  name: "calculate_okr_risk_signals",
  description:
    "Deterministische Risikoanalyse fuer OKRs (Status, Stale Check-ins, blockierte/at-risk KRs, Warnungen). Liefert priorisierte Liste.",
  domain: "okr",
  mode: "read",
  requiredCapabilities: ["nav.okr-workspace.read"],
  inputSchema: riskInputSchema,
  inputSchemaHint:
    "{ cycleInstanceId?: uuid, preferredOkrCycleId?: uuid|null, limit?: number }",
  dataClassification: "internal",
  dependsOnTools: [],
  async execute({
    userContext,
    uiContext,
    input,
    supabase,
  }: AiToolExecuteArgs<unknown>): Promise<AiToolResult> {
    const parsed = riskInputSchema.parse(input);
    const cycleInstanceId = await resolveCycleInstanceId({
      explicitCycleInstanceId: parsed.cycleInstanceId ?? null,
      uiCycleId: uiContext?.cycleId ?? null,
      organizationId: userContext.organizationId,
      supabase,
    });
    if (!cycleInstanceId) {
      return {
        toolName: "calculate_okr_risk_signals",
        success: false,
        data: null,
        outputSummary: "Kein cycleInstanceId verfuegbar (weder Input/UI noch Default).",
        error: "missing_cycle_instance_id",
      };
    }
    const ctx = await getOkrCycleContext(
      userContext.organizationId,
      cycleInstanceId,
      parsed.preferredOkrCycleId ?? null,
      supabase
    );
    const signals = computeOkrRiskSignalsFromContext(ctx, { limit: parsed.limit ?? 10 });
    return {
      toolName: "calculate_okr_risk_signals",
      success: true,
      data: {
        cycleInstanceId,
        signalCount: signals.length,
        signals,
      },
      outputSummary: `${signals.length} OKR-Risikosignale (deterministisch berechnet).`,
      contextSources: signals.map(
        (s): AiContextSource => ({
          sourceType: "okr_objective",
          sourceId: s.objectiveId,
          sourceTitle: s.objectiveTitle,
          classification: "internal",
          relevanceScore: s.riskScore,
          sourceReason: s.reasons[0] ?? "Risikosignal",
        })
      ),
    };
  },
};
