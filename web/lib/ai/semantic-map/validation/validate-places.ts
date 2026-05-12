import { getToolByName } from "@/lib/ai/tools/registry";

import type { SemanticSourceInventory } from "../inventory/inventory-types";
import type {
  PlaceValidationStatus,
  SemanticMapPlace,
  SemanticMapPlaceDraft,
} from "../types";

function hasEvidence(p: SemanticMapPlaceDraft): boolean {
  return Array.isArray(p.evidence) && p.evidence.length > 0;
}

const tableSet = (inv: SemanticSourceInventory) =>
  new Set(inv.tables.map((t) => t.fullName.toLowerCase()));

const viewSet = (inv: SemanticSourceInventory) =>
  new Set(inv.views.map((v) => v.fullName.toLowerCase()));

const functionSet = (inv: SemanticSourceInventory) =>
  new Set(inv.functions.map((f) => f.fullName.toLowerCase()));

const uiPathSet = (inv: SemanticSourceInventory) =>
  new Set(inv.uiRoutes.map((u) => u.path.toLowerCase()));

const sampleTableSet = (inv: SemanticSourceInventory) =>
  new Set(inv.sampleProfiles.map((s) => s.tableFullName.toLowerCase()));

function normalizeRef(ref: string): string {
  return ref.trim().toLowerCase();
}

export function validatePlaceDraft(args: {
  draft: SemanticMapPlaceDraft;
  inventory: SemanticSourceInventory;
  snapshotId: string;
}): SemanticMapPlace {
  const { draft, inventory, snapshotId } = args;
  const id = crypto.randomUUID();
  const tables = tableSet(inventory);
  const views = viewSet(inventory);
  const functions = functionSet(inventory);
  const uiPaths = uiPathSet(inventory);
  const samples = sampleTableSet(inventory);

  if (!hasEvidence(draft)) {
    return {
      id,
      snapshotId,
      placeKey: draft.placeKey,
      canonicalName: draft.canonicalName,
      domain: draft.domain,
      businessMeaning: draft.businessMeaning,
      descriptionForPlanner: draft.descriptionForPlanner,
      evidence: draft.evidence ?? [],
      validationStatus: "unsupported",
      confidence: 0,
    };
  }

  let verifiedHits = 0;
  let uiHits = 0;
  for (const ev of draft.evidence) {
    const ref = normalizeRef(ev.sourceRef);
    switch (ev.sourceType) {
      case "table":
        if (tables.has(ref)) verifiedHits += 1;
        break;
      case "view":
        if (views.has(ref)) verifiedHits += 1;
        break;
      case "function":
        if (functions.has(ref)) verifiedHits += 1;
        break;
      case "tool": {
        const name = ev.sourceRef.trim();
        const hit =
          getToolByName(name) ||
          inventory.tools.some((t) => t.name.toLowerCase() === name.toLowerCase());
        if (hit) verifiedHits += 1;
        break;
      }
      case "ui":
        if (uiPaths.has(ref)) uiHits += 1;
        break;
      case "sample":
        if (samples.has(ref)) verifiedHits += 1;
        break;
      default:
        break;
    }
  }

  let status: PlaceValidationStatus = "inferred";
  let confidence = Math.min(0.85, draft.confidence ?? 0.5);

  if (verifiedHits >= 1) {
    status = "verified";
    confidence = Math.min(1, Math.max(0.75, draft.confidence ?? 0.85));
  } else if (uiHits >= 2) {
    status = "verified";
    confidence = Math.min(0.9, draft.confidence ?? 0.72);
  } else if (uiHits === 1) {
    status = "inferred";
    confidence = Math.min(0.55, draft.confidence ?? 0.45);
  } else {
    status = "unsupported";
    confidence = 0.25;
  }

  return {
    id,
    snapshotId,
    placeKey: draft.placeKey,
    canonicalName: draft.canonicalName,
    domain: draft.domain,
    businessMeaning: draft.businessMeaning,
    descriptionForPlanner: draft.descriptionForPlanner,
    evidence: draft.evidence,
    validationStatus: status,
    confidence,
  };
}
