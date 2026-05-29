-- 0132_grant_service_role_schema_sentinel_map.sql
-- Nur service_role: kein authenticated/anon (serverseitig / CLI).
-- migrate:up

grant usage on schema sentinel_map to service_role;

grant select, insert, update, delete on all tables in schema sentinel_map to service_role;
grant usage, select on all sequences in schema sentinel_map to service_role;

alter default privileges in schema sentinel_map
grant select, insert, update, delete on tables to service_role;
alter default privileges in schema sentinel_map
grant usage, select on sequences to service_role;

-- migrate:down
revoke usage on schema sentinel_map from service_role;
revoke all on all tables in schema sentinel_map from service_role;
revoke usage, select on all sequences in schema sentinel_map from service_role;
