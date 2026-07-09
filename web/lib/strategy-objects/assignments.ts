import type { StrategyObjectType } from "./types";

/**
 * Dimensions-Zuordnungen (Industrien / Geschäftsmodelle) werden revisionsgebunden im
 * definition_payload gesichert. Sie liegen unter `_hash_excluded`, damit reine
 * Zuordnungsänderungen den Definition-Hash (und damit die AI-Bewertung) nicht als
 * veraltet markieren.
 */
export type StrategyObjectAssignmentKind = "industry" | "business_model";

export const STRATEGY_OBJECT_ASSIGNMENT_KINDS: StrategyObjectAssignmentKind[] = [
  "industry",
  "business_model",
];

type PayloadRecord = Record<string, unknown>;

const HASH_EXCLUDED_KEY = "_hash_excluded";
const ASSIGNMENTS_KEY = "assignments";

const KIND_TO_PAYLOAD_FIELD: Record<StrategyObjectAssignmentKind, string> = {
  industry: "industry_ids",
  business_model: "business_model_ids",
};

/** Link-Tabellen je Objekttyp (Spaltennamen exakt wie in den Live-Link-Actions). */
export const STRATEGY_OBJECT_ASSIGNMENT_LINK_CONFIG: Record<
  StrategyObjectType,
  {
    idColumn: string;
    tables: Record<StrategyObjectAssignmentKind, { table: string; valueColumn: string }>;
  }
> = {
  strategic_objective: {
    idColumn: "strategy_objective_id",
    tables: {
      industry: { table: "objective_industries", valueColumn: "industry_id" },
      business_model: { table: "objective_business_models", valueColumn: "business_model_id" },
    },
  },
  strategic_challenge: {
    idColumn: "strategic_challenge_id",
    tables: {
      industry: { table: "strategic_challenge_industries", valueColumn: "industry_id" },
      business_model: { table: "strategic_challenge_business_models", valueColumn: "business_model_id" },
    },
  },
  strategic_direction: {
    idColumn: "strategic_direction_id",
    tables: {
      industry: { table: "strategic_direction_industries", valueColumn: "industry_id" },
      business_model: { table: "strategic_direction_business_models", valueColumn: "business_model_id" },
    },
  },
};

export function normalizeAssignmentKind(value: unknown): StrategyObjectAssignmentKind | null {
  return value === "industry" || value === "business_model" ? value : null;
}

function readHashExcluded(payload: PayloadRecord | null | undefined): PayloadRecord {
  const parent = payload?.[HASH_EXCLUDED_KEY];
  return parent && typeof parent === "object" ? { ...(parent as PayloadRecord) } : {};
}

function readAssignmentsBlock(payload: PayloadRecord | null | undefined): PayloadRecord {
  const block = readHashExcluded(payload)[ASSIGNMENTS_KEY];
  return block && typeof block === "object" ? { ...(block as PayloadRecord) } : {};
}

export function readAssignmentIds(
  payload: PayloadRecord | null | undefined,
  kind: StrategyObjectAssignmentKind
): string[] {
  const value = readAssignmentsBlock(payload)[KIND_TO_PAYLOAD_FIELD[kind]];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function writeAssignmentIds(
  payload: PayloadRecord | null | undefined,
  kind: StrategyObjectAssignmentKind,
  ids: string[]
): PayloadRecord {
  const base: PayloadRecord = payload ? { ...payload } : {};
  const hashExcluded = readHashExcluded(base);
  const assignments = readAssignmentsBlock(base);
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  assignments[KIND_TO_PAYLOAD_FIELD[kind]] = unique;
  hashExcluded[ASSIGNMENTS_KEY] = assignments;
  base[HASH_EXCLUDED_KEY] = hashExcluded;
  return base;
}

export function toggleAssignmentId(
  payload: PayloadRecord | null | undefined,
  kind: StrategyObjectAssignmentKind,
  id: string,
  op: "link" | "unlink"
): PayloadRecord {
  const current = new Set(readAssignmentIds(payload, kind));
  if (op === "link") current.add(id);
  else current.delete(id);
  return writeAssignmentIds(payload, kind, [...current]);
}
