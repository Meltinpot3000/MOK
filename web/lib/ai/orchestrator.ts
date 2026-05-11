import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AiTaskType,
  AiToolDomain,
  AiUserContext,
  AssistantUiContext,
  ModelRouteDecision,
} from "@/lib/ai/types";
import {
  SENTINEL_PROMPT_VERSION,
  SENTINEL_SYNTHESIS_PROMPT_VERSION,
  type RecentMessageForPrompt,
} from "@/lib/ai/sentinel-core/prompts";
import { runPlanMode } from "@/lib/ai/sentinel-core/plan-mode";
import { runLocalSynthesisMode } from "@/lib/ai/sentinel-core/synthesis-mode";
import type { SentinelPlan } from "@/lib/ai/sentinel-core/schemas";
import { getToolByName, listToolsForPrompt } from "@/lib/ai/tools/registry";
import type { AiToolResult } from "@/lib/ai/tools/types";
import {
  checkRunPrerequisites,
  type PermissionGuardCheck,
} from "@/lib/ai/security/permission-guard";
import { loadEffectivePolicy } from "@/lib/ai/security/policy-engine";
import { routeModel } from "@/lib/ai/model-router";
import { assembleContext } from "@/lib/ai/context/context-assembler";
import { persistContextSources } from "@/lib/ai/context/context-sources";
import { renderDeterministicNarration } from "@/lib/ai/answers/deterministic-narrator";
import { verifyAnswer } from "@/lib/ai/answers/answer-verifier";
import { runQueryPipeline, hasRegisteredPipeline } from "@/lib/ai/query/query-pipelines";
import { normalizeGroupBy, type QueryPlan } from "@/lib/ai/query/query-types";
import type { StructuredAnswerContract } from "@/lib/ai/answers/answer-contracts";
import { recordSentinelUsageEvents } from "@/lib/llm/usage";

import {
  buildExecutablePlan,
  groupStepsByStage,
  type ExecutablePlanStep,
} from "./orchestrator-plan";

function hasAllCapabilities(userContext: AiUserContext, requiredCapabilities: string[]): boolean {
  return requiredCapabilities.every((cap) => userContext.permissionCodes.has(cap));
}

export type OrchestratorEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "status"; status: string; message?: string }
  | { type: "plan"; plan: SentinelPlan; usedFallback: boolean; fallbackReason?: string }
  | {
      type: "executable_plan";
      stepCount: number;
      droppedCount: number;
      warningCount: number;
    }
  | {
      type: "tool_started";
      stepId: string;
      toolName: string;
      stage: number;
    }
  | {
      type: "tool_completed";
      stepId: string;
      toolName: string;
      success: boolean;
      latencyMs: number;
      summary: string;
    }
  | {
      type: "model_route";
      decision: ModelRouteDecision;
    }
  | {
      type: "structured_contract";
      contract: StructuredAnswerContract;
    }
  | {
      type: "verifier_blocked";
      reason: string;
    }
  | {
      type: "diagnostics";
      data: {
        question: string;
        accessContext: {
          organizationId: string;
          membershipId: string;
          capabilityCount: number;
        };
        plan: {
          queryClass: string;
          taskType: string;
          domains: string[];
          targetEntity: string | null;
          metric: string | null;
          groupBy: string | null;
          confidence: number;
          usedFallback: boolean;
          fallbackReason?: string;
        };
        dispatch: {
          shouldRunPipeline: boolean;
          selectedPath: "pipeline" | "legacy";
          pipelineRegistered: boolean;
        };
        tools: Array<{
          toolName: string;
          requestedBy: "pipeline" | "legacy";
          allowedInExecutablePlan: boolean;
          executed: boolean;
          success: boolean;
          summary: string;
          error?: string;
        }>;
        contract: {
          present: boolean;
          queryClass: string | null;
          totalItems: number | null;
          warningCount: number;
        };
        verifier: {
          applied: boolean;
          status: "ok" | "blocked" | "not_applicable";
          reason?: string;
        };
      };
    }
  | {
      type: "answer_chunk";
      delta: string;
    }
  | {
      type: "answer";
      text: string;
      provider: string;
      model: string;
      modelTier: string;
    }
  | {
      type: "blocked";
      reason: string;
      reasonCode: string;
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "done";
      runId: string;
      latencyMs: number;
    };

export type RunChatArgs = {
  question: string;
  conversationId: string;
  recentMessages: RecentMessageForPrompt[];
  userContext: AiUserContext;
  uiContext?: AssistantUiContext | null;
  supabase: SupabaseClient;
  domainHints?: AiToolDomain[];
  signal?: AbortSignal;
  skipSynthesis?: boolean;
  /** Smoke: Histogramm aller zugewiesenen Tasks (DB) vs. Filter */
  taskFetchDiagnostics?: boolean;
};

type AgentRunRecord = {
  id: string;
};

async function createAgentRunRow(
  supabase: SupabaseClient,
  args: { userContext: AiUserContext; conversationId: string }
): Promise<AgentRunRecord | null> {
  const { data, error } = await supabase
    .schema("app")
    .from("ai_agent_runs")
    .insert({
      conversation_id: args.conversationId,
      organization_id: args.userContext.organizationId,
      user_id: args.userContext.userId,
      membership_id: args.userContext.membershipId,
      status: "running",
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[ai_agent_runs] insert failed", error?.message);
    return null;
  }
  return { id: data.id as string };
}

async function updateAgentRunRow(
  supabase: SupabaseClient,
  runId: string,
  patch: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.schema("app").from("ai_agent_runs").update(patch).eq("id", runId);
  if (error) {
    console.error("[ai_agent_runs] update failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function recordToolCall(
  supabase: SupabaseClient,
  args: {
    agentRunId: string;
    organizationId: string;
    step: ExecutablePlanStep;
    result: AiToolResult;
    latencyMs: number;
    permissionResult?: PermissionGuardCheck;
  }
): Promise<void> {
  const { error } = await supabase
    .schema("app")
    .from("ai_tool_calls")
    .insert({
      agent_run_id: args.agentRunId,
      organization_id: args.organizationId,
      tool_name: args.step.toolName,
      tool_domain: args.step.toolDefinition.domain,
      input_payload: args.step.normalizedInput ?? {},
      output_summary: args.result.outputSummary?.slice(0, 4000) ?? null,
      success: args.result.success,
      permission_result: args.permissionResult ?? null,
      error_message: args.result.error ?? null,
      latency_ms: args.latencyMs,
    });
  if (error) {
    console.error("[ai_tool_calls] insert failed", error.message);
  }
}

async function recordVerifierLog(
  supabase: SupabaseClient,
  args: {
    agentRunId: string;
    organizationId: string;
    success: boolean;
    reason: string;
  }
): Promise<void> {
  const { error } = await supabase
    .schema("app")
    .from("ai_tool_calls")
    .insert({
      agent_run_id: args.agentRunId,
      organization_id: args.organizationId,
      tool_name: "answer_verifier",
      tool_domain: "system_help",
      input_payload: {},
      output_summary: args.reason,
      success: args.success,
      permission_result: null,
      error_message: args.success ? null : args.reason,
      latency_ms: 0,
    });
  if (error) {
    console.error("[ai_tool_calls] verifier insert failed", error.message);
  }
}

export type ExecutePermissionedToolArgs = {
  step: ExecutablePlanStep;
  runArgs: RunChatArgs;
  agentRunId: string;
  emit: (event: OrchestratorEvent) => void;
};

/**
 * Einheitliche Tool-Ausfuehrung fuer den Orchestrator:
 * - streamt SSE-Tool-Events
 * - kapselt Tool-Execution
 * - schreibt ai_tool_calls Audit-Log
 *
 * Pipeline- und Legacy-Pfade muessen diese Funktion verwenden statt direkter
 * Tool-Registry-Aufrufe.
 */
export async function executePermissionedTool({
  step,
  runArgs,
  agentRunId,
  emit,
}: ExecutePermissionedToolArgs): Promise<AiToolResult> {
  emit({ type: "tool_started", stepId: step.stepId, toolName: step.toolName, stage: step.stage });
  const startedAt = Date.now();
  try {
    const result = await step.toolDefinition.execute({
      input: step.normalizedInput,
      userContext: runArgs.userContext,
      uiContext: runArgs.uiContext ?? null,
      supabase: runArgs.supabase,
      signal: runArgs.signal,
    });
    const latencyMs = Date.now() - startedAt;
    emit({
      type: "tool_completed",
      stepId: step.stepId,
      toolName: step.toolName,
      success: result.success,
      latencyMs,
      summary: result.outputSummary,
    });
    await recordToolCall(runArgs.supabase, {
      agentRunId,
      organizationId: runArgs.userContext.organizationId,
      step,
      result,
      latencyMs,
    });
    return result;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    const failure: AiToolResult = {
      toolName: step.toolName,
      success: false,
      data: null,
      outputSummary: `Tool ${step.toolName} fehlgeschlagen: ${message}`,
      error: message,
    };
    emit({
      type: "tool_completed",
      stepId: step.stepId,
      toolName: step.toolName,
      success: false,
      latencyMs,
      summary: failure.outputSummary,
    });
    await recordToolCall(runArgs.supabase, {
      agentRunId,
      organizationId: runArgs.userContext.organizationId,
      step,
      result: failure,
      latencyMs,
    });
    return failure;
  }
}

/**
 * Hauptlauf: streamt Orchestrator-Events bis zur fertigen Antwort.
 */
export async function* runChat(args: RunChatArgs): AsyncGenerator<OrchestratorEvent, void, void> {
  const startedAt = Date.now();

  yield { type: "status", status: "loading_policy" };
  const policy = await loadEffectivePolicy(args.supabase, args.userContext.organizationId);

  const prereq = checkRunPrerequisites(args.userContext, policy);
  if (!prereq.allowed) {
    yield {
      type: "blocked",
      reason: prereq.reason ?? "blocked",
      reasonCode: prereq.reasonCode ?? "ai_disabled",
    };
    yield { type: "done", runId: "", latencyMs: Date.now() - startedAt };
    return;
  }

  yield { type: "status", status: "creating_run" };
  const run = await createAgentRunRow(args.supabase, {
    userContext: args.userContext,
    conversationId: args.conversationId,
  });
  if (!run) {
    yield { type: "error", message: "Konnte ai_agent_runs-Eintrag nicht anlegen." };
    return;
  }
  const agentRunId = run.id;

  // Plan
  yield { type: "status", status: "planning" };
  const tools = listToolsForPrompt({
    capabilities: args.userContext.permissionCodes,
    domainHints: args.domainHints,
    maxTools: 12,
  });
  const planResult = await runPlanMode({
    question: args.question,
    uiContext: args.uiContext ?? null,
    userContext: args.userContext,
    recentMessages: args.recentMessages,
    tools,
  });
  yield {
    type: "plan",
    plan: planResult.plan,
    usedFallback: planResult.usedFallback,
    fallbackReason: planResult.fallbackReason,
  };
  if (planResult.usage && policy.logToolCalls) {
    await recordSentinelUsageEvents(args.supabase, [
      {
        organizationId: args.userContext.organizationId,
        cycleInstanceId: null,
        feature: "sentinel_assistant",
        provider: planResult.provider,
        model: planResult.model,
        promptVersion: SENTINEL_PROMPT_VERSION,
        promptTokens: planResult.usage.promptTokens,
        completionTokens: planResult.usage.completionTokens,
        totalTokens: planResult.usage.totalTokens,
        billableCost: planResult.usage.billableCost,
        usageMissing: planResult.usage.usageMissing,
        subFeature: "plan_mode",
        agentRunId,
      },
    ]);
  }

  await updateAgentRunRow(args.supabase, agentRunId, {
    sentinel_plan: planResult.plan,
    task_type: planResult.plan.taskType,
    domains: planResult.plan.domains,
    requires_web_search: planResult.plan.answerStrategy.needsWebSearch,
    requires_frontier_model: planResult.plan.answerStrategy.needsFrontierModel,
    sensitive_data_detected: planResult.plan.safety.sensitiveDataLikely,
  });

  // Executable Plan
  yield { type: "status", status: "validating_plan" };
  const executable = buildExecutablePlan({
    plan: planResult.plan,
    userContext: args.userContext,
    uiContext: args.uiContext ?? null,
    policy,
  });
  yield {
    type: "executable_plan",
    stepCount: executable.steps.length,
    droppedCount: executable.droppedToolNames.length,
    warningCount: executable.warnings.length,
  };

  let structuredContract: StructuredAnswerContract | null = null;
  let pipelineWarnings: string[] = [];
  const diagnosticsTools: Array<{
    toolName: string;
    requestedBy: "pipeline" | "legacy";
    allowedInExecutablePlan: boolean;
    executed: boolean;
    success: boolean;
    summary: string;
    error?: string;
  }> = [];

  // Execute by query-class pipeline (preferred) or legacy tool plan.
  const toolResults: AiToolResult[] = [];
  const normalizedQueryClass = planResult.plan.queryClass ?? "unknown";
  const shouldRunPipeline =
    normalizedQueryClass !== "unknown" && hasRegisteredPipeline(normalizedQueryClass);

  if (shouldRunPipeline) {
    yield { type: "status", status: "running_pipeline" };
    const pipelineEvents: OrchestratorEvent[] = [];
    const queryPlan: QueryPlan = {
      queryClass: normalizedQueryClass,
      domain: (planResult.plan.domains[0] as AiToolDomain | undefined) ?? null,
      domainCandidates: [...(planResult.plan.domainCandidates ?? [])],
      optionalContextDomains: [...(planResult.plan.optionalContextDomains ?? [])],
      queryText: args.question,
      analysisOps: [...(planResult.plan.analysisOps ?? [])],
      targetEntity: planResult.plan.targetEntity ?? null,
      metric: planResult.plan.metric ?? "none",
      groupBy: normalizeGroupBy(planResult.plan.groupBy),
      scope: planResult.plan.scope,
      taskFetchDiagnostics: args.taskFetchDiagnostics === true,
    };
    const pipelineResult = await runQueryPipeline(queryPlan, {
      userContext: args.userContext,
      executePermissionedTool: async (toolName, input) => {
        const toolDefinition = getToolByName(toolName);
        if (!toolDefinition) {
          diagnosticsTools.push({
            toolName,
            requestedBy: "pipeline",
            allowedInExecutablePlan: true,
            executed: false,
            success: false,
            summary: `Tool ${toolName} ist nicht registriert.`,
            error: "tool_not_registered",
          });
          return {
            toolName,
            success: false,
            data: null,
            outputSummary: `Tool ${toolName} ist nicht registriert.`,
            error: "tool_not_registered",
          };
        }
        if (!hasAllCapabilities(args.userContext, toolDefinition.requiredCapabilities)) {
          diagnosticsTools.push({
            toolName,
            requestedBy: "pipeline",
            allowedInExecutablePlan: true,
            executed: false,
            success: false,
            summary: `Fehlende Capability fuer ${toolName}.`,
            error: "missing_capability",
          });
          return {
            toolName,
            success: false,
            data: null,
            outputSummary: `Fehlende Capability fuer ${toolName}.`,
            error: "missing_capability",
          };
        }
        return executePermissionedTool({
          step: {
            stepId: `pipeline_${toolName}`,
            toolName,
            toolDefinition,
            normalizedInput: input,
            required: true,
            purpose: "pipeline_required_tool",
            dependsOn: [],
            stage: 0,
          },
          runArgs: args,
          agentRunId,
          emit: (event) => pipelineEvents.push(event),
        }).then((result) => {
          diagnosticsTools.push({
            toolName,
            requestedBy: "pipeline",
            allowedInExecutablePlan: true,
            executed: true,
            success: result.success,
            summary: result.outputSummary,
            error: result.error,
          });
          return result;
        });
      },
    });
    for (const ev of pipelineEvents) {
      yield ev;
    }
    for (const traceCall of pipelineResult.usedToolCalls) {
      if (!traceCall.toolName.startsWith("lookup_pipeline_trace_")) continue;
      diagnosticsTools.push({
        toolName: traceCall.toolName,
        requestedBy: "pipeline",
        allowedInExecutablePlan: true,
        executed: true,
        success: traceCall.success,
        summary: `${traceCall.inputSummary} => ${traceCall.outputSummary}`,
      });
    }
    structuredContract = pipelineResult.contract;
    pipelineWarnings = pipelineResult.warnings;
    yield { type: "structured_contract", contract: pipelineResult.contract };
  } else if (executable.steps.length > 0) {
    yield { type: "status", status: "executing_tools" };
    const stages = groupStepsByStage(executable.steps);
    for (const stage of stages) {
      const stageEvents: OrchestratorEvent[] = [];
      const stageResults = await Promise.all(
        stage.map((step) =>
          executePermissionedTool({
            step,
            runArgs: args,
            agentRunId,
            emit: (event) => stageEvents.push(event),
          })
        )
      );
      for (const ev of stageEvents) yield ev;
      for (let index = 0; index < stageResults.length; index += 1) {
        const result = stageResults[index];
        const step = stage[index];
        if (step) {
          diagnosticsTools.push({
            toolName: step.toolName,
            requestedBy: "legacy",
            allowedInExecutablePlan: true,
            executed: true,
            success: result.success,
            summary: result.outputSummary,
            error: result.error,
          });
        }
        toolResults.push(result);
      }
    }
  }

  const totalItemsFromContract =
    structuredContract == null
      ? null
      : "totalItems" in structuredContract
        ? structuredContract.totalItems
        : "total" in structuredContract
          ? structuredContract.total
          : null;
  const selectedPath: "pipeline" | "legacy" = shouldRunPipeline ? "pipeline" : "legacy";

  if (args.skipSynthesis === true) {
    const baselineText = structuredContract ? renderDeterministicNarration(structuredContract) : "";
    let answerText = baselineText || "Smoke fast mode: no synthesis.";
    let verifierStatus: "ok" | "blocked" | "not_applicable" = "not_applicable";
    let verifierReason: string | undefined;

    if (structuredContract) {
      const verifier = verifyAnswer({
        contract: structuredContract,
        llmText: answerText,
        baselineText,
      });
      if (verifier.status === "blocked") {
        verifierStatus = "blocked";
        verifierReason = verifier.reason;
        answerText = verifier.replacementText;
        yield { type: "verifier_blocked", reason: verifier.reason };
        await recordVerifierLog(args.supabase, {
          agentRunId,
          organizationId: args.userContext.organizationId,
          success: false,
          reason: verifier.reason,
        });
      } else {
        verifierStatus = "ok";
        await recordVerifierLog(args.supabase, {
          agentRunId,
          organizationId: args.userContext.organizationId,
          success: true,
          reason: pipelineWarnings.length > 0 ? pipelineWarnings.join("; ") : "ok",
        });
      }
    }

    const diagnosticsPayload = {
      question: args.question,
      accessContext: {
        organizationId: args.userContext.organizationId,
        membershipId: args.userContext.membershipId,
        capabilityCount: args.userContext.permissionCodes.size,
      },
      plan: {
        queryClass: normalizedQueryClass,
        taskType: planResult.plan.taskType,
        domains: [...planResult.plan.domains],
        targetEntity: planResult.plan.targetEntity ?? null,
        metric: planResult.plan.metric ?? null,
        groupBy: planResult.plan.groupBy ?? null,
        confidence: planResult.plan.confidence,
        usedFallback: planResult.usedFallback,
        fallbackReason: planResult.fallbackReason,
      },
      dispatch: {
        shouldRunPipeline,
        selectedPath,
        pipelineRegistered: hasRegisteredPipeline(normalizedQueryClass),
      },
      tools: diagnosticsTools,
      contract: {
        present: structuredContract != null,
        queryClass: structuredContract?.queryClass ?? null,
        totalItems: totalItemsFromContract,
        warningCount: pipelineWarnings.length,
      },
      verifier: {
        applied: structuredContract != null,
        status: verifierStatus,
        reason: verifierReason,
      },
    };
    yield {
      type: "diagnostics",
      data: diagnosticsPayload,
    };
    const metadataPersist = await updateAgentRunRow(args.supabase, agentRunId, {
      metadata: { diagnostics: diagnosticsPayload },
    });
    if (!metadataPersist.ok) {
      await updateAgentRunRow(args.supabase, agentRunId, {
        sentinel_plan: {
          ...planResult.plan,
          diagnostics: diagnosticsPayload,
        },
      });
    }

    yield {
      type: "answer",
      text: answerText,
      provider: "smoke_fast",
      model: "none",
      modelTier: "local",
    };

    await updateAgentRunRow(args.supabase, agentRunId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
    });

    yield { type: "done", runId: agentRunId, latencyMs: Date.now() - startedAt };
    return;
  }

  // Model routing
  const modelDecision = routeModel({ plan: planResult.plan, policy });
  yield { type: "model_route", decision: modelDecision };

  await updateAgentRunRow(args.supabase, agentRunId, {
    model_tier: modelDecision.modelTier,
    provider: modelDecision.provider,
  });

  // Context assembly
  yield { type: "status", status: "assembling_context" };
  const assembled = assembleContext({
    question: args.question,
    taskType: planResult.plan.taskType as AiTaskType,
    domains: planResult.plan.domains as AiToolDomain[],
    scope: planResult.plan.scope as Record<string, unknown>,
    toolResults,
    maxContextObjects: policy.maxContextObjects,
    preferredObjectTypes: planResult.plan.scope.objectType
      ? [planResult.plan.scope.objectType]
      : [],
    recentMessages: args.recentMessages,
    writeActionsAllowed: policy.writeActionsEnabled,
    modelTierForRedaction: modelDecision.modelTier,
    structuredContract,
  });

  await persistContextSources({
    supabase: args.supabase,
    agentRunId,
    organizationId: args.userContext.organizationId,
    sources: assembled.contextSources,
  });

  // Synthesis (MVP: nur lokal — externe Synthese-Provider folgen via Phase 2)
  yield { type: "status", status: "synthesizing" };
  const baselineText = structuredContract ? renderDeterministicNarration(structuredContract) : "";
  let answerText = "";
  let provider = "ollama";
  let modelName = "";
  if (modelDecision.modelTier === "local") {
    const synth = await runLocalSynthesisMode({
      question: args.question,
      contextPackage: assembled.contextPackage,
      conversationSummary: assembled.contextPackage.conversationSummary ?? null,
      writeActionsAllowed: policy.writeActionsEnabled,
      classificationCap: "internal",
      downgradeNotice: modelDecision.downgrade?.userMessage ?? null,
      modelTier: modelDecision.modelTier,
    });
    answerText = structuredContract ? `${baselineText}\n\n${synth.text}` : synth.text;
    provider = synth.provider;
    modelName = synth.model;
    if (synth.errorMessage) {
      yield { type: "error", message: synth.errorMessage };
    }
    if (policy.logToolCalls) {
      await recordSentinelUsageEvents(args.supabase, [
        {
          organizationId: args.userContext.organizationId,
          cycleInstanceId: null,
          feature: "sentinel_assistant",
          provider: synth.provider,
          model: synth.model,
          promptVersion: SENTINEL_SYNTHESIS_PROMPT_VERSION,
          promptTokens: synth.usage.promptTokens,
          completionTokens: synth.usage.completionTokens,
          totalTokens: synth.usage.totalTokens,
          billableCost: synth.usage.billableCost,
          usageMissing: synth.usage.usageMissing,
          subFeature: "synthesis_local",
          agentRunId,
        },
      ]);
    }
  } else {
    // Externe Synthese: MVP-Stub — Hinweis fuer User, lokale Antwort als Fallback
    answerText = [
      "Hinweis: Externe Synthese ist im MVP noch nicht aktiviert. Es folgt eine lokale Antwort.",
      "",
      ...(modelDecision.downgrade?.userMessage ? [modelDecision.downgrade.userMessage, ""] : []),
    ].join("\n");
    const synth = await runLocalSynthesisMode({
      question: args.question,
      contextPackage: assembled.contextPackage,
      conversationSummary: assembled.contextPackage.conversationSummary ?? null,
      writeActionsAllowed: policy.writeActionsEnabled,
      classificationCap: "internal",
      downgradeNotice: modelDecision.downgrade?.userMessage ?? null,
      modelTier: "local",
    });
    answerText = structuredContract ? `${baselineText}\n\n${synth.text}` : `${answerText}\n${synth.text}`;
    provider = synth.provider;
    modelName = synth.model;
    if (policy.logToolCalls) {
      await recordSentinelUsageEvents(args.supabase, [
        {
          organizationId: args.userContext.organizationId,
          cycleInstanceId: null,
          feature: "sentinel_assistant",
          provider: synth.provider,
          model: synth.model,
          promptVersion: SENTINEL_SYNTHESIS_PROMPT_VERSION,
          promptTokens: synth.usage.promptTokens,
          completionTokens: synth.usage.completionTokens,
          totalTokens: synth.usage.totalTokens,
          billableCost: synth.usage.billableCost,
          usageMissing: synth.usage.usageMissing,
          subFeature: "synthesis_external_stub",
          agentRunId,
        },
      ]);
    }
  }

  let verifierStatus: "ok" | "blocked" | "not_applicable" = "not_applicable";
  let verifierReason: string | undefined;
  if (structuredContract) {
    const verifier = verifyAnswer({
      contract: structuredContract,
      llmText: answerText,
      baselineText,
    });
    if (verifier.status === "blocked") {
      verifierStatus = "blocked";
      verifierReason = verifier.reason;
      answerText = verifier.replacementText;
      yield { type: "verifier_blocked", reason: verifier.reason };
      await recordVerifierLog(args.supabase, {
        agentRunId,
        organizationId: args.userContext.organizationId,
        success: false,
        reason: verifier.reason,
      });
    } else {
      verifierStatus = "ok";
      await recordVerifierLog(args.supabase, {
        agentRunId,
        organizationId: args.userContext.organizationId,
        success: true,
        reason: pipelineWarnings.length > 0 ? pipelineWarnings.join("; ") : "ok",
      });
    }
  }

  const diagnosticsPayload = {
    question: args.question,
    accessContext: {
      organizationId: args.userContext.organizationId,
      membershipId: args.userContext.membershipId,
      capabilityCount: args.userContext.permissionCodes.size,
    },
    plan: {
      queryClass: normalizedQueryClass,
      taskType: planResult.plan.taskType,
      domains: [...planResult.plan.domains],
      targetEntity: planResult.plan.targetEntity ?? null,
      metric: planResult.plan.metric ?? null,
      groupBy: planResult.plan.groupBy ?? null,
      confidence: planResult.plan.confidence,
      usedFallback: planResult.usedFallback,
      fallbackReason: planResult.fallbackReason,
    },
    dispatch: {
      shouldRunPipeline,
      selectedPath,
      pipelineRegistered: hasRegisteredPipeline(normalizedQueryClass),
    },
    tools: diagnosticsTools,
    contract: {
      present: structuredContract != null,
      queryClass: structuredContract?.queryClass ?? null,
      totalItems: totalItemsFromContract,
      warningCount: pipelineWarnings.length,
    },
    verifier: {
      applied: structuredContract != null,
      status: verifierStatus,
      reason: verifierReason,
    },
  };
  yield {
    type: "diagnostics",
    data: diagnosticsPayload,
  };
  const metadataPersist = await updateAgentRunRow(args.supabase, agentRunId, {
    metadata: { diagnostics: diagnosticsPayload },
  });
  if (!metadataPersist.ok) {
    await updateAgentRunRow(args.supabase, agentRunId, {
      sentinel_plan: {
        ...planResult.plan,
        diagnostics: diagnosticsPayload,
      },
    });
  }

  yield {
    type: "answer",
    text: answerText,
    provider,
    model: modelName,
    modelTier: modelDecision.modelTier,
  };

  await updateAgentRunRow(args.supabase, agentRunId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    latency_ms: Date.now() - startedAt,
  });

  yield { type: "done", runId: agentRunId, latencyMs: Date.now() - startedAt };
}
