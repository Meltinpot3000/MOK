-- 0059_grant_service_role_schema_app.sql
-- PostgREST/JS nutzt service_role fuer createSupabaseAdminClient(). Ohne GRANTs auf schema app
-- sieht der Hintergrund-Worker keine Jobs (SELECT leer / Fehler) und kann weder Jobs noch
-- llm_usage_events schreiben -- Pipeline wirkt "gruen" (HTTP 200), arbeitet aber nicht.
-- migrate:up

grant usage on schema app to service_role;

grant select, insert, update, delete on all tables in schema app to service_role;
grant usage, select on all sequences in schema app to service_role;

alter default privileges in schema app
grant select, insert, update, delete on tables to service_role;
alter default privileges in schema app
grant usage, select on sequences to service_role;

-- migrate:down
revoke usage on schema app from service_role;
revoke all on all tables in schema app from service_role;
revoke usage, select on all sequences in schema app from service_role;
