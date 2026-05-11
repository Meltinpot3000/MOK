import type { AiToolDomain } from "@/lib/ai/types";
import type { ToolDescriptionForPrompt } from "@/lib/ai/sentinel-core/prompts";

import {
  calculateOkrRiskSignalsTool,
  getCurrentOkrCycleTool,
  getKeyResultsForObjectivesTool,
  getOkrObjectiveOwnerCountsTool,
  getVisibleOkrObjectivesTool,
} from "./okr-tools";
import { getLatestReviewNotesTool } from "./review-tools";
import { getVisibleInitiativesTool } from "./strategy-tools";
import { getVisibleTasksForUserTool } from "./task-tools";
import type { AiToolDefinition } from "./types";
import { getCurrentUserContextTool } from "./user-tools";

const ALL_TOOLS: AiToolDefinition[] = [
  getCurrentUserContextTool,
  getCurrentOkrCycleTool,
  getOkrObjectiveOwnerCountsTool,
  getVisibleOkrObjectivesTool,
  getKeyResultsForObjectivesTool,
  calculateOkrRiskSignalsTool,
  getVisibleInitiativesTool,
  getLatestReviewNotesTool,
  getVisibleTasksForUserTool,
];

const TOOL_BY_NAME: Map<string, AiToolDefinition> = new Map(
  ALL_TOOLS.map((tool) => [tool.name, tool])
);

export function listAllTools(): AiToolDefinition[] {
  return ALL_TOOLS;
}

export function getToolByName(name: string): AiToolDefinition | null {
  return TOOL_BY_NAME.get(name) ?? null;
}

export type ListToolsForPromptOptions = {
  /** Maximalanzahl Tools, die im Plan-Prompt gelistet werden (Default 12). */
  maxTools?: number;
  /**
   * Hinweise auf Domains, die der Caller aufgrund von Heuristiken (UI-Kontext,
   * letzte User-Frage) erwartet. Tools dieser Domains werden bevorzugt.
   */
  domainHints?: AiToolDomain[];
  /**
   * RBAC-Capability-Set des Users. Tools, deren `requiredCapabilities` nicht
   * vollstaendig enthalten sind, werden weggelassen.
   */
  capabilities: ReadonlySet<string>;
};

export function listToolsForPrompt(
  options: ListToolsForPromptOptions
): ToolDescriptionForPrompt[] {
  const max = options.maxTools ?? 12;
  const hints = new Set(options.domainHints ?? []);

  const filtered = ALL_TOOLS.filter((tool) =>
    tool.requiredCapabilities.every((cap) => options.capabilities.has(cap))
  );

  filtered.sort((a, b) => {
    const aHinted = hints.has(a.domain) ? 1 : 0;
    const bHinted = hints.has(b.domain) ? 1 : 0;
    if (aHinted !== bHinted) return bHinted - aHinted;
    return a.name.localeCompare(b.name);
  });

  return filtered.slice(0, max).map(
    (tool): ToolDescriptionForPrompt => ({
      name: tool.name,
      domain: tool.domain,
      description: tool.description,
      inputSchemaHint: tool.inputSchemaHint,
      requiredCapabilities: tool.requiredCapabilities,
    })
  );
}
