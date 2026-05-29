import { createHash } from "node:crypto";

import pg from "pg";

import { postgresConnectionOptions } from "./pg-remote-tls";
import {
  SCHEMA_INVENTORY_MAX_COLUMNS_PER_TABLE,
  SCHEMA_INVENTORY_MAX_FKS,
  SCHEMA_INVENTORY_MAX_TABLES,
} from "./caps";
import type {
  SchemaForeignKeyInventory,
  SchemaFunctionInventory,
  SchemaTableInventory,
  SchemaViewInventory,
} from "./inventory-types";

const SCHEMA = "app";

export type CollectSchemaInventoryOptions = {
  databaseUrl: string;
  maxTables?: number;
  maxColumnsPerTable?: number;
  maxForeignKeys?: number;
  /** Wenn gesetzt: nur diese Tabellennamen in `app`. */
  tableAllowlist?: readonly string[] | null;
  maxViews?: number;
  maxFunctions?: number;
};

export async function collectSchemaInventory(
  options: CollectSchemaInventoryOptions
): Promise<{
  tables: SchemaTableInventory[];
  foreignKeys: SchemaForeignKeyInventory[];
  views: SchemaViewInventory[];
  functions: SchemaFunctionInventory[];
  schemaHash: string;
}> {
  const maxTables = options.maxTables ?? SCHEMA_INVENTORY_MAX_TABLES;
  const maxColumns = options.maxColumnsPerTable ?? SCHEMA_INVENTORY_MAX_COLUMNS_PER_TABLE;
  const maxFks = options.maxForeignKeys ?? SCHEMA_INVENTORY_MAX_FKS;
  const maxViews = options.maxViews ?? SCHEMA_INVENTORY_MAX_TABLES;
  const maxFunctions = options.maxFunctions ?? 200;
  const allowlist = options.tableAllowlist?.length ? [...options.tableAllowlist] : null;

  const client = new pg.Client(postgresConnectionOptions(options.databaseUrl));
  await client.connect();
  try {
    const tablesRes = await client.query<{
      table_name: string;
      row_estimate: string | null;
    }>(
      `
      select c.relname as table_name,
             coalesce(c.reltuples::bigint, 0)::text as row_estimate
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1
        and c.relkind = 'r'
        and c.relname not like 'pg_%'
        and ($3::text[] is null or c.relname = any($3::text[]))
      order by c.relname
      limit $2
      `,
      [SCHEMA, maxTables, allowlist]
    );

    const tables: SchemaTableInventory[] = [];
    for (const row of tablesRes.rows) {
      const cols = await client.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(
        `
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema = $1 and table_name = $2
        order by ordinal_position
        limit $3
        `,
        [SCHEMA, row.table_name, maxColumns]
      );
      const rowEst =
        row.row_estimate !== null && row.row_estimate !== ""
          ? Number(row.row_estimate)
          : null;
      tables.push({
        schema: SCHEMA,
        name: row.table_name,
        fullName: `${SCHEMA}.${row.table_name}`,
        rowEstimate: Number.isFinite(rowEst) ? rowEst : null,
        columns: cols.rows.map((c) => ({
          name: c.column_name,
          dataType: c.data_type,
          isNullable: c.is_nullable === "YES",
        })),
      });
    }

    const fkRes = await client.query<{
      constraint_name: string;
      src_table: string;
      src_col: string;
      tgt_table: string;
      tgt_col: string;
    }>(
      `
      select tc.constraint_name,
             tc.table_schema || '.' || tc.table_name as src_table,
             kcu.column_name as src_col,
             ccu.table_schema || '.' || ccu.table_name as tgt_table,
             ccu.column_name as tgt_col
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = $1
      order by tc.table_name, tc.constraint_name
      limit $2
      `,
      [SCHEMA, maxFks]
    );

    let foreignKeys: SchemaForeignKeyInventory[] = fkRes.rows.map((r) => ({
      constraintName: r.constraint_name,
      sourceTableFull: r.src_table,
      sourceColumn: r.src_col,
      targetTableFull: r.tgt_table,
      targetColumn: r.tgt_col,
    }));

    if (allowlist) {
      const allowed = new Set(allowlist.map((n) => n.toLowerCase()));
      foreignKeys = foreignKeys.filter((fk) => {
        const src = fk.sourceTableFull.split(".")[1]?.toLowerCase();
        const tgt = fk.targetTableFull.split(".")[1]?.toLowerCase();
        return src && tgt && allowed.has(src) && allowed.has(tgt);
      });
    }

    const viewRes = await client.query<{ table_name: string }>(
      `
      select table_name
      from information_schema.views
      where table_schema = $1
      order by table_name
      limit $2
      `,
      [SCHEMA, maxViews]
    );

    const views: SchemaViewInventory[] = viewRes.rows.map((v) => ({
      schema: SCHEMA,
      name: v.table_name,
      fullName: `${SCHEMA}.${v.table_name}`,
    }));

    const fnRes = await client.query<{
      routine_name: string;
      external_language: string | null;
    }>(
      `
      select routine_name, external_language
      from information_schema.routines
      where routine_schema = $1 and routine_type = 'FUNCTION'
      order by routine_name
      limit $2
      `,
      [SCHEMA, maxFunctions]
    );

    const functions: SchemaFunctionInventory[] = fnRes.rows.map((f) => ({
      schema: SCHEMA,
      name: f.routine_name,
      fullName: `${SCHEMA}.${f.routine_name}`,
      language: f.external_language,
    }));

    const hash = createHash("sha256");
    hash.update(JSON.stringify({ tables, foreignKeys, views, functions }));
    const schemaHash = hash.digest("hex").slice(0, 32);

    return { tables, foreignKeys, views, functions, schemaHash };
  } finally {
    await client.end();
  }
}
