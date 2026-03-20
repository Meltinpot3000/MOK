-- 0068_initiative_key_result_links.sql
-- Explicit traceability: Initiative -> Key Result (Initiatives influence Key Results).
-- migrate:up

create table if not exists app.initiative_key_result_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  initiative_id uuid not null references app.initiatives(id) on delete cascade,
  key_result_id uuid not null references app.key_results(id) on delete cascade,
  created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cycle_instance_id, initiative_id, key_result_id)
);

create index if not exists idx_initiative_key_result_links_org_cycle
  on app.initiative_key_result_links (organization_id, cycle_instance_id);
create index if not exists idx_initiative_key_result_links_initiative
  on app.initiative_key_result_links (initiative_id);
create index if not exists idx_initiative_key_result_links_key_result
  on app.initiative_key_result_links (key_result_id);

drop trigger if exists trg_sync_cycles_initiative_key_result_links on app.initiative_key_result_links;
create trigger trg_sync_cycles_initiative_key_result_links
  before insert or update on app.initiative_key_result_links
  for each row execute function app.sync_legacy_cycle_columns();

alter table app.initiative_key_result_links enable row level security;

drop policy if exists initiative_key_result_links_select on app.initiative_key_result_links;
create policy initiative_key_result_links_select on app.initiative_key_result_links
  for select using (app.has_permission(organization_id, 'traceability.read'));

drop policy if exists initiative_key_result_links_modify on app.initiative_key_result_links;
create policy initiative_key_result_links_modify on app.initiative_key_result_links
  for all using (app.has_permission(organization_id, 'traceability.write'))
  with check (app.has_permission(organization_id, 'traceability.write'));

grant select, insert, update, delete on app.initiative_key_result_links to authenticated;
grant select on app.initiative_key_result_links to anon;

drop trigger if exists trg_audit_initiative_key_result_links on app.initiative_key_result_links;
create trigger trg_audit_initiative_key_result_links
  after insert or update or delete on app.initiative_key_result_links
  for each row execute function audit.log_row_change();

-- migrate:down
drop trigger if exists trg_audit_initiative_key_result_links on app.initiative_key_result_links;
drop policy if exists initiative_key_result_links_modify on app.initiative_key_result_links;
drop policy if exists initiative_key_result_links_select on app.initiative_key_result_links;
drop trigger if exists trg_sync_cycles_initiative_key_result_links on app.initiative_key_result_links;
drop table if exists app.initiative_key_result_links;
