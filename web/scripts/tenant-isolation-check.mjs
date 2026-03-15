import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function warn(message) {
  console.log(`WARN ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
}

async function main() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  loadEnvFileIfPresent(envPath);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL fehlt. Bitte in web/.env.local setzen.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const rlsTables = [
      "app.organizations",
      "app.organization_memberships",
      "rbac.roles",
      "rbac.member_roles",
      "app.planning_cycles",
      "app.tenant_branding",
      "app.strategic_metrics",
      "app.strategic_challenges",
      "app.strategic_directions",
      "app.annual_targets",
      "app.initiatives",
      "app.okr_cycles",
      "app.challenge_direction_links",
      "app.objective_target_links",
      "app.objective_direction_links",
      "app.key_result_target_links",
      "app.okr_updates",
      "app.okr_reviews",
      "app.analysis_item_link_draft",
      "app.analysis_item_link",
      "app.analysis_clusters",
      "app.analysis_cluster_members",
      "app.analysis_gap_findings",
      "app.industries",
      "app.business_models",
      "app.operating_models",
      "app.business_model_industries",
      "app.operating_model_industries",
      "app.operating_model_business_models",
      "app.strategic_direction_industries",
      "app.strategic_direction_business_models",
      "app.strategic_direction_operating_models",
      "app.annual_target_industries",
      "app.annual_target_business_models",
      "app.annual_target_operating_models",
      "app.initiative_industries",
      "app.initiative_business_models",
      "app.initiative_operating_models",
      "app.objective_industries",
      "app.objective_business_models",
      "app.objective_operating_models",
      "app.key_result_industries",
      "app.key_result_business_models",
      "app.key_result_operating_models",
    ];

    for (const fullName of rlsTables) {
      const [schema, table] = fullName.split(".");
      const result = await client.query(
        `
        select c.relrowsecurity as rls_enabled
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1 and c.relname = $2
        `,
        [schema, table]
      );

      if (result.rows[0]?.rls_enabled) {
        pass(`RLS aktiv auf ${fullName}`);
      } else {
        fail(`RLS NICHT aktiv auf ${fullName}`);
      }
    }

    const membership = await client.query(
      `
      select m.user_id, m.organization_id, o.name as organization_name
      from app.organization_memberships m
      join app.organizations o on o.id = m.organization_id
      where m.status = 'active'
      order by m.created_at asc
      limit 1
      `
    );

    if (membership.rowCount === 0) {
      warn("Keine aktive Membership gefunden. Laufzeit-Isolation konnte nicht getestet werden.");
      return;
    }

    const subjectUserId = membership.rows[0].user_id;
    const subjectOrgId = membership.rows[0].organization_id;
    const subjectOrgName = membership.rows[0].organization_name;
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(subjectUserId)) {
      throw new Error(`Ungueltige user_id fuer Testkontext: ${subjectUserId}`);
    }

    const foreignOrg = await client.query(
      `
      select o.id, o.name
      from app.organizations o
      where o.id <> $1
        and not exists (
          select 1
          from app.organization_memberships m
          where m.organization_id = o.id
            and m.user_id = $2
            and m.status = 'active'
        )
      order by o.created_at asc
      limit 1
      `,
      [subjectOrgId, subjectUserId]
    );

    if (foreignOrg.rowCount === 0) {
      warn(
        `Kein zweiter Tenant fuer User ${subjectUserId} gefunden. Lege mindestens einen weiteren Tenant an, um Cross-Tenant-Zugriff aktiv zu testen.`
      );
      return;
    }

    const foreignOrgId = foreignOrg.rows[0].id;
    const foreignOrgName = foreignOrg.rows[0].name;
    pass(`Testkontext: User in "${subjectOrgName}", Fremdtenant "${foreignOrgName}"`);

    await client.query("begin");
    try {
      await client.query("set local role authenticated");
        await client.query(`set local "request.jwt.claim.role" = 'authenticated'`);
        await client.query(`set local "request.jwt.claim.sub" = '${subjectUserId}'`);

      const ownOrgVisible = await client.query(
        `select count(*)::int as count from app.organizations where id = $1`,
        [subjectOrgId]
      );
      const foreignOrgVisible = await client.query(
        `select count(*)::int as count from app.organizations where id = $1`,
        [foreignOrgId]
      );

      if (ownOrgVisible.rows[0].count > 0) {
        pass("Eigenen Tenant sichtbar");
      } else {
        fail("Eigener Tenant ist nicht sichtbar");
      }

      if (foreignOrgVisible.rows[0].count === 0) {
        pass("Fremdtenant per RLS ausgeblendet");
      } else {
        fail("Fremdtenant ist sichtbar -> Isolation verletzt");
      }

      let writeBlocked = false;
      try {
        await client.query(
          `
          insert into app.organization_memberships (organization_id, user_id, status)
          values ($1, $2, 'active')
          `,
          [foreignOrgId, subjectUserId]
        );
      } catch {
        writeBlocked = true;
      }

      if (writeBlocked) {
        pass("Schreibzugriff in Fremdtenant blockiert");
      } else {
        fail("Schreibzugriff in Fremdtenant war moeglich -> Isolation verletzt");
      }
    } finally {
      await client.query("rollback");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
