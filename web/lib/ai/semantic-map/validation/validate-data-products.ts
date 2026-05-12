import { listAllTools } from "@/lib/ai/tools/registry";

import type { SemanticSourceInventory } from "../inventory/inventory-types";

/** Prüft, ob genannte Tool-Namen in der Registry existieren (Data Products / Abrufpfade). */
export function buildToolNameSet(): Set<string> {
  return new Set(listAllTools().map((t) => t.name.toLowerCase()));
}

export function validateToolRefsInInventory(
  refs: string[],
  inventory: SemanticSourceInventory
): boolean {
  const reg = buildToolNameSet();
  const inv = new Set(inventory.tools.map((t) => t.name.toLowerCase()));
  return refs.every((r) => reg.has(r.trim().toLowerCase()) || inv.has(r.trim().toLowerCase()));
}
