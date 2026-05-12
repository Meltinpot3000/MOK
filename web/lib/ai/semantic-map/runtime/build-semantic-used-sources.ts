import type { SemanticUsedSource } from "../types";

/**
 * MVP-Mapping: Sentinel-/Orchestrator-Toolnamen → `SemanticUsedSource` für Evidence-Coverage.
 *
 * | toolName | sourceRef (identisch) | placeKey (Hinweis) |
 * |----------|------------------------|---------------------|
 * | get_current_okr_cycle | get_current_okr_cycle | okr.cycle |
 * | get_visible_strategy_challenges | … | strategy.challenge |
 * | get_strategy_challenges_for_cycle | … | strategy.challenge |
 * | get_visible_strategic_directions | … | strategy.direction |
 * | get_strategy_directions_for_cycle | … | strategy.direction |
 * | get_visible_initiatives | … | strategy.initiative |
 * | get_initiatives_for_direction | … | strategy.initiative |
 * | get_initiative_key_result_links | … | strategy.initiative |
 * | get_strategy_execution_landscape | (3× siehe Implementierung) | challenge / direction / initiative |
 *
 * Unbekannte Tools: ein Eintrag `sourceType: "tool"`, `sourceRef` = toolName, ohne placeKey.
 */
const TOOL_REF_BY_NAME: Record<string, { placeKey?: string } | "landscape"> = {
  get_current_okr_cycle: { placeKey: "okr.cycle" },
  get_visible_strategy_challenges: { placeKey: "strategy.challenge" },
  get_strategy_challenges_for_cycle: { placeKey: "strategy.challenge" },
  get_visible_strategic_directions: { placeKey: "strategy.direction" },
  get_strategy_directions_for_cycle: { placeKey: "strategy.direction" },
  get_visible_initiatives: { placeKey: "strategy.initiative" },
  get_initiatives_for_direction: { placeKey: "strategy.initiative" },
  get_initiative_key_result_links: { placeKey: "strategy.initiative" },
  get_strategy_execution_landscape: "landscape",
};

function toolCallSucceeded(tc: { status?: string }): boolean {
  const s = (tc.status ?? "").trim().toLowerCase();
  if (!s) return true;
  if (["error", "failed", "cancelled", "canceled"].includes(s)) return false;
  return true;
}

export function buildSemanticUsedSourcesFromToolCalls(input: {
  toolCalls: Array<{
    toolName: string;
    status?: string;
    resultSummary?: unknown;
    sources?: unknown;
  }>;
}): SemanticUsedSource[] {
  const out: SemanticUsedSource[] = [];
  for (const tc of input.toolCalls) {
    if (!toolCallSucceeded(tc)) continue;
    const name = tc.toolName.trim();
    if (!name) continue;
    const mapped = TOOL_REF_BY_NAME[name];
    if (mapped === "landscape") {
      out.push(
        { sourceType: "tool", sourceRef: name, placeKey: "strategy.challenge" },
        { sourceType: "tool", sourceRef: name, placeKey: "strategy.direction" },
        { sourceType: "tool", sourceRef: name, placeKey: "strategy.initiative" }
      );
      continue;
    }
    if (mapped?.placeKey) {
      out.push({ sourceType: "tool", sourceRef: name, placeKey: mapped.placeKey });
      continue;
    }
    out.push({ sourceType: "tool", sourceRef: name });
  }
  return out;
}
