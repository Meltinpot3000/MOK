import type { StrategyObjectType, StrategyObjectVersioningMeta } from "./types";

type StrategyObjectGovernanceType =
  | StrategyObjectType
  | "objective"
  | "direction"
  | "challenge";

type LockCheckArgs = {
  objectType: StrategyObjectGovernanceType;
  versioning?: StrategyObjectVersioningMeta | null;
};

function normalizeObjectType(objectType: StrategyObjectGovernanceType): StrategyObjectType {
  if (objectType === "objective") return "strategic_objective";
  if (objectType === "direction") return "strategic_direction";
  if (objectType === "challenge") return "strategic_challenge";
  return objectType;
}

export function isStrategyObjectDefinitionLocked({
  objectType,
  versioning,
}: LockCheckArgs): boolean {
  void normalizeObjectType(objectType);

  if (!versioning) return false;

  return (
    versioning.revision_state === "current" && versioning.identity_lifecycle_state !== "draft"
  );
}

export function definitionFieldInputClass(locked: boolean, baseClass: string): string {
  if (!locked) return baseClass;
  return `${baseClass} cursor-not-allowed bg-zinc-100 text-zinc-500`;
}
