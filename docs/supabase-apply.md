# Supabase Apply Guide (CLI + SQL Editor)

## Voraussetzungen

- Supabase-Projekt ist erstellt.
- `SUPABASE_DB_PASSWORD` ist gesetzt.
- `DATABASE_URL` oder `DIRECT_DATABASE_URL` ist in `.env.local` gepflegt.
- Supabase CLI ist installiert.

## 1) Primärer Weg: dbmate Migrationen

1. `DATABASE_URL` setzen (Pooler-URL mit `sslmode=require`).
2. Schema-Migrationen ausführen:
   - `dbmate --migrations-dir supabase/migrations up`
3. Seeds ausführen:
   - `dbmate --migrations-dir supabase/seed up`
4. Status prüfen:
   - `dbmate --migrations-dir supabase/migrations status`
   - `dbmate --migrations-dir supabase/seed status`

## 2) Fallback: Supabase SQL Editor

Wenn CLI nicht verfügbar ist, die SQL-Dateien in dieser Reihenfolge im SQL Editor ausführen:

1. `supabase/migrations/0001_core_multi_tenant.sql`
2. `supabase/migrations/0002_rbac.sql`
3. `supabase/migrations/0003_strategy_okr.sql`
4. `supabase/migrations/0004_revision_audit.sql`
5. `supabase/migrations/0005_tenant_branding.sql`
6. `supabase/migrations/0006_rls_policies.sql`
7. `supabase/seed/001_default_permissions.sql`
8. `supabase/seed/002_default_roles.sql`

## 3) Verifikation

- **Tenant-Isolation**: User aus Tenant A sieht keine Daten aus Tenant B.
- **RBAC**: Nur Rollen mit passender Permission dürfen schreiben.
- **Audit/Revision**: Jede Mutation in Domain-Tabellen erzeugt Events in `audit.revision_events`.
- **Branding**: `app.tenant_branding` speichert Farben und `logo_url` pro Tenant.

## Hinweise

- Seed-Skripte sind idempotent (`ON CONFLICT`), können mehrfach laufen.
- Für den ersten Tenant muss mindestens ein Membership-Eintrag existieren, damit RLS-Policies erwartungsgemäß greifen.
