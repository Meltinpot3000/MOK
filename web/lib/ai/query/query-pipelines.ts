import type { AiUserContext } from "@/lib/ai/types";
import type { QueryClass } from "@/lib/ai/query/query-types";

import { runCountPipeline } from "./count-pipeline";
import { runDistributionPipeline } from "./distribution-pipeline";
import { runLookupPipeline } from "./lookup-pipeline";
import { runRankingPipeline } from "./ranking-pipeline";
import { runCompositePipeline } from "./composite-pipeline";
import {
  normalizeGroupBy,
  type ExecutePermissionedToolFn,
  type QueryPipelineResult,
  type QueryPlan,
} from "./query-types";

type QueryPipelineContext = {
  executePermissionedTool: ExecutePermissionedToolFn;
  userContext: AiUserContext;
};

const OPTIONAL_DOMAIN_TOOL_MAP: Record<string, string[]> = {
  okr: ["get_current_okr_cycle"],
  task: ["get_visible_tasks_for_user"],
  review: ["get_latest_review_notes"],
  strategy: ["get_visible_initiatives"],
  user: ["get_current_user_context"],
};

type PipelineRunner = (args: {
  plan: QueryPlan;
  executePermissionedTool: ExecutePermissionedToolFn;
  currentMembershipId: string;
  userContext: AiUserContext;
}) => Promise<QueryPipelineResult>;

const PIPELINE_RUNNERS: Partial<Record<QueryClass, PipelineRunner>> = {
  ranking: async ({ plan, executePermissionedTool }) =>
    runRankingPipeline({ plan, executePermissionedTool }),
  count: async ({ plan, executePermissionedTool }) =>
    runCountPipeline({ plan, executePermissionedTool }),
  distribution: async ({ plan, executePermissionedTool }) =>
    runDistributionPipeline({ plan, executePermissionedTool }),
  composite: async ({ plan, executePermissionedTool, userContext }) =>
    runCompositePipeline({ plan, executePermissionedTool, userContext }),
  lookup: async ({ plan, executePermissionedTool, currentMembershipId }) =>
    runLookupPipeline({ plan, executePermissionedTool, currentMembershipId }),
};

export function hasRegisteredPipeline(queryClass: QueryClass): boolean {
  return Boolean(PIPELINE_RUNNERS[queryClass]);
}

export async function runQueryPipeline(
  rawPlan: QueryPlan,
  context: QueryPipelineContext
): Promise<QueryPipelineResult> {
  const runner = PIPELINE_RUNNERS[rawPlan.queryClass];
  if (!runner) {
    throw new Error(`pipeline_not_registered:${rawPlan.queryClass}`);
  }
  const normalizedPlan: QueryPlan = {
    ...rawPlan,
    groupBy: normalizeGroupBy(rawPlan.groupBy),
  };
  const result = await runner({
    plan: normalizedPlan,
    executePermissionedTool: context.executePermissionedTool,
    currentMembershipId: context.userContext.membershipId,
    userContext: context.userContext,
  });
  const optionalTools = Array.from(
    new Set(
      normalizedPlan.optionalContextDomains.flatMap((domain) => OPTIONAL_DOMAIN_TOOL_MAP[domain] ?? [])
    )
  );
  let optionalFailure = false;
  for (const toolName of optionalTools) {
    const optionalResult = await context.executePermissionedTool(toolName, {});
    result.usedToolCalls.push({
      toolName: optionalResult.toolName,
      inputSummary: "{}",
      outputSummary: optionalResult.outputSummary,
      success: optionalResult.success,
    });
    if (!optionalResult.success) optionalFailure = true;
  }
  if (result.contract.retrievalStatus === "ok" && optionalFailure) {
    result.contract.retrievalStatus = "partial";
    result.warnings.push("optional_context_tool_failed");
  }
  return result;
}

