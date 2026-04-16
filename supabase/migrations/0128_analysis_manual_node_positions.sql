-- Persistierte manuelle Knotenpositionen fuer die Clusteransicht.
-- migrate:up

create table if not exists app.analysis_manual_node_positions (
  organization_id uuid not null references app.organizations(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  analysis_entry_id uuid not null references app.analysis_entries(id) on delete cascade,
  x numeric(10,3) not null,
  y numeric(10,3) not null,
  z numeric(10,3) not null default 0,
  created_by_membership_id uuid null references app.organization_memberships(id) on delete set null,
  updated_by_membership_id uuid null references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_manual_node_positions_pkey
    primary key (organization_id, cycle_instance_id, analysis_entry_id)
);

create index if not exists idx_analysis_manual_node_positions_org_cycle
  on app.analysis_manual_node_positions (organization_id, cycle_instance_id);

drop trigger if exists trg_analysis_manual_node_positions_updated_at on app.analysis_manual_node_positions;
create trigger trg_analysis_manual_node_positions_updated_at
before update on app.analysis_manual_node_positions
for each row execute function app.set_updated_at();

grant select, insert, update, delete on app.analysis_manual_node_positions to authenticated;
grant select on app.analysis_manual_node_positions to anon;
alter table app.analysis_manual_node_positions enable row level security;

drop policy if exists analysis_manual_node_positions_select on app.analysis_manual_node_positions;
create policy analysis_manual_node_positions_select on app.analysis_manual_node_positions
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
);

drop policy if exists analysis_manual_node_positions_modify on app.analysis_manual_node_positions;
create policy analysis_manual_node_positions_modify on app.analysis_manual_node_positions
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
);

-- migrate:down

drop policy if exists analysis_manual_node_positions_modify on app.analysis_manual_node_positions;
drop policy if exists analysis_manual_node_positions_select on app.analysis_manual_node_positions;
drop trigger if exists trg_analysis_manual_node_positions_updated_at on app.analysis_manual_node_positions;
drop table if exists app.analysis_manual_node_positions;
