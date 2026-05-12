import type { SemanticSourceInventory } from "../inventory/inventory-types";

/** Mini-Inventar für Tests (keine produktive Hardcode-Map). */
export const strategyInventoryFixture: SemanticSourceInventory = {
  collectedAt: "2026-01-01T00:00:00.000Z",
  schemaHash: "fixturehash",
  tables: [
    {
      schema: "app",
      name: "strategic_challenges",
      fullName: "app.strategic_challenges",
      rowEstimate: 10,
      columns: [
        { name: "id", dataType: "uuid", isNullable: false },
        { name: "title", dataType: "text", isNullable: true },
        { name: "cycle_instance_id", dataType: "uuid", isNullable: true },
      ],
    },
    {
      schema: "app",
      name: "strategic_initiatives",
      fullName: "app.strategic_initiatives",
      rowEstimate: 20,
      columns: [
        { name: "id", dataType: "uuid", isNullable: false },
        { name: "title", dataType: "text", isNullable: true },
        { name: "challenge_id", dataType: "uuid", isNullable: true },
      ],
    },
    {
      schema: "app",
      name: "cycle_instances",
      fullName: "app.cycle_instances",
      rowEstimate: 3,
      columns: [
        { name: "id", dataType: "uuid", isNullable: false },
        { name: "label", dataType: "text", isNullable: true },
      ],
    },
  ],
  foreignKeys: [
    {
      constraintName: "fk_init_challenge",
      sourceTableFull: "app.strategic_initiatives",
      sourceColumn: "challenge_id",
      targetTableFull: "app.strategic_challenges",
      targetColumn: "id",
    },
  ],
  views: [],
  functions: [],
  tools: [
    {
      name: "get_visible_initiatives",
      domain: "strategy",
      description: "Sichtbare Initiativen",
      requiredCapabilities: ["ai.assistant.use"],
    },
    {
      name: "get_current_okr_cycle",
      domain: "okr",
      description: "Aktueller OKR-Zyklus",
      requiredCapabilities: ["ai.assistant.use"],
    },
  ],
  uiRoutes: [
    { path: "/strategy-cycle", label: "Strategiezyklus" },
    { path: "/okr", label: "OKR" },
  ],
  sampleProfiles: [
    {
      tableFullName: "app.strategic_challenges",
      rowCount: 4,
      sampleTitles: ["Marktvolatilität", "Fachkräftemangel"],
      distinctEnumLike: [{ column: "status", values: ["open", "closed"] }],
      probableOwnerColumns: [],
      probableCycleColumns: ["cycle_instance_id"],
      probableParentLinkColumns: [],
    },
  ],
};
