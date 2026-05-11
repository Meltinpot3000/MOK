import type { AiContextPackage, ModelTier } from "@/lib/ai/types";

import {
  callSentinelSynthesisMode,
  type SentinelSynthesisResult,
} from "./client";
import {
  buildSynthesisSystemPrompt,
  buildSynthesisUserPromptFromContext,
} from "./prompts";

export type LocalSynthesisRunArgs = {
  question: string;
  contextPackage: AiContextPackage;
  conversationSummary?: string | null;
  classificationCap?: "internal" | "confidential" | "restricted";
  writeActionsAllowed?: boolean;
  downgradeNotice?: string | null;
  modelTier?: ModelTier;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: string;
};

/**
 * Lokaler Synthesis-Run: nutzt Sentinel Core (Ollama/vLLM) als Antwortmodell.
 * Wird nur verwendet, wenn `model-router` auf `local` entschieden hat.
 */
export async function runLocalSynthesisMode(args: LocalSynthesisRunArgs): Promise<SentinelSynthesisResult> {
  const systemPrompt = buildSynthesisSystemPrompt({
    modelTier: args.modelTier ?? "local",
    writeActionsAllowed: Boolean(args.writeActionsAllowed),
    classificationCap: args.classificationCap ?? "internal",
  });
  const userPrompt = buildSynthesisUserPromptFromContext({
    question: args.question,
    contextPackageJson: JSON.stringify(args.contextPackage, null, 2),
    conversationSummary: args.conversationSummary ?? null,
    downgradeNotice: args.downgradeNotice ?? null,
  });
  return callSentinelSynthesisMode({
    systemPrompt,
    userPrompt,
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
    timeoutMs: args.timeoutMs,
    model: args.model,
  });
}
