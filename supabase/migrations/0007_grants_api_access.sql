-- 0007_grants_api_access.sql
-- Grant schema/table access for PostgREST roles. RLS still enforces row-level permissions.
-- migrate:up
grant usage on schema app to authenticated, anon;
grant usage on schema rbac to authenticated, anon;
grant usage on schema audit to authenticated, anon;

grant select, insert, update, delete on all tables in schema app to authenticated;
grant select on all tables in schema app to anon;

grant select, insert, update, delete on all tables in schema rbac to authenticated;
grant select on all tables in schema rbac to anon;

grant select, insert, update, delete on all tables in schema audit to authenticated;
grant select on all tables in schema audit to anon;

grant usage, select on all sequences in schema app to authenticated, anon;
grant usage, select on all sequences in schema rbac to authenticated, anon;
grant usage, select on all sequences in schema audit to authenticated, anon;

alter default privileges in schema app
grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema app
grant select on tables to anon;
alter default privileges in schema app
grant usage, select on sequences to authenticated, anon;

alter default privileges in schema rbac
grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema rbac
grant select on tables to anon;
alter default privileges in schema rbac
grant usage, select on sequences to authenticated, anon;

alter default privileges in schema audit
grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema audit
grant select on tables to anon;
alter default privileges in schema audit
grant usage, select on sequences to authenticated, anon;

-- migrate:down
revoke usage on schema app from authenticated, anon;
revoke usage on schema rbac from authenticated, anon;
revoke usage on schema audit from authenticated, anon;

revoke all privileges on all tables in schema app from authenticated, anon;
revoke all privileges on all tables in schema rbac from authenticated, anon;
revoke all privileges on all tables in schema audit from authenticated, anon;

revoke all privileges on all sequences in schema app from authenticated, anon;
revoke all privileges on all sequences in schema rbac from authenticated, anon;
revoke all privileges on all sequences in schema audit from authenticated, anon;
