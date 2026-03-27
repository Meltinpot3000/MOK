-- 0106_audit_revision_policies_full_reset.sql
-- Wenn die INSERT-Policy auf audit.revisions fehlt, nur fuer falsche Rollen gilt oder eine
-- zusaetzliche RESTRICTIVE Policy INSERT blockiert, schlaegt audit.log_row_change beim
-- app.objectives-INSERT mit RLS auf "revisions" fehl.
-- Vorgehen: alle Policies auf audit.revisions / audit.revision_events entfernen und
-- die vier Standard-Policies (select mit audit.read, insert mit check true) neu anlegen.
-- INSERT explizit ohne "TO ..." => gilt fuer alle Session-Rollen (entspricht PUBLIC).
-- migrate:up

alter table if exists audit.revisions no force row level security;
alter table if exists audit.revision_events no force row level security;

do $$
declare
  pol record;
begin
  for pol in
    select p.polname as policy_name, c.relname as table_name
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'audit'
      and c.relname in ('revisions', 'revision_events')
  loop
    execute format(
      'drop policy if exists %I on audit.%I',
      pol.policy_name,
      pol.table_name
    );
  end loop;
end $$;

alter table audit.revisions enable row level security;
alter table audit.revision_events enable row level security;

create policy revisions_select on audit.revisions
for select using (
  organization_id is not null
  and app.is_member_of_org(organization_id)
  and app.has_permission(organization_id, 'audit.read')
);

create policy revisions_insert on audit.revisions
for insert
with check (true);

create policy revision_events_select on audit.revision_events
for select using (
  organization_id is not null
  and app.is_member_of_org(organization_id)
  and app.has_permission(organization_id, 'audit.read')
);

create policy revision_events_insert on audit.revision_events
for insert
with check (true);

grant usage on schema audit to authenticated, anon, service_role;
grant select, insert, update, delete on all tables in schema audit to authenticated;
grant select on all tables in schema audit to anon;
grant select, insert, update, delete on all tables in schema audit to service_role;
grant usage, select on all sequences in schema audit to authenticated, anon, service_role;

-- migrate:down
-- Kein automatisches Rekonstruktions-Szenario: bei Bedarf 0106 erneut anwenden oder aus Backup.
