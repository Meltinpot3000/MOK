import type { AssistantUiContext, AiUserContext } from "@/lib/ai/types";
import type { SentinelPlan, SentinelToolPlanItem } from "./schemas";

import {
  callSentinelPlanMode,
  type SentinelPlanCallResult,
} from "./client";
import {
  buildPlanModeSystemPrompt,
  buildPlanModeUserPrompt,
  type RecentMessageForPrompt,
  type ToolDescriptionForPrompt,
} from "./prompts";
import { SENTINEL_PLAN_SCHEMA_NAME } from "./schemas";

export type PlanModeRunArgs = {
  question: string;
  uiContext?: AssistantUiContext | null;
  userContext: AiUserContext;
  recentMessages: RecentMessageForPrompt[];
  tools: ToolDescriptionForPrompt[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: string;
};

function hasTool(tools: ToolDescriptionForPrompt[], toolName: string): boolean {
  return tools.some((t) => t.name === toolName);
}

function enforceQuestionSpecificPlan(rawPlan: SentinelPlan, question: string): SentinelPlan {
  const q = question.toLowerCase();
  const compareCycles =
    /(vergleich|vergleiche|compare)/.test(q) && /(aktuell|aktuellen)/.test(q) && /(vorherig|letzte)/.test(q);
  if (compareCycles) {
    return {
      ...rawPlan,
      taskType: "internal_analysis",
      domains: ["okr"],
      domainCandidates: ["okr"],
      queryClass: "composite",
      targetEntity: "okr_objective",
      metric: "count",
      groupBy: "owner",
      analysisOps: ["rank", "compare_periods", "count_total"],
      scope: {
        ...rawPlan.scope,
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
      },
    };
  }
  if (/(top-?\d|top\s*\d|top)/.test(q) && /(anteil|share|gesamtbestand)/.test(q)) {
    return {
      ...rawPlan,
      taskType: "internal_analysis",
      domains: ["okr"],
      domainCandidates: ["okr"],
      queryClass: "composite",
      targetEntity: "okr_objective",
      metric: "share",
      groupBy: "owner",
      analysisOps: ["rank", "share", "count_total"],
      scope: {
        ...rawPlan.scope,
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
      },
    };
  }
  if (/(ohne|kein|keine|keinen)/.test(q) && /owner/.test(q) && /(kr|key result|exist|existenz)/.test(q)) {
    return {
      ...rawPlan,
      taskType: "internal_lookup",
      domains: ["okr"],
      domainCandidates: ["okr"],
      queryClass: "composite",
      targetEntity: "okr_objective",
      metric: "none",
      groupBy: null,
      analysisOps: ["lookup", "exists", "join"],
      scope: {
        ...rawPlan.scope,
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective_without_owner",
      },
    };
  }
  const asksNestedDistribution =
    (/okrs?/.test(q) && /status/.test(q) && (/verteil/.test(q) || /owner/.test(q))) ||
    (/statusmix/.test(q) && /(owner|top-?owner|verantwort)/.test(q)) ||
    (/zyklus/.test(q) && /owner/.test(q) && /status/.test(q) && /(gleichzeitig|mix)/.test(q));
  if (asksNestedDistribution) {
    return {
      ...rawPlan,
      taskType: "internal_analysis",
      domains: ["okr"],
      domainCandidates: ["okr"],
      queryClass: "composite",
      targetEntity: "okr_objective",
      metric: "share",
      groupBy: "owner",
      scope: {
        ...rawPlan.scope,
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
      },
      analysisOps: ["nested_distribution", "distribution", "rank"],
    };
  }
  if (/(initiative|initiativen)/.test(q) && /(keine|kein|ohne)/.test(q) && /(kr|key result)/.test(q)) {
    return {
      ...rawPlan,
      taskType: "internal_analysis",
      domains: ["okr", "initiative"],
      domainCandidates: ["initiative", "okr"],
      queryClass: "composite",
      targetEntity: "initiative",
      metric: "count",
      groupBy: null,
      analysisOps: ["coverage", "exists", "join"],
      scope: {
        ...rawPlan.scope,
        cycle: "current",
        organizationScope: "visible",
        objectType: "initiative",
      },
    };
  }
  if (/(widerspr|anomal)/.test(q) && /objective|okr/.test(q)) {
    return {
      ...rawPlan,
      taskType: "internal_analysis",
      domains: ["okr"],
      domainCandidates: ["okr"],
      queryClass: "composite",
      targetEntity: "okr_objective",
      metric: "count",
      groupBy: null,
      analysisOps: ["anomaly_check", "lookup"],
      scope: {
        ...rawPlan.scope,
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
      },
    };
  }
  if (/(strategisch|strategie|richtung)/.test(q) && /objectives?|okrs?/.test(q)) {
    return {
      ...rawPlan,
      taskType: "internal_analysis",
      domains: ["strategy", "okr"],
      domainCandidates: ["strategy", "okr"],
      queryClass: "composite",
      targetEntity: "strategy",
      metric: "count",
      groupBy: "strategy",
      analysisOps: ["strategy_join", "join", "rank", "count_total"],
      scope: {
        ...rawPlan.scope,
        cycle: "current",
        organizationScope: "visible",
        objectType: "strategy",
      },
    };
  }
  if (/okrs?/.test(q) && /(ohne|kein|keine|keinen)/.test(q) && /(owner|verantwort)/.test(q)) {
    return {
      ...rawPlan,
      taskType: "internal_lookup",
      domains: ["okr"],
      domainCandidates: ["okr"],
      queryClass: "lookup",
      targetEntity: "okr_objective",
      metric: "none",
      groupBy: null,
      scope: {
        ...rawPlan.scope,
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective_without_owner",
      },
      analysisOps: ["lookup"],
    };
  }
  if (/aufgaben|tasks?/.test(q) && /erledigt|abgeschlossen|completed/.test(q)) {
    return {
      ...rawPlan,
      domains: ["task"],
      domainCandidates: ["task"],
      queryClass: "lookup",
      targetEntity: "task_completed",
      scope: {
        ...rawPlan.scope,
        organizationScope: "own",
        objectType: "task_completed",
        timeHorizon: "completed",
      },
      analysisOps: ["lookup"],
    };
  }
  return rawPlan;
}

function buildHeuristicPlan(args: PlanModeRunArgs): SentinelPlan | null {
  const q = args.question.toLowerCase();
  const asksForMostOkr =
    /meisten\s+okrs?/.test(q) || (/wer/.test(q) && /okrs?/.test(q) && /zyklus/.test(q));
  /** «Welche Approval-Aufgaben …»: nicht nur «welche aufgaben»; «habe ich» → \bich\b */
  const asksForMyTasks =
    (/aufgaben|tasks?/.test(q) && /mich|meine|meinen|mir|aktuell|\bich\b/.test(q)) ||
    /welche\s+.*aufgaben/.test(q);
  const asksApprovalTasksCompleted =
    /approval/.test(q) &&
    /aufgaben|tasks?/.test(q) &&
    /erledigt|abgeschlossen/.test(q);
  const asksForOkrCount =
    (/wie\s+viele/.test(q) || /anzahl/.test(q)) && /okrs?/.test(q) && /zyklus/.test(q);
  const asksForOkrDistribution =
    /verteil/.test(q) && /okrs?/.test(q) && /status/.test(q);
  const asksForOkrWithoutOwner =
    /welche\s+okrs?/.test(q) && /ohne/.test(q) && /owner|verantwort/.test(q);

  if (asksForMostOkr) {
    const toolPlan: SentinelToolPlanItem[] = [];
    if (hasTool(args.tools, "get_current_okr_cycle")) {
      toolPlan.push({
        toolName: "get_current_okr_cycle",
        purpose: "Bestimme den relevanten aktuellen OKR-Zyklus.",
        input: {},
        required: true,
      });
    }
    if (hasTool(args.tools, "get_okr_objective_owner_counts")) {
      toolPlan.push({
        toolName: "get_okr_objective_owner_counts",
        purpose: "Bestimme das Owner-Ranking nach Anzahl Objectives im aktuellen Zyklus.",
        input: { limitOwners: 20 },
        required: true,
      });
    }
    if (toolPlan.length === 0) return null;
    return {
      taskType: "internal_analysis",
      confidence: 0.62,
      domains: ["okr"],
      domainCandidates: ["okr"],
      optionalContextDomains: [],
      analysisOps: ["rank", "count_total"],
      queryClass: "ranking",
      targetEntity: "okr_objective",
      metric: "count",
      groupBy: "owner",
      scope: {
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
        objectId: null,
        timeHorizon: null,
      },
      toolPlan,
      answerStrategy: {
        canAnswerLocally: true,
        needsInternalRetrieval: true,
        needsWebSearch: false,
        needsFrontierModel: false,
        reason: "Frage verlangt interne OKR-Daten mit Zaehlung pro Verantwortlichem.",
      },
      safety: {
        sensitiveDataLikely: false,
        requiresRedaction: false,
        writeActionRequested: false,
        requiresHumanApproval: false,
      },
    };
  }

  if (asksApprovalTasksCompleted) {
    if (!hasTool(args.tools, "get_visible_tasks_for_user")) return null;
    return {
      taskType: "internal_lookup",
      confidence: 0.71,
      domains: ["task"],
      domainCandidates: ["task"],
      optionalContextDomains: [],
      analysisOps: ["lookup"],
      queryClass: "lookup",
      targetEntity: "task",
      metric: "none",
      groupBy: null,
      scope: {
        cycle: "current",
        organizationScope: "own",
        objectType: "task",
        objectId: null,
        timeHorizon: null,
      },
      toolPlan: [
        {
          toolName: "get_visible_tasks_for_user",
          purpose: "Lade erledigte Approval-Aufgaben des Users.",
          input: { filter: "completed", taskTypeFilter: "approval", limit: 50 },
          required: true,
        },
      ],
      answerStrategy: {
        canAnswerLocally: true,
        needsInternalRetrieval: true,
        needsWebSearch: false,
        needsFrontierModel: false,
        reason: "Erledigte Approval-Tasks sind interne Aufgabenlisten.",
      },
      safety: {
        sensitiveDataLikely: false,
        requiresRedaction: false,
        writeActionRequested: false,
        requiresHumanApproval: false,
      },
    };
  }

  if (asksForMyTasks) {
    if (!hasTool(args.tools, "get_visible_tasks_for_user")) return null;
    return {
      taskType: "internal_lookup",
      confidence: 0.68,
      domains: ["task"],
      domainCandidates: ["task"],
      optionalContextDomains: [],
      analysisOps: ["lookup"],
      queryClass: "lookup",
      targetEntity: "task",
      metric: "none",
      groupBy: null,
      scope: {
        cycle: "current",
        organizationScope: "own",
        objectType: "task",
        objectId: null,
        timeHorizon: "aktuell",
      },
      toolPlan: [
        {
          toolName: "get_visible_tasks_for_user",
          purpose: "Lade die aktuell offenen Aufgaben des Users.",
          input: { filter: "all", limit: 50 },
          required: true,
        },
      ],
      answerStrategy: {
        canAnswerLocally: true,
        needsInternalRetrieval: true,
        needsWebSearch: false,
        needsFrontierModel: false,
        reason: "Frage bezieht sich auf persoenliche, interne Aufgaben.",
      },
      safety: {
        sensitiveDataLikely: false,
        requiresRedaction: false,
        writeActionRequested: false,
        requiresHumanApproval: false,
      },
    };
  }

  if (asksForOkrCount) {
    const toolPlan: SentinelToolPlanItem[] = [];
    if (hasTool(args.tools, "get_current_okr_cycle")) {
      toolPlan.push({
        toolName: "get_current_okr_cycle",
        purpose: "Bestimme den aktuellen OKR-Zyklus.",
        input: {},
        required: true,
      });
    }
    if (hasTool(args.tools, "get_visible_okr_objectives")) {
      toolPlan.push({
        toolName: "get_visible_okr_objectives",
        purpose: "Lade die sichtbaren Objectives im aktuellen Zyklus.",
        input: { limit: 200 },
        required: true,
      });
    }
    if (toolPlan.length === 0) return null;
    return {
      taskType: "internal_analysis",
      confidence: 0.64,
      domains: ["okr"],
      domainCandidates: ["okr"],
      optionalContextDomains: [],
      analysisOps: ["count_total"],
      queryClass: "count",
      targetEntity: "okr_objective",
      metric: "count",
      groupBy: null,
      scope: {
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
        objectId: null,
        timeHorizon: null,
      },
      toolPlan,
      answerStrategy: {
        canAnswerLocally: true,
        needsInternalRetrieval: true,
        needsWebSearch: false,
        needsFrontierModel: false,
        reason: "Frage verlangt eine deterministische Zaehlung interner OKR-Objectives.",
      },
      safety: {
        sensitiveDataLikely: false,
        requiresRedaction: false,
        writeActionRequested: false,
        requiresHumanApproval: false,
      },
    };
  }

  if (asksForOkrDistribution) {
    if (!hasTool(args.tools, "get_visible_okr_objectives")) return null;
    return {
      taskType: "internal_analysis",
      confidence: 0.61,
      domains: ["okr"],
      domainCandidates: ["okr"],
      optionalContextDomains: [],
      analysisOps: ["distribution"],
      queryClass: "distribution",
      targetEntity: "okr_objective",
      metric: "share",
      groupBy: "status",
      scope: {
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
        objectId: null,
        timeHorizon: null,
      },
      toolPlan: [
        {
          toolName: "get_visible_okr_objectives",
          purpose: "Lade Objectives fuer Statusverteilung.",
          input: { limit: 200 },
          required: true,
        },
      ],
      answerStrategy: {
        canAnswerLocally: true,
        needsInternalRetrieval: true,
        needsWebSearch: false,
        needsFrontierModel: false,
        reason: "Frage verlangt Verteilung interner OKR-Daten nach Status.",
      },
      safety: {
        sensitiveDataLikely: false,
        requiresRedaction: false,
        writeActionRequested: false,
        requiresHumanApproval: false,
      },
    };
  }

  if (asksForOkrWithoutOwner) {
    if (!hasTool(args.tools, "get_visible_okr_objectives")) return null;
    return {
      taskType: "internal_lookup",
      confidence: 0.6,
      domains: ["okr"],
      domainCandidates: ["okr"],
      optionalContextDomains: [],
      analysisOps: ["lookup"],
      queryClass: "lookup",
      targetEntity: "okr_objective",
      metric: "none",
      groupBy: null,
      scope: {
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective_without_owner",
        objectId: null,
        timeHorizon: null,
      },
      toolPlan: [
        {
          toolName: "get_visible_okr_objectives",
          purpose: "Lade Objectives und filtere auf fehlenden Owner.",
          input: { limit: 200 },
          required: true,
        },
      ],
      answerStrategy: {
        canAnswerLocally: true,
        needsInternalRetrieval: true,
        needsWebSearch: false,
        needsFrontierModel: false,
        reason: "Frage verlangt interne Liste von Objectives ohne Owner-Zuordnung.",
      },
      safety: {
        sensitiveDataLikely: false,
        requiresRedaction: false,
        writeActionRequested: false,
        requiresHumanApproval: false,
      },
    };
  }

  return null;
}

/**
 * Erstellt einen SentinelPlan fuer eine Userfrage. Liefert immer ein gueltiges
 * Plan-Objekt (Fallback `unknown` bei Fehlern, siehe `callSentinelPlanMode`).
 */
export async function runPlanMode(args: PlanModeRunArgs): Promise<SentinelPlanCallResult> {
  const systemPrompt = buildPlanModeSystemPrompt({
    tools: args.tools,
    schemaHint: SENTINEL_PLAN_SCHEMA_NAME,
  });
  const userPrompt = buildPlanModeUserPrompt({
    question: args.question,
    uiContext: args.uiContext,
    userContext: args.userContext,
    recentMessages: args.recentMessages,
  });
  const llmResult = await callSentinelPlanMode({
    systemPrompt,
    userPrompt,
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
    timeoutMs: args.timeoutMs,
    model: args.model,
  });
  const llmPlan = enforceQuestionSpecificPlan(llmResult.plan, args.question);

  const shouldUseHeuristic =
    llmResult.usedFallback ||
    llmPlan.taskType === "unknown" ||
    llmPlan.queryClass === "unknown";
  if (!shouldUseHeuristic) {
    return {
      ...llmResult,
      plan: {
        ...llmPlan,
        queryClass: llmPlan.queryClass ?? "unknown",
      },
    };
  }

  const heuristic = buildHeuristicPlan(args);
  if (!heuristic) return llmResult;

  return {
    ...llmResult,
    plan: heuristic,
    usedFallback: true,
    fallbackReason: llmResult.fallbackReason
      ? `${llmResult.fallbackReason} | heuristic_plan_applied`
      : "heuristic_plan_applied",
  };
}
