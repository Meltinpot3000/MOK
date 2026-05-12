import pg from "pg";

import {
  SAMPLE_PROFILE_MAX_DISTINCT_VALUES,
  SAMPLE_PROFILE_MAX_SAMPLE_TITLES,
  SAMPLE_PROFILE_MAX_TABLES,
} from "./caps";
import type { SchemaTableInventory, TableSampleProfile } from "./inventory-types";

export type CollectSampleProfileOptions = {
  databaseUrl: string;
  tables: SchemaTableInventory[];
  organizationId?: string;
};

function guessTitleColumn(columns: SchemaTableInventory["columns"]): string | null {
  const prefer = ["title", "name", "label", "summary", "headline"];
  for (const p of prefer) {
    const hit = columns.find((c) => c.name.toLowerCase() === p);
    if (hit) return hit.name;
  }
  const textish = columns.find((c) =>
    /(title|name|label|description)/i.test(c.name)
  );
  return textish?.name ?? null;
}

function guessEnumColumn(columns: SchemaTableInventory["columns"]): string | null {
  const hit = columns.find((c) => /(_status|_state|status|phase)$/i.test(c.name));
  return hit?.name ?? null;
}

export async function collectSampleProfiles(
  options: CollectSampleProfileOptions
): Promise<TableSampleProfile[]> {
  const client = new pg.Client({ connectionString: options.databaseUrl });
  await client.connect();
  const out: TableSampleProfile[] = [];
  try {
    const subset = options.tables.slice(0, SAMPLE_PROFILE_MAX_TABLES);
    for (const t of subset) {
      const full = t.fullName;
      const quoted = full.split(".").map((p) => `"${p.replace(/"/g, "")}"`).join(".");
      let rowCount: number | null = null;
      try {
        const cRes = await client.query<{ c: string }>(`select count(*)::text as c from ${quoted}`);
        rowCount = Number(cRes.rows[0]?.c ?? "0");
      } catch {
        rowCount = null;
      }

      const titleCol = guessTitleColumn(t.columns);
      const sampleTitles: string[] = [];
      if (titleCol) {
        const qTitle = `"${titleCol.replace(/"/g, "")}"`;
        const orgId = options.organizationId?.replace(/'/g, "''");
        try {
          if (orgId && t.columns.some((c) => c.name === "organization_id")) {
            const sRes = await client.query<{ v: string }>(
              `select distinct ${qTitle}::text as v from ${quoted} where organization_id = '${orgId}' and ${qTitle} is not null limit ${SAMPLE_PROFILE_MAX_SAMPLE_TITLES}`
            );
            for (const r of sRes.rows) {
              if (r.v && sampleTitles.length < SAMPLE_PROFILE_MAX_SAMPLE_TITLES) {
                sampleTitles.push(r.v.slice(0, 200));
              }
            }
          } else {
            const sRes = await client.query<{ v: string }>(
              `select distinct ${qTitle}::text as v from ${quoted} where ${qTitle} is not null limit ${SAMPLE_PROFILE_MAX_SAMPLE_TITLES}`
            );
            for (const r of sRes.rows) {
              if (r.v && sampleTitles.length < SAMPLE_PROFILE_MAX_SAMPLE_TITLES) {
                sampleTitles.push(r.v.slice(0, 200));
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      const enumCol = guessEnumColumn(t.columns);
      const distinctEnumLike: TableSampleProfile["distinctEnumLike"] = [];
      if (enumCol) {
        const qe = `"${enumCol.replace(/"/g, "")}"`;
        try {
          const eRes = await client.query<{ v: string }>(
            `select distinct ${qe}::text as v from ${quoted} where ${qe} is not null limit ${SAMPLE_PROFILE_MAX_DISTINCT_VALUES}`
          );
          distinctEnumLike.push({
            column: enumCol,
            values: eRes.rows.map((r) => r.v).filter(Boolean),
          });
        } catch {
          /* ignore */
        }
      }

      const probableOwnerColumns = t.columns
        .map((c) => c.name)
        .filter((n) => /membership_id$/i.test(n) || /^owner_/i.test(n));
      const probableCycleColumns = t.columns
        .map((c) => c.name)
        .filter((n) => /cycle/i.test(n));
      const probableParentLinkColumns = t.columns
        .map((c) => c.name)
        .filter((n) => /parent|_of_|linked|related/i.test(n));

      out.push({
        tableFullName: full,
        rowCount,
        sampleTitles,
        distinctEnumLike,
        probableOwnerColumns: probableOwnerColumns.slice(0, 8),
        probableCycleColumns: probableCycleColumns.slice(0, 8),
        probableParentLinkColumns: probableParentLinkColumns.slice(0, 8),
      });
    }
    return out;
  } finally {
    await client.end();
  }
}
