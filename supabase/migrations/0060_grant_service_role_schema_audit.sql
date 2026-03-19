-- 0060_grant_service_role_schema_audit.sql
-- Hintergrund-Worker (service_role) aktualisiert z.B. app.objectives; trg_audit_objectives
-- schreibt audit.revision_events. Ohne Rechte auf schema audit schlaegt das Update fehl (42501),
-- ohne dass der App-Code den Fehler prueft — Job endet «completed», Daten bleiben unveraendert.
-- migrate:up

grant usage on schema audit to service_role;

grant select, insert, update, delete on all tables in schema audit to service_role;
grant usage, select on all sequences in schema audit to service_role;

alter default privileges in schema audit
grant select, insert, update, delete on tables to service_role;
alter default privileges in schema audit
grant usage, select on sequences to service_role;
