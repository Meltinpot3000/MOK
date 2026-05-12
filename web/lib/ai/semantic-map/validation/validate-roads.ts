import { getToolByName } from "@/lib/ai/tools/registry";

import type { SemanticSourceInventory } from "../inventory/inventory-types";
import type { SemanticMapRoad, SemanticMapRoadDraft } from "../types";

function fkKeySet(inv: SemanticSourceInventory): Set<string> {
  const s = new Set<string>();
  for (const fk of inv.foreignKeys) {
    const a = `${fk.sourceTableFull}.${fk.sourceColumn}->${fk.targetTableFull}.${fk.targetColumn}`.toLowerCase();
    s.add(a);
    const rev = `${fk.targetTableFull}.${fk.targetColumn}->${fk.sourceTableFull}.${fk.sourceColumn}`.toLowerCase();
    s.add(rev);
  }
  return s;
}

function linkTableNames(inv: SemanticSourceInventory): Set<string> {
  const out = new Set<string>();
  for (const t of inv.tables) {
    const n = t.name.toLowerCase();
    if (
      /_link(s)?$/.test(n) ||
      /_bridge$/.test(n) ||
      /_junction$/.test(n) ||
      /^join_/.test(n)
    ) {
      out.add(t.fullName.toLowerCase());
    }
  }
  return out;
}

function hasEvidence(r: SemanticMapRoadDraft): boolean {
  return Array.isArray(r.evidence) && r.evidence.length > 0;
}

export function validateRoadDraft(args: {
  draft: SemanticMapRoadDraft;
  inventory: SemanticSourceInventory;
  snapshotId: string;
  placeKeys: Set<string>;
  fromPlaceVerified: boolean;
  toPlaceVerified: boolean;
}): SemanticMapRoad {
  const { draft, inventory, snapshotId, placeKeys } = args;
  const id = crypto.randomUUID();
  const fks = fkKeySet(inventory);
  const links = linkTableNames(inventory);

  if (!placeKeys.has(draft.fromPlaceKey) || !placeKeys.has(draft.toPlaceKey)) {
    return {
      id,
      snapshotId,
      roadKey: draft.roadKey,
      fromPlaceKey: draft.fromPlaceKey,
      toPlaceKey: draft.toPlaceKey,
      businessMeaning: draft.businessMeaning,
      relationType: draft.relationType,
      evidence: draft.evidence ?? [],
      validationStatus: "unsupported",
      confidence: 0,
    };
  }

  if (!hasEvidence(draft)) {
    return {
      id,
      snapshotId,
      roadKey: draft.roadKey,
      fromPlaceKey: draft.fromPlaceKey,
      toPlaceKey: draft.toPlaceKey,
      businessMeaning: draft.businessMeaning,
      relationType: draft.relationType,
      evidence: draft.evidence ?? [],
      validationStatus: "unsupported",
      confidence: 0,
    };
  }

  for (const ev of draft.evidence) {
    const ref = ev.sourceRef.trim().toLowerCase();
    if (ev.sourceType === "foreign_key" && fks.has(ref)) {
      return {
        id,
        snapshotId,
        roadKey: draft.roadKey,
        fromPlaceKey: draft.fromPlaceKey,
        toPlaceKey: draft.toPlaceKey,
        businessMeaning: draft.businessMeaning,
        relationType: draft.relationType,
        evidence: draft.evidence,
        validationStatus: "verified",
        confidence: Math.min(1, Math.max(0.8, draft.confidence ?? 0.9)),
      };
    }
    if (ev.sourceType === "link_table" && links.has(ref)) {
      return {
        id,
        snapshotId,
        roadKey: draft.roadKey,
        fromPlaceKey: draft.fromPlaceKey,
        toPlaceKey: draft.toPlaceKey,
        businessMeaning: draft.businessMeaning,
        relationType: draft.relationType,
        evidence: draft.evidence,
        validationStatus: "verified",
        confidence: Math.min(1, Math.max(0.78, draft.confidence ?? 0.88)),
      };
    }
    if (ev.sourceType === "tool" && getToolByName(ev.sourceRef.trim())) {
      return {
        id,
        snapshotId,
        roadKey: draft.roadKey,
        fromPlaceKey: draft.fromPlaceKey,
        toPlaceKey: draft.toPlaceKey,
        businessMeaning: draft.businessMeaning,
        relationType: draft.relationType,
        evidence: draft.evidence,
        validationStatus: "verified",
        confidence: Math.min(1, Math.max(0.75, draft.confidence ?? 0.85)),
      };
    }
    if (ev.sourceType === "function") {
      const hit = inventory.functions.some((f) => f.fullName.toLowerCase() === ref);
      if (hit) {
        return {
          id,
          snapshotId,
          roadKey: draft.roadKey,
          fromPlaceKey: draft.fromPlaceKey,
          toPlaceKey: draft.toPlaceKey,
          businessMeaning: draft.businessMeaning,
          relationType: draft.relationType,
          evidence: draft.evidence,
          validationStatus: "verified",
          confidence: Math.min(1, Math.max(0.75, draft.confidence ?? 0.85)),
        };
      }
    }
  }

  const hasExplicitInferred = draft.evidence.some((e) => e.sourceType === "inferred");
  if (hasExplicitInferred) {
    return {
      id,
      snapshotId,
      roadKey: draft.roadKey,
      fromPlaceKey: draft.fromPlaceKey,
      toPlaceKey: draft.toPlaceKey,
      businessMeaning: draft.businessMeaning,
      relationType: draft.relationType,
      evidence: draft.evidence,
      validationStatus: "inferred",
      confidence: Math.min(0.65, draft.confidence ?? 0.5),
    };
  }

  if (args.fromPlaceVerified && args.toPlaceVerified) {
    return {
      id,
      snapshotId,
      roadKey: draft.roadKey,
      fromPlaceKey: draft.fromPlaceKey,
      toPlaceKey: draft.toPlaceKey,
      businessMeaning: draft.businessMeaning,
      relationType: draft.relationType,
      evidence: draft.evidence,
      validationStatus: "missing_tool",
      confidence: Math.min(0.55, draft.confidence ?? 0.42),
    };
  }

  return {
    id,
    snapshotId,
    roadKey: draft.roadKey,
    fromPlaceKey: draft.fromPlaceKey,
    toPlaceKey: draft.toPlaceKey,
    businessMeaning: draft.businessMeaning,
    relationType: draft.relationType,
    evidence: draft.evidence,
    validationStatus: "unsupported",
    confidence: 0.2,
  };
}
