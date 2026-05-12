import { listAllTools } from "@/lib/ai/tools/registry";

import type { ToolInventoryEntry } from "./inventory-types";

export function collectToolInventory(): ToolInventoryEntry[] {
  return listAllTools().map((t) => ({
    name: t.name,
    domain: t.domain,
    description: t.description,
    inputSchemaHint: t.inputSchemaHint,
    requiredCapabilities: [...t.requiredCapabilities],
  }));
}
