import { listAllTools } from "@/lib/ai/tools/registry";

import type { ToolInventoryEntry } from "./inventory-types";

export function collectToolInventory(options?: {
  allowedToolNames?: readonly string[] | null;
  maxTools?: number;
}): ToolInventoryEntry[] {
  const max = options?.maxTools ?? 500;
  const allow = options?.allowedToolNames?.length
    ? new Set(options.allowedToolNames)
    : null;
  const mapped = listAllTools()
    .filter((t) => !allow || allow.has(t.name))
    .slice(0, max)
    .map((t) => ({
    name: t.name,
    domain: t.domain,
    description: t.description,
    inputSchemaHint: t.inputSchemaHint,
    requiredCapabilities: [...t.requiredCapabilities],
  }));
  return mapped;
}
