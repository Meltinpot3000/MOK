import type { SemanticSourceInventory } from "../inventory/inventory-types";

import { strategyInventoryFixture } from "./strategy-inventory.fixture";

/**
 * Erweitertes Schema-Inventar (Caps/FKs) für realistischere Validierungstests —
 * enthält das Basis-Fixture plus zusätzliche Tabellen und Verknüpfungen.
 */
export const strategyLandscapeInventoryFixture: SemanticSourceInventory = {
  ...strategyInventoryFixture,
  tables: [
    ...strategyInventoryFixture.tables,
    {
      schema: "app",
      name: "strategic_directions",
      fullName: "app.strategic_directions",
      rowEstimate: 8,
      columns: [
        { name: "id", dataType: "uuid", isNullable: false },
        { name: "challenge_id", dataType: "uuid", isNullable: true },
        { name: "title", dataType: "text", isNullable: true },
      ],
    },
    {
      schema: "app",
      name: "initiatives",
      fullName: "app.initiatives",
      rowEstimate: 12,
      columns: [
        { name: "id", dataType: "uuid", isNullable: false },
        { name: "strategic_direction_id", dataType: "uuid", isNullable: true },
        { name: "title", dataType: "text", isNullable: true },
      ],
    },
    {
      schema: "app",
      name: "okr_objectives",
      fullName: "app.okr_objectives",
      rowEstimate: 15,
      columns: [
        { name: "id", dataType: "uuid", isNullable: false },
        { name: "cycle_instance_id", dataType: "uuid", isNullable: true },
        { name: "title", dataType: "text", isNullable: true },
      ],
    },
    {
      schema: "app",
      name: "key_results",
      fullName: "app.key_results",
      rowEstimate: 40,
      columns: [
        { name: "id", dataType: "uuid", isNullable: false },
        { name: "okr_objective_id", dataType: "uuid", isNullable: true },
        { name: "title", dataType: "text", isNullable: true },
      ],
    },
    {
      schema: "app",
      name: "initiative_key_result_links",
      fullName: "app.initiative_key_result_links",
      rowEstimate: 40,
      columns: [
        { name: "initiative_id", dataType: "uuid", isNullable: false },
        { name: "key_result_id", dataType: "uuid", isNullable: false },
      ],
    },
    {
      schema: "app",
      name: "okr_cycles",
      fullName: "app.okr_cycles",
      rowEstimate: 4,
      columns: [
        { name: "id", dataType: "uuid", isNullable: false },
        { name: "label", dataType: "text", isNullable: true },
      ],
    },
  ],
  foreignKeys: [
    ...strategyInventoryFixture.foreignKeys,
    {
      constraintName: "fk_dir_challenge",
      sourceTableFull: "app.strategic_directions",
      sourceColumn: "challenge_id",
      targetTableFull: "app.strategic_challenges",
      targetColumn: "id",
    },
    {
      constraintName: "fk_init_dir",
      sourceTableFull: "app.initiatives",
      sourceColumn: "strategic_direction_id",
      targetTableFull: "app.strategic_directions",
      targetColumn: "id",
    },
    {
      constraintName: "fk_obj_cycle",
      sourceTableFull: "app.okr_objectives",
      sourceColumn: "cycle_instance_id",
      targetTableFull: "app.cycle_instances",
      targetColumn: "id",
    },
    {
      constraintName: "fk_kr_obj",
      sourceTableFull: "app.key_results",
      sourceColumn: "okr_objective_id",
      targetTableFull: "app.okr_objectives",
      targetColumn: "id",
    },
    {
      constraintName: "fk_ikl_init",
      sourceTableFull: "app.initiative_key_result_links",
      sourceColumn: "initiative_id",
      targetTableFull: "app.initiatives",
      targetColumn: "id",
    },
    {
      constraintName: "fk_ikl_kr",
      sourceTableFull: "app.initiative_key_result_links",
      sourceColumn: "key_result_id",
      targetTableFull: "app.key_results",
      targetColumn: "id",
    },
  ],
};
