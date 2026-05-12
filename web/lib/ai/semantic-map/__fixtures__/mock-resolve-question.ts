import type { SemanticMapQuestionResolution } from "../types";

import { strategyQuestionResolutionFixture } from "./strategy-question-resolution.fixture";

/** Ersetzt LLM-Resolution in Unit-Tests (CI ohne Provider). */
export function mockResolveQuestionForTests(
  overrides?: Partial<SemanticMapQuestionResolution>
): SemanticMapQuestionResolution {
  return { ...strategyQuestionResolutionFixture, ...overrides };
}

/** Alias für Diagnostik-/Smoke-Dokumentation (gleiche Implementierung). */
export const mockResolveQuestionAgainstSemanticMap = mockResolveQuestionForTests;
