-- 0053_strategy_correlation_status_overrides.sql
-- Manual overrides for Objective-Challenge-Direction correlation status.
-- migrate:up

create table if not exists app.strategy_correlation_status_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations(id) on delete cascade,
  planning_cycle_id uuid references app.planning_cycles(id) on delete cascade,
  cycle_instance_id uuid not null references app.cycle_instances(id) on delete cascade,
  objective_id uuid not null references app.objectives(id) on delete cascade,
  challenge_id uuid not null references app.strategic_challenges(id) on delete cascade,
  strategic_direction_id uuid not null references app.strategic_directions(id) on delete cascade,
  status text not null default 'unknown',
  note text,
  updated_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_correlation_status_overrides_status_check check (
    status in ('green', 'yellow', 'red', 'unknown')
  )
);

create unique index if not exists uq_strategy_correlation_status_overrides_triplet
  on app.strategy_correlation_status_overrides(
    cycle_instance_id,
    objective_id,
    challenge_id,
    strategic_direction_id
  );

create index if not exists idx_strategy_correlation_status_overrides_lookup
  on app.strategy_correlation_status_overrides(cycle_instance_id, objective_id, challenge_id);

drop trigger if exists trg_sync_cycles_strategy_correlation_status_overrides on app.strategy_correlation_status_overrides;
create trigger trg_sync_cycles_strategy_correlation_status_overrides
before insert or update on app.strategy_correlation_status_overrides
for each row execute function app.sync_legacy_cycle_columns();

grant select, insert, update, delete on app.strategy_correlation_status_overrides to authenticated;
grant select on app.strategy_correlation_status_overrides to anon;

alter table app.strategy_correlation_status_overrides enable row level security;

drop policy if exists strategy_correlation_status_overrides_select on app.strategy_correlation_status_overrides;
create policy strategy_correlation_status_overrides_select on app.strategy_correlation_status_overrides
for select using (
  app.has_permission(organization_id, 'nav.strategy-cycle.read')
  or app.has_permission(organization_id, 'nav.strategy-matrix.read')
);

drop policy if exists strategy_correlation_status_overrides_modify on app.strategy_correlation_status_overrides;
create policy strategy_correlation_status_overrides_modify on app.strategy_correlation_status_overrides
for all using (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
)
with check (
  app.has_permission(organization_id, 'nav.strategy-cycle.write')
  or app.has_permission(organization_id, 'nav.strategy-matrix.write')
);

-- migrate:down
drop policy if exists strategy_correlation_status_overrides_modify on app.strategy_correlation_status_overrides;
drop policy if exists strategy_correlation_status_overrides_select on app.strategy_correlation_status_overrides;
drop trigger if exists trg_sync_cycles_strategy_correlation_status_overrides on app.strategy_correlation_status_overrides;
drop index if exists app.idx_strategy_correlation_status_overrides_lookup;
drop index if exists app.uq_strategy_correlation_status_overrides_triplet;
drop table if exists app.strategy_correlation_status_overrides;
