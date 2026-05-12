export type SchemaTableInventory = {
  schema: string;
  name: string;
  fullName: string;
  rowEstimate: number | null;
  columns: Array<{
    name: string;
    dataType: string;
    isNullable: boolean;
  }>;
};

export type SchemaForeignKeyInventory = {
  constraintName: string;
  sourceTableFull: string;
  sourceColumn: string;
  targetTableFull: string;
  targetColumn: string;
};

export type SchemaViewInventory = {
  schema: string;
  name: string;
  fullName: string;
};

export type SchemaFunctionInventory = {
  schema: string;
  name: string;
  fullName: string;
  language: string | null;
};

export type ToolInventoryEntry = {
  name: string;
  domain: string;
  description: string;
  inputSchemaHint?: string;
  requiredCapabilities: string[];
};

export type UiRouteInventoryEntry = {
  path: string;
  label: string | null;
};

export type TableSampleProfile = {
  tableFullName: string;
  rowCount: number | null;
  sampleTitles: string[];
  distinctEnumLike: Array<{ column: string; values: string[] }>;
  probableOwnerColumns: string[];
  probableCycleColumns: string[];
  probableParentLinkColumns: string[];
};

export type SemanticSourceInventory = {
  collectedAt: string;
  schemaHash: string;
  tables: SchemaTableInventory[];
  foreignKeys: SchemaForeignKeyInventory[];
  views: SchemaViewInventory[];
  functions: SchemaFunctionInventory[];
  tools: ToolInventoryEntry[];
  uiRoutes: UiRouteInventoryEntry[];
  sampleProfiles: TableSampleProfile[];
};
