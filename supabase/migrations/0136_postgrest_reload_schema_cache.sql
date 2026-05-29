-- 0136_postgrest_reload_schema_cache.sql
-- After 0135 adds app/rbac to pgrst.db_schemas, PostgREST still serves a stale schema cache
-- until reload → PGRST205 on app.organization_memberships (404). Reload here + refresh notify queue.
-- migrate:up

select pg_notification_queue_usage();

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- migrate:down
-- No-op: cache reload is harmless and not reversible.
